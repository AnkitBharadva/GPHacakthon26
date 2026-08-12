# The Silent Co-Driver — Build Brief

> How to use this file: paste this whole document into your coding assistant (Claude Code, Cursor, etc.) as the task brief, or use it as your team's shared spec. Every fact about the dataset and models below was verified against the live Hugging Face dataset page and model cards / library docs — treat the numbers and IDs as ground truth, not as placeholders to swap out casually.

## 1. What we're building

A tool that takes real Formula 1 driver radio audio, transcribes it, scores the driver's vocal stress/fatigue, and lines that up against lap times — so an engineer can see, at a glance, whether a driver sounding stressed correlates with them losing pace.

**Deliverable shape (mandatory):** a frontend (upload/play audio, see transcript + mood + chart) talking to a backend (does the actual STT + stress inference + lap alignment). Not a notebook. Not a single API call wrapping one model — we combine a real HF dataset, two real HF models, and logic the team writes and can defend.

## 2. Primary dataset: `MikCil/f1-team-radio`

Hugging Face: https://huggingface.co/datasets/MikCil/f1-team-radio

### 2.1 Facts (verified from the dataset viewer, not assumed)

| Fact | Value |
|---|---|
| Rows | 14,700 (14.7k), single `train` split |
| Format on disk | Parquet (auto-converted; also readable via `datasets` streaming) |
| License | **CC-BY-4.0** — you must credit the dataset in your README/demo, not just use it silently |
| Modalities | Audio + Text |
| Language | English |
| Distinct drivers (`driver_id`) | 43 |
| Distinct races (`grand_prix` / `race_id`) | 149 |
| Date range (`session_date`) | 2018-03-25 → 2025-12-07 |
| Audio clip duration | **0.05s to 256s** — huge range, see §2.3 |
| Transcription length | 3 to 3,430 characters |

### 2.2 Exact column schema

| Column | Type | Notes |
|---|---|---|
| `id` | string | Composite key, e.g. `2018_Australian_Grand_Prix_DANRIC01_3_20180325_165106` — race + driver_id + car number + date + time |
| `driver_id` | string (43 classes) | 8-char code: first 3 letters of first name + first 3 letters of surname + `01`. See §3.2 — this encodes the FastF1/FIA 3-letter driver code inside it. |
| `racing_number` | string (43 values) | The driver's car number that race |
| `grand_prix` | string (149 values) | Human-readable, e.g. `"2018 Australian Grand Prix"` |
| `race_id` | string (149 values) | Underscored version, e.g. `"2018_Australian_Grand_Prix"` |
| `session_date` | date | Just the calendar date of the session |
| `message_timestamp` | datetime string, UTC, `Z`-suffixed, sub-second precision | e.g. `"2018-03-25T05:14:31.022Z"` — this is your join key against lap timing data |
| `audio` | HF `Audio` feature (mp3-backed) | Decodes to `{array, sampling_rate}` when accessed through `datasets`. **Do not hardcode the signed CDN URLs you see in the dataset viewer** — they contain an `Expires=` query param and go dead within hours. Always load via the `datasets` library. |
| `transcription` | string | **Ground-truth human transcript, already provided.** This is a gift — see §5.1, use it to score your ASR instead of trusting it blindly. |

### 2.3 Data quality quirks you need to handle, not ignore

- **Duration range 0.05s–256s.** A 0.05s clip is essentially nothing (probably a clipped/near-empty recording) and a 256s (4+ minute) clip is likely a long strategy briefing or several messages concatenated. Add a filtering/bucketing step:
  - Clips `< 0.3s`: exclude from stress scoring (not enough signal), still show transcript if present.
  - Clips `> 30–45s`: the dimensional emotion model (§5.2) was not built for minutes-long input — chunk into ~10s windows and aggregate (e.g. mean arousal/valence), or just score the first N seconds and note it's a partial score in the UI.
- **No stress/emotion labels exist in this dataset.** You cannot train a supervised stress classifier on `f1-team-radio` — there is nothing to train against. This is exactly why §5.2 uses a pretrained dimensional model plus a threshold you design, not a from-scratch classifier.
- **No lap time data in this dataset.** `f1-team-radio` gives you audio, transcript, driver, race, and timestamp — nothing about lap number or lap time. You need a second data source; see §3.
- **No explicit session-type column.** The transcripts (`"box box"`, `"DRS enabled"`, `"safety car is in this lap"`) strongly suggest this is race-session radio only, not qualifying/practice, but there's no field that confirms it. **Assumption to state explicitly in your README:** you're treating every row as race-session radio and joining against the Race (`'R'`) session in FastF1. Flag this as an assumption, don't silently bake it in.

### 2.4 Loading it correctly

```python
from datasets import load_dataset, Audio

ds = load_dataset("MikCil/f1-team-radio", split="train")

# Resample to 16kHz for Whisper / wav2vec2 — check native rate first
print(ds.features["audio"])
ds = ds.cast_column("audio", Audio(sampling_rate=16000))

row = ds[0]
audio_array = row["audio"]["array"]
sr = row["audio"]["sampling_rate"]
transcript_ground_truth = row["transcription"]
```

### 2.5 Representative rows (for schema sanity-checking, not exhaustive)

| driver_id | grand_prix | duration-ish | transcription (paraphrased sense, not verbatim) |
|---|---|---|---|
| `KIMRAI01` | 2018 Australian Grand Prix | short | Formation-lap procedural reminder (tyre mode, start sequence) |
| `DANRIC01` | 2018 Australian Grand Prix | short | Urgent hazard call — yellow flag at turn 1, a competitor stopped |
| `MAXVER01` | 2018 Australian Grand Prix | medium | Two-way exchange about tyre temperatures and pace adjustment |
| `LEWHAM01` | 2018 Australian Grand Prix | medium | Technical warning — power unit over-temperature, needs lift-and-coast |

Use rows like the `DANRIC01` yellow-flag one and the `LEWHAM01` PU-temperature one as your demo highlight clips — they're the kind of "you can *hear* the tension" moments that make the stress-detection branch land with judges.

## 3. Secondary data source: lap times (FastF1)

`f1-team-radio` has no lap times, so pull them separately and join on timestamp.

### 3.1 Why FastF1

- Free, open-source Python library, actively maintained.
- **Lap timing and telemetry data is available from the 2018 season onward** — which lines up with this dataset's 2018–2025 range almost exactly (double-check coverage for the very newest 2025 races, which may lag slightly behind live sessions).
- Returns pandas DataFrames — easy to merge with your HF dataset once loaded into pandas too.

```python
import fastf1

fastf1.Cache.enable_cache("fastf1_cache")  # avoid re-downloading every run, sessions can be 50-100MB

session = fastf1.get_session(2018, "Australian Grand Prix", "R")  # 'R' = Race
session.load(laps=True)

laps = session.laps
laps.pick_driver("RIC")  # 3-letter FIA code — see §3.2 for the mapping
```

Relevant columns on `session.laps`: `LapNumber`, `LapTime` (a `Timedelta`), `Driver` (3-letter code), `Time` (session-relative timestamp when the lap was completed), `PitInTime`, `PitOutTime`.

### 3.2 Mapping `driver_id` → FastF1's 3-letter code

Verified against multiple rows in the dataset: **characters 4–6 of `driver_id` (0-indexed slice `driver_id[3:6]`) equal the FastF1 driver code.**

| `driver_id` | Implied name | `driver_id[3:6]` | FastF1 code |
|---|---|---|---|
| `MAXVER01` | Max Verstappen | `VER` | `VER` ✓ |
| `LEWHAM01` | Lewis Hamilton | `HAM` | `HAM` ✓ |
| `DANRIC01` | Daniel Ricciardo | `RIC` | `RIC` ✓ |
| `SEBVET01` | Sebastian Vettel | `VET` | `VET` ✓ |
| `KIMRAI01` | Kimi Räikkönen | `RAI` | `RAI` ✓ |
| `CARSAI01` | Carlos Sainz | `SAI` | `SAI` ✓ |
| `SERPER01` | Sergio Pérez | `PER` | `PER` ✓ |
| `FERALO01` | Fernando Alonso | `ALO` | `ALO` ✓ |

This held across every row spot-checked. **Still, validate it programmatically against FastF1's own driver info for each session before shipping** — don't hardcode a static lookup table, derive it, and have a fallback (e.g. fuzzy-match on session driver list) for any code that doesn't resolve.

### 3.3 Mapping `grand_prix` → FastF1 event query

`grand_prix` is `"{year} {Event Name}"` (e.g. `"2018 Australian Grand Prix"`). `fastf1.get_session()` takes `(year, event_identifier, session)` and does reasonably fuzzy matching on event name — strip the leading year and pass the rest, with the year taken from `session_date`. Wrap this in a try/except and log failures; not every historical event name will resolve cleanly on the first try (country vs. city naming, sprint-weekend naming, etc.).

## 4. Architecture

```
Radio audio clip ─┬─→ Noise cleanup → Whisper (STT) ──────────────┐
                   └─→ WavLM-based dimensional model (stress) ─────┤
                                                                    ↓
Race data (FastF1 lap times) ──────────────────────→ Timestamp/lap alignment → Dashboard
```

Two branches off the same audio, one branch off the FastF1 side, all three merge into one aligned table that the frontend renders.

## 5. Models

### 5.1 Speech-to-text: `openai/whisper-base` (or `whisper-small` if latency allows)

- Standard HF/OpenAI Whisper checkpoint, `language="en"` since the dataset is confirmed English-only.
- **Because `f1-team-radio` already ships ground-truth transcripts**, don't just display Whisper's output and hope — compute Word Error Rate (WER) against `transcription` on a held-out sample (50–100 clips is plenty). This gives you a real, defensible number for the demo ("our pipeline hits X% WER on real, noisy F1 radio audio, including domain vocabulary like 'DRS', 'box box', 'K1/K2'"). Use the `jiwer` package for WER.
- F1 radio has heavy domain vocabulary (box box, DRS, safety car, virtual safety car, tyre compounds, engine modes like "K1"/"K2") that generic Whisper may mangle — this is worth calling out explicitly in your presentation as a known limitation, and is a legitimate area to note as future work (a small custom vocabulary/prompt-biasing pass).

### 5.2 Stress/fatigue detection: `audeering/wav2vec2-large-robust-12-ft-emotion-msp-dim`

- HF Hub: https://huggingface.co/audeering/wav2vec2-large-robust-12-ft-emotion-msp-dim
- Fine-tuned Wav2Vec2-Large-Robust on the MSP-Podcast dataset for **dimensional** speech emotion recognition. Input: raw audio signal. Output: **arousal, dominance, valence**, each roughly in the 0–1 range.
- **Why this instead of a categorical emotion model** (e.g. one trained on RAVDESS/CREMA-D happy/angry/sad/fear): those datasets are *acted* emotions and don't map cleanly onto "Calm / Stressed / Tired." Arousal and valence do — that mapping is real psychological research (arousal = energy/activation, valence = pleasantness), not something invented for this project.
- **Your team's actual contribution is the threshold logic**, e.g.:
  - `arousal > 0.6` and `valence < 0.4` → **Stressed**
  - `arousal < 0.4` and `valence < 0.55` → **Tired**
  - otherwise → **Calm**
  - These exact cutoffs are starting points — tune them by ear against 20–30 real clips before the demo (this is your "iteration" story for the write-up).
- **No ground truth exists for this task in this dataset**, so validation is manual: listen to a sample, sanity-check the label makes sense, adjust thresholds. Say this openly in your presentation rather than implying it's been quantitatively validated — it hasn't, and pretending otherwise is the kind of thing that falls apart under a judge's question.
- **v2 iteration (if time allows):** swap the fixed backbone for `microsoft/wavlm-base-plus` embeddings feeding a small trained BiLSTM + attention + linear classifier head — this was your original sketch and is a legitimate "we improved on our first version" story, but is not required for a working v1.

## 6. Preprocessing pipeline

1. Load the row's audio via `datasets` (§2.4), already resampled to 16kHz.
2. Duration gate: `<0.3s` → skip stress scoring, still transcribe if possible; `>30–45s` → chunk (§2.3).
3. Light noise reduction (spectral gating — the `noisereduce` Python package is a reasonable, fast default) before both branches. Be conservative: F1 radio already has heavy engine/wind noise baked into the source recording, and aggressive denoising can eat the vocal signal on very short clips.
4. Feed the cleaned audio into both Whisper and the emotion model in parallel (they don't depend on each other).

## 7. Lap-time alignment logic

1. For each `driver_id` + `race_id`, resolve the FastF1 3-letter code (§3.2) and load that session's laps (§3.1), cached locally so you're not re-fetching on every run.
2. Convert `message_timestamp` (absolute UTC) and the session's `Time` column (session-relative) onto a common axis — FastF1 sessions expose a session start reference you can use to convert one to the other; if this proves fiddly, session-relative offset in seconds from the first radio message of that race is an acceptable simplification for a hackathon demo.
3. For each radio message, find the lap whose time window contains (or is nearest to) the message timestamp → attach `LapNumber` and `LapTime`.
4. Store the joined result as one row per radio message: `{id, driver_id, race_id, lap_number, lap_time_seconds, transcript, arousal, valence, dominance, mood_label}`.
5. **Known edge cases to handle, not crash on:** messages during a safety car period (lap times are inflated — the UI should probably flag these laps rather than let them read as "the driver just got way faster/slower"), messages with no resolvable lap (formation lap, post-race), and races where FastF1 fails to resolve the event name (§3.3) — skip and log, don't hard-fail the whole batch.

## 8. Backend

- Suggested stack: Python, FastAPI. Cache computed results (transcript + mood + lap join) in SQLite or a parquet file keyed by `id` — you do not want to re-run Whisper + the emotion model on every page load.
- Minimum endpoints:
  - `GET /races` — list of `race_id`/`grand_prix` available
  - `GET /races/{race_id}/drivers` — drivers with radio messages in that race
  - `GET /races/{race_id}/drivers/{driver_id}/messages` — the joined table from §7, one row per message
  - `POST /audio/upload` — accept a user-uploaded clip, run it through both models, return transcript + mood (no lap join, since it's not from the dataset)

## 9. Frontend

- Race + driver picker → loads the joined message table.
- Audio player per message (or upload panel for the "bring your own clip" path from the original brief).
- Transcript panel next to a mood badge (color-coded: calm / stressed / tired) with the underlying arousal/valence numbers visible on hover/click for anyone who wants to check your work.
- Lap-time line chart for the selected driver/race, points colored by the mood label of the nearest radio message — this chart *is* the answer to "is stress affecting lap performance," make sure it's the centerpiece of the demo, not an afterthought.

## 10. Hugging Face general-rule compliance

- Dataset: `MikCil/f1-team-radio` (real HF dataset, CC-BY-4.0, credit it).
- Model 1: `openai/whisper-base` (or `whisper-small`).
- Model 2: `audeering/wav2vec2-large-robust-12-ft-emotion-msp-dim`.
- This is a combination of a pretrained ASR model, a pretrained dimensional emotion model, and logic your team writes (thresholding, chunking, lap alignment) — satisfies "not a single ready-made tool call" without requiring you to train a model from scratch, which satisfies the other side of the balance rule.
- Every team member needs their own individual Hugging Face account (separate from which account actually hosts any Space you deploy).

## 11. Build order (suggested milestones)

1. Load the dataset, confirm audio decodes, pick 5–10 clips spanning the duration extremes to sanity-check.
2. Get Whisper transcribing a handful of clips; compute WER against ground truth on ~50 clips.
3. Get the emotion model producing arousal/valence/dominance on the same clips; hand-pick thresholds by listening.
4. Get FastF1 pulling laps for one race (`2018, "Australian Grand Prix", "R"` is a good first test since it's the first race in the dataset); confirm the driver-code mapping resolves.
5. Build the join for one race/driver end-to-end; verify against the demo highlight clips (§2.5).
6. Wire up the backend endpoints, then the frontend against real (not mocked) backend responses.
7. Batch-process a small slice of the dataset (one or two full races) ahead of the demo so the UI has real data to browse without live-processing lag; keep the live-upload path working for the "wow" moment of processing a fresh clip on stage.

## 12. Open questions to resolve as a team (don't guess silently)

- Confirm the "race-session-only" assumption (§2.3) holds for the races you demo, by spot-listening to a few clips per race.
- Decide the exact stress/tired threshold values (§5.2) — bring headphones and 30 minutes of listening before locking these in.
- Confirm FastF1 coverage for whichever specific races you plan to demo, especially anything from very late 2025 (§3.1) — pick an older, well-covered race (2018–2022) for your primary demo race to avoid coverage surprises on stage.
