import numpy as np
import torch
from typing import Dict, Any, Tuple, Optional
import noisereduce as nr

_emotion_model = None
_emotion_processor = None

MODEL_ID = "audeering/wav2vec2-large-robust-12-ft-emotion-msp-dim"

def get_emotion_model():
    global _emotion_model, _emotion_processor
    if _emotion_model is None:
        try:
            from transformers import AutoModelForAudioClassification, AutoProcessor
            device = "cuda" if torch.cuda.is_available() else "cpu"
            print(f"[Emotion] Loading {MODEL_ID} on {device}...")
            try:
                _emotion_processor = AutoProcessor.from_pretrained(MODEL_ID)
            except Exception:
                from transformers import Wav2Vec2Processor
                _emotion_processor = Wav2Vec2Processor.from_pretrained(MODEL_ID)
                
            try:
                _emotion_model = AutoModelForAudioClassification.from_pretrained(MODEL_ID).to(device)
            except Exception as e:
                print(f"[Emotion] AutoModelForAudioClassification fallback: {e}")
                from transformers import AutoModel
                _emotion_model = AutoModel.from_pretrained(MODEL_ID).to(device)
                
            _emotion_model.eval()
        except Exception as e:
            print(f"[Emotion] Warning: Could not load audeering model: {e}")
            _emotion_model = False
            _emotion_processor = False
    if _emotion_model is False:
        return None, None
    return _emotion_model, _emotion_processor

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
    - Stressed: High Arousal (>0.6) + Low/Negative Valence (<0.4)
    - Tired: Low Arousal (<0.4) + Moderate/Low Valence (<0.55)
    - Calm: Neutral/Positive balance
    """
    if arousal > arousal_thresh and valence < valence_thresh:
        return "Stressed"
    elif arousal < tired_arousal and valence < tired_valence:
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
    audio_array = np.nan_to_num(audio_array)
    duration = len(audio_array) / sampling_rate if sampling_rate > 0 else 0.0
    
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
    
    # Chunking for long clips >30s
    max_chunk_sec = 30
    if duration > max_chunk_sec:
        chunk_samples = max_chunk_sec * sampling_rate
        chunks = [cleaned_audio[i:i + chunk_samples] for i in range(0, len(cleaned_audio), chunk_samples)]
    else:
        chunks = [cleaned_audio]

    model, processor = get_emotion_model()
    
    arousal_scores = []
    dominance_scores = []
    valence_scores = []
    
    if model is not None and processor is not None:
        device = next(model.parameters()).device
        for chunk in chunks:
            if len(chunk) < sampling_rate * 0.3:
                continue
            inputs = processor(chunk, sampling_rate=sampling_rate, return_tensors="pt", padding=True)
            inputs = {k: v.to(device) for k, v in inputs.items()}
            with torch.no_grad():
                outputs = model(**inputs)
                if hasattr(outputs, 'logits') and outputs.logits is not None:
                    logits = outputs.logits.detach().cpu().numpy().flatten()
                else:
                    logits = outputs[0].detach().cpu().numpy().flatten()
                
                # Audeering wav2vec2 outputs continuous dimensions: arousal, dominance, valence
                a = float(logits[0]) if len(logits) > 0 else 0.5
                d = float(logits[1]) if len(logits) > 1 else 0.5
                v = float(logits[2]) if len(logits) > 2 else 0.5
                
                a = min(max(a if not np.isnan(a) else 0.5, 0.0), 1.0)
                d = min(max(d if not np.isnan(d) else 0.5, 0.0), 1.0)
                v = min(max(v if not np.isnan(v) else 0.5, 0.0), 1.0)

                # Combine with acoustic energy (RMS) for robust pitch/amplitude activation signal
                rms = float(np.sqrt(np.mean(chunk**2)))
                if np.isnan(rms): rms = 0.05
                a_acoustic = min(max(rms * 12.0 + 0.3, 0.1), 0.95)
                
                a_final = round((a * 0.5 + a_acoustic * 0.5), 4)
                
                arousal_scores.append(a_final)
                dominance_scores.append(d)
                valence_scores.append(v)
                
    if not arousal_scores:
        rms = float(np.sqrt(np.mean(cleaned_audio**2)))
        if np.isnan(rms): rms = 0.05
        a_val = min(max(rms * 15.0, 0.2), 0.95)
        v_val = 0.5
        d_val = 0.5
        arousal_scores = [a_val]
        valence_scores = [v_val]
        dominance_scores = [d_val]

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

