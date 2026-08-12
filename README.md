# The Silent Co-Driver 🏎️🎙️

> **Formula 1 Driver Radio Speech-to-Text (STT) • Continuous Dimensional Vocal Stress Scoring • FastF1 Lap Performance Alignment Engine**

---

## 1. Executive Summary & Core Value Proposition

**The Silent Co-Driver** is an intelligence dashboard and real-time audio analytics suite built specifically for Formula 1 race engineers and telemetry analysts. In high-speed motorsport, driver radio communications provide critical context regarding vehicle mechanical issues, tyre degradation, track conditions, and driver fatigue. 

The application solves three primary challenges:
1. **Automated Radio Transcription:** Transcribes noisy driver radio transmissions in real time using `openai/whisper-base` and benchmarks accuracy against human ground-truth transcripts using Word Error Rate (WER).
2. **Vocal Stress & Fatigue Quantifier:** Evaluates continuous 3D acoustic emotion dimensions—**Arousal** (activation/energy), **Valence** (pleasurable vs. distressing state), and **Dominance** (control)—via Wav2Vec2 (`audeering/wav2vec2-large-robust-12-ft-emotion-msp-dim`) to flag whether a driver is **STRESSED**, **CALM**, or **FATIGUED**.
3. **Telemetry & Pace Alignment:** Aligns UTC radio message timestamps directly with driver lap timing curves fetched from **FastF1**. Race engineers can instantly observe whether a driver sounding stressed (e.g. engine overheating, brake fade, yellow flag calls) correlates with pace loss or erratic lap times on track.

---

## 2. High-Level System Architecture

```mermaid
flowchart TD
    subgraph Data Sources & Telemetry
        HF["Hugging Face Dataset\nMikCil/f1-team-radio\n(14,700 Clips, 43 Drivers)"]
        F1["FastF1 API\nSession & Lap Timing Engine"]
        UserAudio["User Audio Upload\n.wav / .mp3 Radio Clips"]
    end

    subgraph Backend Engine (FastAPI - Port 8000)
        NR["Spectral Noise Reduction\nnoisereduce (Prop Decrease 0.7)"]
        STT["STT Engine\nopenai/whisper-base"]
        WER["WER Calculator\njiwer Levenshtein Evaluation"]
        EMO["Dimensional Emotion Classifier\naudeering/wav2vec2-large-robust-12-ft-emotion-msp-dim"]
        THRESH["Rule-Based Threshold Logic\nArousal & Valence Categorization"]
        DB[(SQLite Cache DB\nsilent_codriver.db)]
    end

    subgraph Frontend Dashboard (Vite + React - Port 3000)
        UI_Chart["Interactive Pace vs. Stress Line Chart"]
        UI_Timeline["Radio Message Timeline & Audio Player"]
        UI_STT["Dual Transcript View & WER Badge"]
        UI_Tuner["Engineer Live Stress Threshold Tuner"]
        UI_Upload["Stage Audio Clip Analyzer"]
    end

    HF -->|Radio Clips & Transcripts| DB
    F1 -->|Lap Times & UTC Timestamps| DB
    UserAudio -->|POST /api/audio/upload| NR

    NR --> STT
    NR --> EMO
    STT --> WER
    EMO --> THRESH

    STT & WER & THRESH & DB -->|JSON REST API| UI_Chart
    STT & WER & THRESH & DB -->|JSON REST API| UI_Timeline
    STT & WER & THRESH & DB -->|JSON REST API| UI_STT
    THRESH -->|POST /api/reclassify| UI_Tuner
    NR & STT & EMO -->|POST /api/audio/upload| UI_Upload
```

---

## 3. Network Ports & Local Service Endpoints

| Service | Technology Stack | Host / URL | Port | Description |
| :--- | :--- | :--- | :---: | :--- |
| **Backend API** | FastAPI + Uvicorn (Conda `gp`) | `http://127.0.0.1:8000` | **8000** | REST API endpoints, ML inference pipelines, SQLite cache interface, static audio server |
| **Static Audio Server** | FastAPI StaticFiles | `http://127.0.0.1:8000/static/audio/` | **8000** | Hosts streaming `.wav` driver radio clips for web audio playback |
| **Frontend Web App** | React 19 + Vite | `http://127.0.0.1:3000` | **3000** | Interactive dark telemetry glassmorphism dashboard UI |

---

## 4. Machine Learning Models & Speech Pipeline

### A. Speech-to-Text (STT): `openai/whisper-base`
* **Model ID:** `openai/whisper-base` (74 Million parameters)
* **Execution:** Transcribes raw 16kHz audio arrays into normalized English text.
* **Accuracy Evaluation:** Computes **Word Error Rate (WER)** using `jiwer` against human ground-truth transcripts:
  $$\text{WER} = \frac{S + D + I}{N} = \frac{\text{Substitutions} + \text{Deletions} + \text{Insertions}}{\text{Total Words in Reference}}$$
* **Text Normalization:** Lowercase conversion, punctuation stripping, and whitespace collapse.

### B. Dimensional Emotion Classifier: `audeering/wav2vec2-large-robust-12-ft-emotion-msp-dim`
* **Model ID:** `audeering/wav2vec2-large-robust-12-ft-emotion-msp-dim`
* **Architecture:** Wav2Vec2 Large Robust fine-tuned on MSP-Podcast continuous dimensional speech emotion dataset.
* **Continuous Output Dimensions:**
  1. **Arousal ($A \in [0, 1]$):** Measures physiological activation, vocal tension, pitch height, and energy.
  2. **Valence ($V \in [0, 1]$):** Measures emotional state pleasantness vs. negative distress.
  3. **Dominance ($D \in [0, 1]$):** Measures feeling of control vs. submissiveness.

### C. Acoustic Preprocessing & Noise Reduction (`noisereduce`)
F1 radio transmissions contain extreme background engine rumble and wind noise (up to 120 dB SPL).
* **Spectral Gating:** Applied via `noisereduce.reduce_noise(y=audio, sr=16000, prop_decrease=0.7)`.
* **Zero-Variance Guard:** Prevents division-by-zero NaNs on silent clips by verifying signal standard deviation ($\sigma > 10^{-5}$) before spectral gating.
* **Acoustic RMS Energy Fusion:** Combines Wav2Vec2 neural output with acoustic Root Mean Square (RMS) energy to ensure robust stress classification on high-pitch driver shout events.

### D. Rule-Based Dimensional Stress Threshold Logic
The continuous dimensional outputs are mapped to discrete driver vocal states using adjustable thresholds:

$$\text{Driver Mood State} = \begin{cases} 
\text{STRESSED} & \text{if } A > T_{\text{arousal}} \text{ (default 0.60) and } V < T_{\text{valence}} \text{ (default 0.40)} \\
\text{TIRED / FATIGUED} & \text{if } A < T_{\text{tired\_arousal}} \text{ (default 0.40) and } V < T_{\text{tired\_valence}} \text{ (default 0.55)} \\
\text{CALM} & \text{otherwise}
\end{cases}$$

> **Dynamic Calibration:** Race engineers can modify $T_{\text{arousal}}$ and $T_{\text{valence}}$ in real-time via the UI **Engineer Stress Threshold Tuner** drawer (`POST /api/reclassify`).

---

## 5. Mandatory Dataset & Model Credits

### Primary Dataset: `MikCil/f1-team-radio`
* **Source:** [Hugging Face Datasets: `MikCil/f1-team-radio`](https://huggingface.co/datasets/MikCil/f1-team-radio)
* **License:** **CC-BY-4.0** (Attributed in accordance with dataset distribution terms)
* **Overview:** Contains 14,700 audio/transcript rows spanning 43 drivers across 149 Grand Prix events (2018–2025).
* **Ground Truth:** Includes human ground-truth transcripts used to evaluate Whisper STT accuracy.

### Telemetry Provider: `FastF1` API
* **Source:** [FastF1 Python Library](https://github.com/theOdev/FastF1)
* **Usage:** Provides lap times, sector splits, pit stop flags, and driver racing numbers linked via driver 3-letter timing codes (`DANRIC01` $\rightarrow$ `RIC`, `LEWHAM01` $\rightarrow$ `HAM`, `MAXVER01` $\rightarrow$ `VER`).

---

## 6. Complete Directory & File Structure

```
D:\GP
├── backend/
│   ├── main.py              # FastAPI application endpoints, StaticFiles mount & upload route
│   ├── cache_db.py          # SQLite database schema, initialization & query functions
│   ├── dataset_loader.py    # Hugging Face MikCil/f1-team-radio dataset stream & audio exporter
│   ├── fastf1_loader.py     # FastF1 session loader & local lap timing cache manager
│   ├── stt_engine.py        # Whisper STT pipeline loader, transcript normalizer & jiwer WER calculator
│   ├── emotion_engine.py    # Wav2Vec2 continuous dimensional stress classifier & noise reduction
│   ├── alignment.py         # UTC radio message timestamp to FastF1 lap timing join engine
│   ├── process_dataset.py   # Initial demo dataset builder & batch pre-processor
│   ├── silent_codriver.db   # SQLite cache database
│   └── static/
│       └── audio/           # Static WAV audio file storage directory
├── frontend/
│   ├── src/
│   │   ├── App.jsx          # Full F1 Telemetry Dashboard, Audio Analyzer & Threshold Tuner
│   │   ├── index.css        # Glassmorphic F1 dark theme styling system & CSS animations
│   │   └── main.jsx         # React application entry point
│   ├── index.html           # HTML5 root template
│   ├── package.json         # React 19, Vite & Lucide icons dependency configuration
│   └── vite.config.js       # Vite dev server host/port binding config
├── driver_tone_detection_architecture_shareable.md
├── Grandprix Problem Statements.pdf
└── README.md                # Exhaustive system documentation
```

---

## 7. Database Schema (`silent_codriver.db`)

The application uses an embedded SQLite cache database (`backend/silent_codriver.db`) managed via `backend/cache_db.py`:

```sql
CREATE TABLE IF NOT EXISTS races (
    race_id TEXT PRIMARY KEY,
    grand_prix TEXT,
    year INTEGER,
    session_date TEXT,
    total_messages INTEGER
);

CREATE TABLE IF NOT EXISTS drivers (
    driver_id TEXT,
    race_id TEXT,
    racing_number TEXT,
    driver_code TEXT,
    message_count INTEGER,
    PRIMARY KEY (driver_id, race_id)
);

CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    race_id TEXT,
    grand_prix TEXT,
    year INTEGER,
    driver_id TEXT,
    racing_number TEXT,
    driver_code TEXT,
    session_date TEXT,
    message_timestamp TEXT,
    ground_truth_transcript TEXT,
    whisper_transcript TEXT,
    wer REAL,
    arousal REAL,
    dominance REAL,
    valence REAL,
    mood_label TEXT,
    lap_number INTEGER,
    lap_time_seconds REAL,
    duration REAL,
    audio_filename TEXT
);

CREATE TABLE IF NOT EXISTS laps (
    race_id TEXT,
    driver_code TEXT,
    lap_number INTEGER,
    lap_time_seconds REAL,
    is_pit INTEGER,
    lap_start_time_sec REAL,
    lap_end_time_sec REAL,
    PRIMARY KEY (race_id, driver_code, lap_number)
);
```

---

## 8. Quickstart & Operational Commands

### Prerequisites
* Anaconda / Miniconda installed.
* Node.js v18+ and `npm` installed.

### Step 1: Activate Conda Environment
Always run backend commands within the dedicated Conda environment `gp`:
```bash
conda activate gp
```

### Step 2: Start the Backend Server (FastAPI)
Run from the project root (`D:\GP`):
```bash
conda run -n gp python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000
```
> **Backend API URL:** `http://127.0.0.1:8000`

### Step 3: Start the Frontend Dev Server (Vite + React)
Navigate to the `frontend` folder and run:
```bash
cd frontend
npm run dev -- --host 127.0.0.1 --port 3000
```
> **Frontend Dashboard URL:** `http://127.0.0.1:3000`

### Step 4: Stopping the Servers
To stop the background tasks gracefully:
* In terminal: Press `Ctrl + C` in each running terminal window.

---

## 9. Complete API Endpoint Reference

| HTTP Method | Endpoint | Description | Sample Request / Parameters |
| :--- | :--- | :--- | :--- |
| `GET` | `/` | System health check & active model metadata | `curl http://127.0.0.1:8000/` |
| `GET` | `/api/races` | List all available Grand Prix events in database | `curl http://127.0.0.1:8000/api/races` |
| `GET` | `/api/races/{race_id}/drivers` | List drivers with radio messages for a specific race | `curl http://127.0.0.1:8000/api/races/2018_Australian_Grand_Prix/drivers` |
| `GET` | `/api/races/{race_id}/drivers/{driver_id}/messages` | Get radio message timeline + STT + stress labels for a driver | `curl http://127.0.0.1:8000/api/races/2018_Australian_Grand_Prix/drivers/DANRIC01/messages` |
| `GET` | `/api/races/{race_id}/laps/{driver_code}` | Get FastF1 lap pace curves for performance alignment chart | `curl http://127.0.0.1:8000/api/races/2018_Australian_Grand_Prix/laps/RIC` |
| `POST` | `/api/reclassify` | Re-classify cached radio messages using updated engineer thresholds | `{"arousal_thresh": 0.65, "valence_thresh": 0.35}` |
| `POST` | `/api/audio/upload` | Upload custom radio clip (.wav, .mp3) for live Whisper STT + Wav2Vec2 stress analysis | Multipart Form (`file`, `reference_transcript`, `arousal_thresh`, `valence_thresh`) |
| `GET` | `/api/stats` | Aggregated dataset summary statistics & average Whisper WER | `curl http://127.0.0.1:8000/api/stats` |

---

## 10. Key Application Features & UI Walkthrough

1. **Interactive Race & Driver Selector:** Pick Grand Prix events (e.g. 2018 Australian GP, 2021 Abu Dhabi GP) and drivers (`RIC`, `HAM`, `VER`, `RAI`).
2. **Pace vs Vocal Stress Telemetry Chart:** Visualizes lap timing columns across the race, overlaying radio message markers color-coded by stress state:
   * 🔴 **STRESSED** (High arousal, low valence)
   * 🟢 **CALM** (Neutral/positive arousal and valence)
   * 🟡 **FATIGUED** (Low arousal, low valence)
3. **Dual Transcript View & WER Badge:** Displays human ground-truth transcript alongside Whisper STT inference with `jiwer` Word Error Rate percentage badge.
4. **Web Audio Player:** Integrated streaming audio player for reviewing driver radio communications.
5. **Live Audio Analyzer ("Bring Your Own Clip"):** Upload external audio recordings (`.wav`, `.mp3`) to test Whisper STT and Wav2Vec2 stress scoring live.
6. **Engineer Stress Threshold Tuner:** Interactive sliders allowing race engineers to adjust $T_{\text{arousal}}$ and $T_{\text{valence}}$ cutoffs on the fly.

---

## 11. Troubleshooting & Edge-Case Handling

* **Empty STT String or NaN Percentages:**
  * If audio clips are silent or contain extreme noise, `noisereduce` zero-variance checks ($\sigma > 10^{-5}$) and `np.nan_to_num()` prevent division-by-zero errors.
* **CORS Errors:**
  * FastAPI has `CORSMiddleware` configured with `allow_origins=["*"]` to allow seamless requests from `http://127.0.0.1:3000`.
* **Port Conflicts:**
  * If port 8000 or 3000 is occupied, free the port using `netstat -ano | findstr 8000` or launch on an alternative port (e.g., `--port 8001`).
