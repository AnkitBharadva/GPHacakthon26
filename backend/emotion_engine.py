import os
import numpy as np
import torch
import torch.nn as nn
from typing import Dict, Any, Tuple, Optional
import noisereduce as nr
import librosa
from transformers import Wav2Vec2Model, Wav2Vec2Processor, AutoConfig
from transformers.utils import cached_file

MODEL_ID = "audeering/wav2vec2-large-robust-12-ft-emotion-msp-dim"

class Wav2Vec2ClassificationHead(nn.Module):
    """
    Official classification head for audeering/wav2vec2-large-robust-12-ft-emotion-msp-dim:
    Dense(1024 -> 1024) -> Tanh -> Dropout -> OutProj(1024 -> 3)
    Outputs: [0] = Arousal, [1] = Dominance, [2] = Valence (continuous in [0, 1])
    """
    def __init__(self, hidden_size=1024, num_labels=3, final_dropout=0.1):
        super().__init__()
        self.dense = nn.Linear(hidden_size, hidden_size)
        self.dropout = nn.Dropout(final_dropout)
        self.out_proj = nn.Linear(hidden_size, num_labels)

    def forward(self, features):
        x = features
        x = self.dropout(x)
        x = self.dense(x)
        x = torch.tanh(x)
        x = self.dropout(x)
        x = self.out_proj(x)
        return x

_pipeline = None

def get_emotion_pipeline():
    global _pipeline
    if _pipeline is None:
        try:
            device = "cuda" if torch.cuda.is_available() else "cpu"
            print(f"[Emotion] Loading {MODEL_ID} on {device}...")
            config = AutoConfig.from_pretrained(MODEL_ID)
            processor = Wav2Vec2Processor.from_pretrained(MODEL_ID)
            wav2vec2 = Wav2Vec2Model.from_pretrained(MODEL_ID).to(device)
            wav2vec2.eval()

            classifier = Wav2Vec2ClassificationHead(
                hidden_size=config.hidden_size,
                num_labels=3,
                final_dropout=getattr(config, 'final_dropout', 0.1)
            ).to(device)

            weight_file = cached_file(MODEL_ID, "pytorch_model.bin")
            full_state = torch.load(weight_file, map_location=device)
            head_state = {
                "dense.weight": full_state["classifier.dense.weight"],
                "dense.bias": full_state["classifier.dense.bias"],
                "out_proj.weight": full_state["classifier.out_proj.weight"],
                "out_proj.bias": full_state["classifier.out_proj.bias"],
            }
            classifier.load_state_dict(head_state)
            classifier.eval()

            _pipeline = {
                "model": wav2vec2,
                "classifier": classifier,
                "processor": processor,
                "device": device,
            }
            print("[Emotion] Audeering MSP-DIM pipeline successfully initialized!")
        except Exception as e:
            print(f"[Emotion] Error initializing model: {e}")
            _pipeline = False

    if _pipeline is False:
        return None
    return _pipeline

def apply_noise_reduction(audio_array: np.ndarray, sampling_rate: int = 16000) -> np.ndarray:
    """
    Applies noise reduction (spectral gating) using noisereduce package safely.
    """
    if audio_array is None or len(audio_array) < sampling_rate * 0.3:
        return np.nan_to_num(audio_array) if audio_array is not None else np.array([])
    
    std_val = np.std(audio_array)
    if std_val < 1e-5:
        return np.nan_to_num(audio_array)

    try:
        cleaned = nr.reduce_noise(y=audio_array, sr=sampling_rate, prop_decrease=0.7)
        return np.nan_to_num(cleaned)
    except Exception as e:
        print(f"[Emotion] Noise reduction skipped: {e}")
        return np.nan_to_num(audio_array)

def classify_mood(
    arousal: float, 
    valence: float, 
    arousal_thresh: float = 0.6, 
    valence_thresh: float = 0.4,
    tired_arousal: float = 0.4,
    tired_valence: float = 0.55
) -> str:
    """
    Rule-based dimensional emotion classification:
    - Stressed: High Arousal (>= arousal_thresh) + Negative/Low Valence (<= valence_thresh)
    - Tired: Low Arousal (<= tired_arousal) + Moderate/Low Valence (<= tired_valence)
    - Calm: Composed, balanced vocal state
    """
    if arousal >= arousal_thresh and valence <= valence_thresh:
        return "Stressed"
    elif arousal <= tired_arousal and valence <= tired_valence:
        return "Tired"
    else:
        return "Calm"

def analyze_stress_and_emotion(
    audio_array: np.ndarray, 
    sampling_rate: int = 16000,
    arousal_thresh: float = 0.6,
    valence_thresh: float = 0.4
) -> Dict[str, Any]:
    """
    Analyzes raw audio signal for vocal stress/emotion:
    1. Duration check (<0.3s skip, >30s chunking)
    2. Noise reduction
    3. Wav2Vec2 dimensional inference (Arousal, Dominance, Valence)
    4. Thresholding to produce mood label (Stressed, Calm, Tired)
    """
    if audio_array is None or len(audio_array) == 0:
        return {
            "duration": 0.0,
            "arousal": 0.5,
            "dominance": 0.5,
            "valence": 0.5,
            "mood_label": "Calm"
        }

    # Ensure 1D mono float32
    if len(audio_array.shape) > 1:
        audio_array = np.mean(audio_array, axis=1)
    audio_array = np.nan_to_num(audio_array).astype(np.float32)

    # Resample to 16kHz if needed
    if sampling_rate != 16000:
        audio_array = librosa.resample(audio_array, orig_sr=sampling_rate, target_sr=16000)
        sampling_rate = 16000

    duration = len(audio_array) / sampling_rate
    
    # Duration Gate: <0.3s -> skip stress scoring
    if duration < 0.3:
        return {
            "duration": round(duration, 3),
            "arousal": 0.5,
            "dominance": 0.5,
            "valence": 0.5,
            "mood_label": "Calm"
        }
        
    # Clean audio
    cleaned_audio = apply_noise_reduction(audio_array, sampling_rate)
    
    # Chunking for long clips > 30s
    max_chunk_sec = 30
    if duration > max_chunk_sec:
        chunk_samples = max_chunk_sec * sampling_rate
        chunks = [cleaned_audio[i:i + chunk_samples] for i in range(0, len(cleaned_audio), chunk_samples)]
    else:
        chunks = [cleaned_audio]

    pipeline = get_emotion_pipeline()
    
    arousal_scores = []
    dominance_scores = []
    valence_scores = []
    
    if pipeline is not None:
        model = pipeline["model"]
        classifier = pipeline["classifier"]
        processor = pipeline["processor"]
        device = pipeline["device"]

        for chunk in chunks:
            if len(chunk) < sampling_rate * 0.3:
                continue
            inputs = processor(chunk, sampling_rate=sampling_rate, return_tensors="pt", padding=True)
            input_values = inputs["input_values"].to(device)
            attention_mask = inputs.get("attention_mask")
            if attention_mask is not None:
                attention_mask = attention_mask.to(device)

            with torch.no_grad():
                outputs = model(input_values, attention_mask=attention_mask)
                hidden_states = outputs[0]
                
                # Mean pooling over valid audio frames
                if attention_mask is not None:
                    padding_mask = model._get_feature_vector_attention_mask(hidden_states.shape[1], attention_mask)
                    hidden_states[~padding_mask] = 0.0
                    pooled = hidden_states.sum(dim=1) / padding_mask.sum(dim=1, keepdim=True)
                else:
                    pooled = torch.mean(hidden_states, dim=1)

                logits = classifier(pooled)
                scores = logits.squeeze().cpu().numpy()

                # MSP-DIM dimensions: [0]=Arousal, [1]=Dominance, [2]=Valence
                a = float(scores[0]) if len(scores) > 0 else 0.5
                d = float(scores[1]) if len(scores) > 1 else 0.5
                v = float(scores[2]) if len(scores) > 2 else 0.5

                # Clamp values to [0.0, 1.0]
                a = min(max(a if not np.isnan(a) else 0.5, 0.0), 1.0)
                d = min(max(d if not np.isnan(d) else 0.5, 0.0), 1.0)
                v = min(max(v if not np.isnan(v) else 0.5, 0.0), 1.0)

                arousal_scores.append(a)
                dominance_scores.append(d)
                valence_scores.append(v)

    if not arousal_scores:
        rms = float(np.sqrt(np.mean(cleaned_audio**2)))
        if np.isnan(rms): rms = 0.05
        a_val = min(max(rms * 15.0, 0.2), 0.95)
        arousal_scores = [a_val]
        valence_scores = [0.5]
        dominance_scores = [0.5]

    avg_arousal = float(np.nan_to_num(np.mean(arousal_scores), nan=0.5))
    avg_dominance = float(np.nan_to_num(np.mean(dominance_scores), nan=0.5))
    avg_valence = float(np.nan_to_num(np.mean(valence_scores), nan=0.5))
    
    avg_arousal = min(max(avg_arousal, 0.0), 1.0)
    avg_dominance = min(max(avg_dominance, 0.0), 1.0)
    avg_valence = min(max(avg_valence, 0.0), 1.0)
    
    mood = classify_mood(avg_arousal, avg_valence, arousal_thresh=arousal_thresh, valence_thresh=valence_thresh)

    return {
        "duration": round(duration, 3),
        "arousal": round(avg_arousal, 4),
        "dominance": round(avg_dominance, 4),
        "valence": round(avg_valence, 4),
        "mood_label": mood
    }
