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
            from transformers import AutoModel, AutoFeatureExtractor, AutoProcessor
            device = "cuda" if torch.cuda.is_available() else "cpu"
            print(f"[Emotion] Loading {MODEL_ID} on {device}...")
            try:
                _emotion_processor = AutoProcessor.from_pretrained(MODEL_ID, trust_remote_code=True)
            except Exception:
                from transformers import Wav2Vec2Processor
                _emotion_processor = Wav2Vec2Processor.from_pretrained(MODEL_ID)
                
            try:
                _emotion_model = AutoModel.from_pretrained(MODEL_ID, trust_remote_code=True).to(device)
            except Exception:
                from transformers import AutoModelForAudioClassification
                _emotion_model = AutoModelForAudioClassification.from_pretrained(MODEL_ID).to(device)
                
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
    Applies noise reduction (spectral gating) using noisereduce package.
    """
    if len(audio_array) < sampling_rate * 0.3:
        return audio_array
    try:
        cleaned = nr.reduce_noise(y=audio_array, sr=sampling_rate, prop_decrease=0.7)
        return cleaned
    except Exception as e:
        print(f"[Emotion] Noise reduction skipped: {e}")
        return audio_array

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
    duration = len(audio_array) / sampling_rate
    
    # Duration Gate: <0.3s -> skip stress scoring
    if duration < 0.3:
        return {
            "duration": round(duration, 3),
            "arousal": 0.0,
            "dominance": 0.0,
            "valence": 0.0,
            "mood_label": "Skipped (<0.3s)"
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
                logits = outputs[0].cpu().numpy() if hasattr(outputs, '__getitem__') else outputs.logits[0].cpu().numpy()
                if len(logits.shape) > 1:
                    logits = logits[0]
                
                # Audeering wav2vec2 outputs continuous dimensions: arousal, dominance, valence
                a = float(np.clip(logits[0], 0.0, 1.0)) if len(logits) > 0 else 0.5
                d = float(np.clip(logits[1], 0.0, 1.0)) if len(logits) > 1 else 0.5
                v = float(np.clip(logits[2], 0.0, 1.0)) if len(logits) > 2 else 0.5
                
                arousal_scores.append(a)
                dominance_scores.append(d)
                valence_scores.append(v)
                
    if not arousal_scores:
        rms = float(np.sqrt(np.mean(cleaned_audio**2)))
        a_val = min(max(rms * 15.0, 0.2), 0.95)
        v_val = 0.5
        d_val = 0.5
        arousal_scores = [a_val]
        valence_scores = [v_val]
        dominance_scores = [d_val]

    avg_arousal = float(np.mean(arousal_scores))
    avg_dominance = float(np.mean(dominance_scores))
    avg_valence = float(np.mean(valence_scores))
    
    mood = classify_mood(avg_arousal, avg_valence, arousal_thresh=arousal_thresh, valence_thresh=valence_thresh)

    return {
        "duration": round(duration, 3),
        "arousal": round(avg_arousal, 4),
        "dominance": round(avg_dominance, 4),
        "valence": round(avg_valence, 4),
        "mood_label": mood
    }
