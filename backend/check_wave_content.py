import os
import numpy as np
import librosa

audio_dir = "backend/static/audio"
for f in os.listdir(audio_dir):
    if f.endswith(".wav") or f.endswith(".mp3"):
        path = os.path.join(audio_dir, f)
        y, sr = librosa.load(path, sr=16000)
        # Check if it is a pure sine wave (synthetic beep)
        # A pure sine wave has near zero spectral bandwidth/flatness or constant frequency
        fft = np.abs(np.fft.rfft(y))
        peak_freq = np.argmax(fft) * (sr / 2) / len(fft)
        peak_ratio = np.max(fft) / (np.sum(fft) + 1e-6)
        is_pure_tone = peak_ratio > 0.4
        print(f"File: {f} | len: {len(y)/sr:.2f}s | max_amp: {np.max(np.abs(y)):.3f} | peak_freq: {peak_freq:.1f}Hz | pure_tone: {is_pure_tone}")
