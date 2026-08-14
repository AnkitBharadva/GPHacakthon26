import re
import os
import numpy as np
import soundfile as sf
import librosa
from typing import Dict, Any, Tuple, Optional, Union
import jiwer

_whisper_pipeline = None

def get_whisper_pipeline():
    global _whisper_pipeline
    if _whisper_pipeline is None:
        try:
            import torch
            from transformers import pipeline
            device = 0 if torch.cuda.is_available() else -1
            print(f"[STT] Loading openai/whisper-base model on device {device}...")
            _whisper_pipeline = pipeline(
                "automatic-speech-recognition",
                model="openai/whisper-base",
                device=device
            )
        except Exception as e:
            print(f"[STT] Warning: Failed to load Whisper pipeline: {e}")
            _whisper_pipeline = False
    return _whisper_pipeline if _whisper_pipeline is not False else None

def normalize_text(text: str) -> str:
    """Normalizes transcript text for fair WER computation."""
    if not text:
        return ""
    text = text.lower()
    text = re.sub(r'[^\w\s]', '', text)
    text = re.sub(r'\s+', ' ', text).strip()
    return text

def compute_wer(ground_truth: str, hypothesis: str) -> float:
    """Computes Word Error Rate using jiwer."""
    gt_clean = normalize_text(ground_truth)
    hyp_clean = normalize_text(hypothesis)
    if not gt_clean:
        return 0.0 if not hyp_clean else 1.0
    try:
        error_rate = jiwer.wer(gt_clean, hyp_clean)
        return min(round(float(error_rate), 4), 2.0)
    except Exception as e:
        print(f"[STT] WER calculation error: {e}")
        return 0.0

def transcribe_audio(audio_input: Union[str, np.ndarray], sampling_rate: int = 16000) -> str:
    """
    Transcribes audio array or audio file path using Whisper.
    """
    pipe = get_whisper_pipeline()
    if pipe is None:
        return "[Whisper pipeline offline]"
    
    try:
        if isinstance(audio_input, str):
            # Load audio file using librosa at 16kHz
            audio_array, sr = librosa.load(audio_input, sr=sampling_rate)
        else:
            audio_array = audio_input
            
        audio_inputs = np.nan_to_num(audio_array).astype(np.float32)
        if len(audio_inputs) == 0:
            return "[No audio data]"
            
        result = pipe(
            {"raw": audio_inputs, "sampling_rate": sampling_rate},
            generate_kwargs={"language": "english"},
            return_timestamps=True
        )
        text = result.get("text", "").strip()
        return text if text else "[Audio processed - low/no clear speech detected]"
    except Exception as e:
        print(f"[STT] Transcription failed: {e}")
        return f"[Transcription error: {e}]"
