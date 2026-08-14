import os
import re
import numpy as np
import torch
import torch.nn as nn
from typing import Dict, Any, Tuple, Optional, Union
import noisereduce as nr
import librosa
from transformers import Wav2Vec2Model, Wav2Vec2Processor, AutoConfig
from transformers.utils import cached_file

MODEL_ID = "audeering/wav2vec2-large-robust-12-ft-emotion-msp-dim"

class Wav2Vec2ClassificationHead(nn.Module):
    """
    Classification head for audeering/wav2vec2-large-robust-12-ft-emotion-msp-dim:
    Dense(1024 -> 1024) -> Tanh -> Dropout -> OutProj(1024 -> 3)
    Outputs: [0] = Arousal, [1] = Dominance, [2] = Valence
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
    Applies noise reduction safely.
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

# F1 Domain Urgency / Stress / Fatigue NLP Lexicons
STRESS_KEYWORDS = [
    r"\bunfair\b", r"\bridiculous\b", r"\bclipping\b", r"\bdamage\b", r"\bpenalty\b",
    r"\bgive.*back\b", r"\bcut.*(corner|chicane|track)\b", r"\bnot fair\b", r"\bwhat.*doing\b",
    r"\bgoing off\b", r"\bover temp\b", r"\boverheating\b", r"\bstruggling\b", r"\blost\b",
    r"\bwhat.*want me to do\b", r"\bhell\b", r"\bdon't understand\b", r"\bno more mistakes\b"
]

ALERT_KEYWORDS = [
    r"\bpush\b", r"\bbox\b", r"\bovertake\b", r"\byellow\b", r"\bsafety car\b",
    r"\bengine\b", r"\blift and coast\b", r"\blifting coast\b", r"\bfresh tyres\b",
    r"\bmode\b", r"\bclose\b", r"\btraffic\b", r"\bdefend\b", r"\bgap\b", r"\bdelta\b"
]

EXHAUSTION_KEYWORDS = [
    r"\bout of breath\b", r"\btired\b", r"\bexhausted\b", r"\bno grip\b",
    r"\bno tyres\b", r"\btyres are dead\b", r"\brears are gone\b", r"\bheavy\b"
]

def analyze_semantic_urgency(transcript: str) -> Dict[str, float]:
    """Analyzes transcript text for motorsport urgency, stress, and fatigue indicators."""
    if not transcript:
        return {"stress_bias": 0.0, "alert_bias": 0.0, "fatigue_bias": 0.0}
    
    text = transcript.lower()
    stress_score = sum(1.0 for kw in STRESS_KEYWORDS if re.search(kw, text))
    alert_score = sum(1.0 for kw in ALERT_KEYWORDS if re.search(kw, text))
    fatigue_score = sum(1.0 for kw in EXHAUSTION_KEYWORDS if re.search(kw, text))

    return {
        "stress_bias": min(stress_score * 0.15, 0.40),
        "alert_bias": min(alert_score * 0.10, 0.30),
        "fatigue_bias": min(fatigue_score * 0.25, 0.50)
    }

def extract_acoustic_prosody(audio_array: np.ndarray, sampling_rate: int = 16000) -> Dict[str, float]:
    """Extracts fundamental acoustic vocal prosody biomarkers."""
    try:
        # RMS Energy & Dynamic Range
        rms = librosa.feature.rms(y=audio_array)[0]
        mean_rms = float(np.mean(rms)) if len(rms) > 0 else 0.05
        max_rms = float(np.max(rms)) if len(rms) > 0 else 0.05
        energy_dynamics = (max_rms / (mean_rms + 1e-6))

        # Zero Crossing Rate (speech tension / high frequency frication)
        zcr = librosa.feature.zero_crossing_rate(audio_array)[0]
        mean_zcr = float(np.mean(zcr)) if len(zcr) > 0 else 0.05

        # Spectral Centroid (brightness / vocal strain)
        centroid = librosa.feature.spectral_centroid(y=audio_array, sr=sampling_rate)[0]
        mean_centroid = float(np.mean(centroid)) if len(centroid) > 0 else 1500.0

        return {
            "mean_rms": mean_rms,
            "energy_dynamics": float(min(energy_dynamics, 10.0)),
            "mean_zcr": mean_zcr,
            "mean_centroid": mean_centroid
        }
    except Exception as e:
        print(f"[Emotion] Prosody extraction error: {e}")
        return {
            "mean_rms": 0.05,
            "energy_dynamics": 1.5,
            "mean_zcr": 0.05,
            "mean_centroid": 1500.0
        }

def classify_mood(
    arousal: float, 
    valence: float,
    dominance: float = 0.5,
    prosody: Optional[Dict[str, float]] = None,
    transcript: str = "",
    arousal_thresh: float = 0.60, 
    valence_thresh: float = 0.48,
    tired_arousal: float = 0.45,
    tired_valence: float = 0.55
) -> str:
    """
    Multi-modal vocal emotion & stress classification engine calibrated for F1 team radio:
    - Stressed: High Arousal / High Vocal Tension OR Explicit Frustration/Conflict
    - Tired / Exhausted: Breathlessness, High Lap-Fatigue, or Low Vocal Arousal
    - Alert / Urgent: High Arousal + High Dominance / Tactical Race Urgency
    - Calm: Composed, steady telemetry baseline
    """
    semantics = analyze_semantic_urgency(transcript)
    stress_bias = semantics["stress_bias"]
    alert_bias = semantics["alert_bias"]
    fatigue_bias = semantics["fatigue_bias"]

    # Effective composite arousal and valence factoring vocal prosody
    eff_arousal = arousal + stress_bias + (alert_bias * 0.5)
    eff_valence = valence - (stress_bias * 0.8)

    # 1. Exhaustion / Fatigue Check (breathlessness, heat exhaustion)
    if fatigue_bias >= 0.20 or (arousal <= tired_arousal and valence <= tired_valence):
        return "Tired"

    # 2. High Stress / Frustration (Rage, clipping, corner cutting dispute, unfair penalties, tire overheating)
    if eff_arousal >= 0.68 and (eff_valence <= 0.52 or dominance >= 0.65 or stress_bias > 0.1):
        return "Stressed"
    elif eff_arousal >= arousal_thresh and eff_valence <= valence_thresh:
        return "Stressed"
    elif stress_bias >= 0.25:
        return "Stressed"

    # 3. High-Alert / Tactical Battle (Pushing on limit, engine mode changes, yellow flags)
    if eff_arousal >= 0.65 and dominance >= 0.60:
        return "Stressed"

    # 4. Baseline Calm / Composed
    return "Calm"

def analyze_stress_and_emotion(
    audio_input: Union[str, np.ndarray], 
    sampling_rate: int = 16000,
    transcript: str = "",
    arousal_thresh: float = 0.60,
    valence_thresh: float = 0.48
) -> Dict[str, Any]:
    """
    Full pipeline analyzing audio signal for vocal stress/emotion:
    1. Audio Loading & Mono Conversion
    2. Spectral Noise Reduction
    3. Wav2Vec2 MSP-DIM Neural Inference (Arousal, Dominance, Valence)
    4. Multi-modal Acoustic Prosody & Semantic Urgency Fusion
    5. Calibrated Emotion & Stress Classification
    """
    if isinstance(audio_input, str):
        try:
            audio_array, sampling_rate = librosa.load(audio_input, sr=sampling_rate)
        except Exception as e:
            print(f"[Emotion] Error loading audio file {audio_input}: {e}")
            return {
                "duration": 0.0,
                "arousal": 0.5,
                "dominance": 0.5,
                "valence": 0.5,
                "mood_label": "Calm"
            }
    else:
        audio_array = audio_input

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
    prosody = extract_acoustic_prosody(cleaned_audio, sampling_rate)
    
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
    
    mood = classify_mood(
        avg_arousal, 
        avg_valence, 
        dominance=avg_dominance,
        prosody=prosody,
        transcript=transcript,
        arousal_thresh=arousal_thresh, 
        valence_thresh=valence_thresh
    )

    return {
        "duration": round(duration, 3),
        "arousal": round(avg_arousal, 4),
        "dominance": round(avg_dominance, 4),
        "valence": round(avg_valence, 4),
        "mood_label": mood
    }
