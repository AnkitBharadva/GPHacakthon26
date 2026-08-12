import os
import soundfile as sf
import numpy as np
from typing import Dict, List, Any, Optional
from datasets import load_dataset, Audio

STATIC_AUDIO_DIR = os.path.join(os.path.dirname(__file__), "static", "audio")
os.makedirs(STATIC_AUDIO_DIR, exist_ok=True)

_dataset = None

def get_hf_dataset():
    global _dataset
    if _dataset is None:
        print("[Dataset] Loading Hugging Face dataset MikCil/f1-team-radio...")
        try:
            ds = load_dataset("MikCil/f1-team-radio", split="train")
            ds = ds.cast_column("audio", Audio(sampling_rate=16000))
            _dataset = ds
            print(f"[Dataset] Successfully loaded {len(ds)} rows.")
        except Exception as e:
            print(f"[Dataset] Error loading HF dataset: {e}")
            _dataset = None
    return _dataset

def export_audio_to_file(audio_dict: Dict[str, Any], filename: str) -> str:
    """
    Saves audio array from HF Audio feature to a WAV file in static/audio/
    """
    filepath = os.path.join(STATIC_AUDIO_DIR, filename)
    if not os.path.exists(filepath):
        try:
            array = audio_dict["array"]
            sr = audio_dict["sampling_rate"]
            sf.write(filepath, array, sr)
        except Exception as e:
            print(f"[Dataset] Failed to save audio file {filename}: {e}")
    return filename
