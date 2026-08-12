# The Silent Co-Driver 🏎️🎙️

> **F1 Driver Radio Speech-to-Text (STT) • Vocal Stress Scoring • Lap Performance Alignment Engine**

---

## 1. Executive Summary

**The Silent Co-Driver** is a full-stack telemetry and audio intelligence web application built for Formula 1 race engineers. It transcribes driver radio communications in real time, evaluates vocal stress/fatigue using continuous acoustic emotion dimensions (Arousal, Valence, Dominance), and aligns these emotional states directly against lap timing data from FastF1. 

An engineer can immediately correlate whether a driver sounding stressed or fatigued (e.g. over-heating engine, tyre degradation, yellow flag calls) corresponds directly to pace loss on track.

---

## 2. Mandatory Dataset & Model Credits

### Primary Dataset: `MikCil/f1-team-radio`
* **Source:** [Hugging Face Datasets: `MikCil/f1-team-radio`](https://huggingface.co/datasets/MikCil/f1-team-radio)
* **License:** **CC-BY-4.0** (Attributed in accordance with dataset distribution terms)
* **Facts:** 14,700 audio/transcript rows spanning 43 drivers across 149 Grand Prix events (2018–2025).
* **Ground Truth:** Includes human ground-truth transcripts used to evaluate Automatic Speech Recognition (ASR) Word Error Rate (WER).

### Models & Preprocessing:
1. **Speech-to-Text (STT):** `openai/whisper-base`
   * Evaluated via `jiwer` against `transcription` ground truth on F1 radio vocabulary.
2. **Dimensional Emotion & Vocal Stress Classifier:** `audeering/wav2vec2-large-robust-12-ft-emotion-msp-dim`
   * Fine-tuned Wav2Vec2 on MSP-Podcast for continuous dimensional speech emotion recognition (Arousal, Dominance, Valence).
   * **Rule-based Threshold Logic:**
     * `arousal > 0.60` and `valence < 0.40` $\rightarrow$ **STRESSED**
     * `arousal < 0.40` and `valence < 0.55` $\rightarrow$ **TIRED / FATIGUED**
     * Otherwise $\rightarrow$ **CALM**
     * Dynamic threshold slider provided in the UI for live engineer tuning.
3. **Telemetry & Lap Alignment:** `FastF1` API
   * Driver 3-letter code extracted from `driver_id[3:6]` (e.g. `DANRIC01` $\rightarrow$ `RIC`, `MAXVER01` $\rightarrow$ `VER`, `LEWHAM01` $\rightarrow$ `HAM`).
   * Joins radio message UTC timestamps with session lap times.

---

## 3. Technology Stack & Project Structure

```
D:\GP
├── backend/
│   ├── main.py              # FastAPI Web Application & Endpoints
│   ├── cache_db.py          # SQLite database (silent_codriver.db)
│   ├── dataset_loader.py    # Hugging Face MikCil/f1-team-radio streaming loader
│   ├── fastf1_loader.py     # FastF1 session & lap timing loader with disk cache
│   ├── stt_engine.py        # Whisper STT & jiwer WER calculator
│   ├── emotion_engine.py    # Audeering Wav2Vec2 dimensional stress classifier & noise reduction
│   ├── alignment.py        # UTC radio timestamp to FastF1 lap timing join engine
│   ├── process_dataset.py   # Dataset preprocessor & demo data loader
│   └── static/audio/        # Static audio file server directory
├── frontend/
│   ├── src/
│   │   ├── App.jsx          # Telemetry Dashboard UI & Live Audio Analyzer
│   │   ├── index.css        # Dark F1 Telemetry Glassmorphism styling
│   │   └── main.jsx
│   ├── package.json
│   └── vite.config.js
└── README.md
```

---

## 4. Quickstart & How to Run

### Always use Conda Environment `gp`:
```bash
conda activate gp
```

### Option A: Run Backend Server (FastAPI)
```bash
conda run -n gp python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000
```
Backend API will be live at `http://127.0.0.1:8000`.

### Option B: Run Frontend Dev Server (Vite + React)
```bash
cd frontend
npm run dev -- --host 127.0.0.1 --port 3000
```
Frontend Web Dashboard will be live at `http://127.0.0.1:3000`.

---

## 5. Key Features & Deliverables

1. **Telemetry Dashboard:** Interactive race selector (e.g., 2018 Australian Grand Prix, 2021 Abu Dhabi Grand Prix) and driver picker (`RIC`, `HAM`, `VER`, `RAI`).
2. **Performance vs Stress Correlation Line Chart:** Plots lap times (seconds) across the entire race with individual radio messages color-coded by vocal emotion:
   * 🔴 **Stressed** (High arousal, low valence)
   * 🟢 **Calm** (Balanced arousal/valence)
   * 🟡 **Fatigued / Tired** (Low arousal, low valence)
3. **Dual Transcript View & WER Badge:** Displays human ground truth transcript alongside Whisper STT inference with `jiwer` Word Error Rate badge.
4. **Audio Playback:** Built-in web audio player for streaming radio clips.
5. **Live Audio Analyzer ("Bring Your Own Clip"):** Upload external audio clips (.wav, .mp3) or test custom radio recordings to run Whisper STT + Wav2Vec2 stress inference live.
6. **Engineer Stress Threshold Tuner:** Interactive sliders allowing engineers to adjust Arousal and Valence thresholds on the fly.
