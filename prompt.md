# Build Spec: "The Silent Co-Driver" — Driver Stress Detection from Race Radio

You are an AI coding agent. Build a complete, working, demo-ready hackathon MVP from this spec. Follow the priority tiers exactly — get Tier 1 fully working end-to-end before writing a single line of Tier 2, and only attempt Tier 3 if Tier 1 and Tier 2 are both done and tested.

## 1. What we're building

A tool that listens to race-team radio audio, transcribes it, detects the driver's emotional/stress state from their **tone of voice** (not the words), and shows whether stress correlates with slower lap times. Team engineers are watching data, not listening carefully to tone — this tool catches what they miss.

Output per clip: transcript text, a mood label (`Calm` / `Stressed` / `Tired`), and a lap-time chart showing whether stress lines up with performance.

## 2. The one rule that decides whether this wins or blends in

**Mood detection MUST come from the audio waveform (acoustic/prosodic signal), never primarily from the transcribed text.** Many competing teams will fake "tone detection" by running a text-sentiment model on the transcript — that misses the entire point of the challenge (the tone, not the words, is what gets missed). Every mood-detection code path in this project starts from the audio, not the transcript. Text may only ever be used as a small secondary disambiguator (see Tier 3) — never the primary signal, never weighted more than ~20%.

## 3. Hackathon compliance constraints (non-negotiable)

- Solution needs both a frontend and a backend, properly connected — no notebook-only or backend-only demo.
- Must use something from the Hugging Face Hub (a model, dataset, Space, or tool).
- Every team member needs their own individual Hugging Face account (reminder for the humans, not a code task).
- Aim for "balanced difficulty": don't just wrap one API call, and don't train a model from scratch. Chaining ASR + audio-emotion model + custom acoustic feature engineering + fusion logic satisfies this.

## 4. Tech stack

- **Backend**: Python 3.11, FastAPI, `transformers`, `librosa`, `scipy`, `noisereduce`, `datasets` (for HF Hub publish)
- **Frontend**: React (Vite), Tailwind CSS, Recharts (lap chart), wavesurfer.js (waveform, Tier 2)
- **Models** (all from Hugging Face Hub, loaded via `transformers`):
  - ASR: `openai/whisper-small`
  - Speech emotion recognition (primary): `superb/wav2vec2-base-superb-er`
- **Data**: bundled/synthetic lap-time CSV, or pulled via the free `fastf1` Python package

## 5. Priority tiers

### TIER 1 — Core MVP. Must work end-to-end before anything else.

**Backend:**
1. `POST /api/analyze` — multipart form, accepts an audio file + optional `lap_number` int. Response:
   ```json
   {
     "transcript": "string",
     "mood_label": "Calm | Stressed | Tired",
     "confidence": 0.0,
     "raw_emotion_class": "string",
     "acoustic_features": {
       "pitch_mean_hz": 0.0,
       "energy_rms": 0.0,
       "speaking_rate_wps": 0.0
     },
     "lap_number": null,
     "timestamp": "ISO8601 string"
   }
   ```
2. Load audio with `librosa.load(path, sr=16000, mono=True)` — both Whisper and the wav2vec2 SER model expect 16kHz mono.
3. Transcribe with `openai/whisper-small` via `transformers.pipeline("automatic-speech-recognition", ...)`.
4. Classify emotion with `superb/wav2vec2-base-superb-er` via `transformers.pipeline("audio-classification", ...)`. It returns 4 classes: `neu`, `hap`, `sad`, `ang`. Map to our 3 labels:
   | Model class | Our label |
   |---|---|
   | neu, hap | Calm |
   | ang | Stressed |
   | sad | Tired |
5. Extract acoustic features with `librosa`: mean pitch via `librosa.pyin`, RMS energy via `librosa.feature.rms`, speaking rate = (word count from transcript) / (audio duration in seconds).
6. `GET /api/laptimes` — returns `[{ "lap_number": int, "lap_time_seconds": float }]` from a bundled CSV.
7. Store each analyzed clip's result in memory/SQLite keyed by lap number so the frontend can correlate mood with lap time.

**Frontend:**
1. Upload or select a pre-loaded audio clip; play it back.
2. Show the transcript.
3. Show a color-coded mood badge: Calm = green, Stressed = red, Tired = amber.
4. Lap-time line chart (Recharts) with a marker at each analyzed clip's lap, colored by that clip's mood label.
5. Clean, uncluttered layout — this is a judged criterion on its own.

### TIER 2 — Add only after Tier 1 fully works and is tested.

**Backend:**
1. **Driver baseline calibration**: the first clip submitted in a session is treated as the "calm baseline" — store its mean/std for pitch and energy. Score all subsequent clips as a z-score relative to that baseline, not against a population average.
2. **Acoustic fusion rule** — this is your main technical differentiator, make it real and explainable:
   ```
   acoustic_arousal_z = 0.5 * z_pitch + 0.5 * z_energy
   if acoustic_arousal_z > 1.5 and ser_mapped_label != "Stressed":
       final_label = "Stressed"       # strong acoustic evidence overrides the classifier
       confidence = min(ser_confidence, 0.6)   # flag that this was an override
   else:
       final_label = ser_mapped_label
       confidence = ser_confidence
   ```
3. **Radio-channel preprocessing**: since real F1 radio audio is bandpass-filtered (~300Hz–3.4kHz) and has engine/wind noise, apply `scipy.signal.butter` bandpass filtering + the `noisereduce` package before running ASR/SER. This is a genuine improvement here because you're using real downloaded radio clips — verify it actually changes the transcript/mood output on at least one clip and mention that in the demo.
4. **Lap time delta + correlation**: compute lap time delta vs. a rolling target pace (not raw lap time — raw time is noisy from tire wear/traffic), and compute a simple Pearson correlation between stress incidence and lap time delta. Expose via `GET /api/correlation`. Label this in the UI as illustrative given the small sample size — don't oversell it as statistically rigorous.

**Frontend:**
1. Dark "pit-wall" theme: background `#0e1117`, Calm `#22c55e`, Stressed `#ef4444`, Tired `#f59e0b`, high-contrast monospace-leaning font for numbers.
2. Waveform display via wavesurfer.js under the transcript.
3. "Live race mode": a play button that steps through a queued sequence of clips automatically, updating transcript/mood/chart in real time — this recreates the actual problem scenario for the demo instead of just describing it.
4. Show the correlation stat prominently, framed as an example insight, not a certified statistic.

### TIER 3 — Optional stretch. Skip these first if time is short.

- Swap or ensemble in `ehcalabres/wav2vec2-lg-xlsr-en-speech-emotion-recognition` (8-class, includes an explicit "calm" label) alongside the primary model for a second opinion.
- Continuous arousal/valence/dominance model `audeering/wav2vec2-large-robust-12-ft-emotion-msp-dim` as an alternative to categorical classification (research-only license, fine for a hackathon).
- Text-based disambiguation: only to catch the specific known failure mode where high-energy positive speech ("great job!!") gets misread as anger by an audio-only model. If implemented, weight it low (≤20%) and never let it override on its own — frame it explicitly in the demo as "a small patch for one known blind spot," not a second detection channel. Do not implement this if it isn't clearly explained and demo-tested — a half-explained text-fusion step undermines the "we detect tone, not words" pitch.
- A rule-based "strategy alert" banner (e.g. "Stress detected — confirm pit strategy"). Present it modestly in the demo as an example of downstream use, not as real strategic AI.
- Match specific clips to real, known high-drama moments in actual F1 sessions via the `fastf1` package for narrative color.

## 6. Data & audio handling — follow exactly

- Real downloaded F1 radio audio is copyrighted broadcast content. Keep raw files in a local, **`.gitignore`'d** folder (e.g. `backend/data/live_demo_audio/`). Never commit them to the repo. Never upload them to the public Hugging Face dataset.
- The dataset you publish to Hugging Face Hub (satisfying the HF requirement in a way that stands out) must contain **only content the team created or owns**: e.g. any team-recorded reference clips, the synthetic/bundled lap-time CSV, baseline calibration stats, README describing the schema. Use `datasets.push_to_hub("your-team/silent-co-driver-demo-data")`.
- Real F1 radio clips are used only live, at runtime, during the demo — never redistributed.
- If you pull real lap times via `fastf1`, that's fine to include in the published dataset — it's derived timing data, not the broadcast audio itself.

## 7. Suggested repo structure

```
silent-co-driver/
├── backend/
│   ├── app/
│   │   ├── main.py
│   │   ├── routes/
│   │   │   ├── analyze.py
│   │   │   ├── laptimes.py
│   │   │   └── correlation.py        # Tier 2
│   │   ├── services/
│   │   │   ├── asr.py
│   │   │   ├── emotion.py
│   │   │   ├── acoustic_features.py
│   │   │   ├── baseline.py           # Tier 2
│   │   │   └── audio_preprocessing.py # Tier 2 — bandpass/noise reduction
│   │   └── models/schemas.py
│   ├── data/
│   │   ├── laptimes.csv
│   │   ├── demo_clips/               # original team-created clips — safe to commit
│   │   └── live_demo_audio/          # real F1 radio — gitignored, local only
│   ├── requirements.txt
│   └── .gitignore
├── frontend/
│   ├── src/
│   │   ├── App.jsx
│   │   ├── components/
│   │   │   ├── AudioUploader.jsx
│   │   │   ├── Waveform.jsx          # Tier 2
│   │   │   ├── TranscriptPanel.jsx
│   │   │   ├── MoodBadge.jsx
│   │   │   ├── LapTimeChart.jsx
│   │   │   └── LiveRaceMode.jsx      # Tier 2
│   │   └── api/client.js
│   ├── tailwind.config.js
│   └── package.json
├── scripts/
│   └── publish_hf_dataset.py
└── README.md
```

## 8. Definition of done for the MVP demo

- [ ] Upload/select a real audio clip → get back a transcript + mood label, working live in the browser
- [ ] Lap-time chart renders with mood-colored markers, sourced from the backend
- [ ] Frontend and backend are actually wired together — no mocked responses in the final build
- [ ] Original team-created dataset published to Hugging Face Hub and linked in the README
- [ ] Every team member's Hugging Face account is confirmed set up
- [ ] `.gitignore` confirmed to exclude the real downloaded radio audio folder
- [ ] Live race mode (Tier 2) runs through at least 3 clips in sequence without manual intervention, if implemented

## 9. Explicitly out of scope — do not build

- Real-time streaming audio (batch/upload-based analysis only)
- User accounts or authentication
- Production-grade error handling — keep it hackathon-appropriate, don't over-invest here
- Mobile-responsive design beyond basic usability
