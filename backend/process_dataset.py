import os
import json
import soundfile as sf
import numpy as np
from datetime import datetime, timedelta

from backend.cache_db import (
    init_db, save_race, save_driver, save_message, save_laps, get_all_races
)
from backend.stt_engine import transcribe_audio, compute_wer
from backend.emotion_engine import analyze_stress_and_emotion
from backend.fastf1_loader import get_driver_code, load_race_session_laps, extract_year_and_event
from backend.alignment import align_messages_with_laps

STATIC_AUDIO_DIR = os.path.join(os.path.dirname(__file__), "static", "audio")
os.makedirs(STATIC_AUDIO_DIR, exist_ok=True)

# Curated high-impact F1 driver radio highlight clips for instant demo
DEMO_HIGHLIGHT_MESSAGES = [
    {
        "id": "2018_Australian_Grand_Prix_DANRIC01_3_20180325_165106",
        "race_id": "2018_Australian_Grand_Prix",
        "grand_prix": "2018 Australian Grand Prix",
        "year": 2018,
        "driver_id": "DANRIC01",
        "racing_number": "3",
        "driver_code": "RIC",
        "session_date": "2018-03-25",
        "message_timestamp": "2018-03-25T05:14:31.022Z",
        "ground_truth_transcript": "Yellow flag turn 1 yellow flag! Car stopped on exit of 1.",
        "whisper_transcript": "Yellow flag turn 1 yellow flag! Car stopped on exit of 1.",
        "wer": 0.0,
        "arousal": 0.88,
        "dominance": 0.75,
        "valence": 0.22,
        "mood_label": "Stressed",
        "lap_number": 6,
        "lap_time_seconds": 88.450,
        "duration": 3.4
    },
    {
        "id": "2018_Australian_Grand_Prix_LEWHAM01_44_20180325_165312",
        "race_id": "2018_Australian_Grand_Prix",
        "grand_prix": "2018 Australian Grand Prix",
        "year": 2018,
        "driver_id": "LEWHAM01",
        "racing_number": "44",
        "driver_code": "HAM",
        "session_date": "2018-03-25",
        "message_timestamp": "2018-03-25T05:32:10.500Z",
        "ground_truth_transcript": "Engine temps are critical, lift and coast into turn 3 and 13.",
        "whisper_transcript": "Engine temp critical, lift and coast into turn 3 and 13.",
        "wer": 0.0909,
        "arousal": 0.72,
        "dominance": 0.60,
        "valence": 0.31,
        "mood_label": "Stressed",
        "lap_number": 18,
        "lap_time_seconds": 89.120,
        "duration": 4.8
    },
    {
        "id": "2018_Australian_Grand_Prix_MAXVER01_33_20180325_164500",
        "race_id": "2018_Australian_Grand_Prix",
        "grand_prix": "2018 Australian Grand Prix",
        "year": 2018,
        "driver_id": "MAXVER01",
        "racing_number": "33",
        "driver_code": "VER",
        "session_date": "2018-03-25",
        "message_timestamp": "2018-03-25T05:45:00.000Z",
        "ground_truth_transcript": "Rear tyres are overheating, losing traction out of turn 10.",
        "whisper_transcript": "Rear tyres overheating, losing traction out of turn 10.",
        "wer": 0.1111,
        "arousal": 0.65,
        "dominance": 0.68,
        "valence": 0.35,
        "mood_label": "Stressed",
        "lap_number": 26,
        "lap_time_seconds": 91.800,
        "duration": 5.1
    },
    {
        "id": "2018_Australian_Grand_Prix_KIMRAI01_7_20180325_160500",
        "race_id": "2018_Australian_Grand_Prix",
        "grand_prix": "2018 Australian Grand Prix",
        "year": 2018,
        "driver_id": "KIMRAI01",
        "racing_number": "7",
        "driver_code": "RAI",
        "session_date": "2018-03-25",
        "message_timestamp": "2018-03-25T05:05:00.000Z",
        "ground_truth_transcript": "Tyre warm up mode on, Copy.",
        "whisper_transcript": "Tyre warm up mode on, copy.",
        "wer": 0.0,
        "arousal": 0.35,
        "dominance": 0.40,
        "valence": 0.50,
        "mood_label": "Calm",
        "lap_number": 1,
        "lap_time_seconds": 95.300,
        "duration": 2.2
    },
    {
        "id": "2018_Australian_Grand_Prix_DANRIC01_3_20180325_172000",
        "race_id": "2018_Australian_Grand_Prix",
        "grand_prix": "2018 Australian Grand Prix",
        "year": 2018,
        "driver_id": "DANRIC01",
        "racing_number": "3",
        "driver_code": "RIC",
        "session_date": "2018-03-25",
        "message_timestamp": "2018-03-25T06:12:00.000Z",
        "ground_truth_transcript": "Pace is good, gap to Vettel is 2.4 seconds, box box this lap.",
        "whisper_transcript": "Pace is good, gap to Vettel is 2.4 seconds, box box this lap.",
        "wer": 0.0,
        "arousal": 0.45,
        "dominance": 0.60,
        "valence": 0.65,
        "mood_label": "Calm",
        "lap_number": 42,
        "lap_time_seconds": 86.890,
        "duration": 4.5
    },
    {
        "id": "2018_Australian_Grand_Prix_LEWHAM01_44_20180325_174000",
        "race_id": "2018_Australian_Grand_Prix",
        "grand_prix": "2018 Australian Grand Prix",
        "year": 2018,
        "driver_id": "LEWHAM01",
        "racing_number": "44",
        "driver_code": "HAM",
        "session_date": "2018-03-25",
        "message_timestamp": "2018-03-25T06:30:00.000Z",
        "ground_truth_transcript": "Tires are feeling flat, I don't know if we can hold this pace.",
        "whisper_transcript": "Tires feeling flat, don't know if we can hold pace.",
        "wer": 0.1538,
        "arousal": 0.32,
        "dominance": 0.35,
        "valence": 0.42,
        "mood_label": "Tired",
        "lap_number": 52,
        "lap_time_seconds": 88.920,
        "duration": 4.2
    },
    # Additional 2021 Abu Dhabi Grand Prix highlights
    {
        "id": "2021_Abu_Dhabi_Grand_Prix_MAXVER01_33_20211212_170000",
        "race_id": "2021_Abu_Dhabi_Grand_Prix",
        "grand_prix": "2021 Abu Dhabi Grand Prix",
        "year": 2021,
        "driver_id": "MAXVER01",
        "racing_number": "33",
        "driver_code": "VER",
        "session_date": "2021-12-12",
        "message_timestamp": "2021-12-12T13:50:00.000Z",
        "ground_truth_transcript": "Oh my god Michael! This is unbelievable!",
        "whisper_transcript": "Oh my god Michael! This is unbelievable!",
        "wer": 0.0,
        "arousal": 0.95,
        "dominance": 0.85,
        "valence": 0.20,
        "mood_label": "Stressed",
        "lap_number": 57,
        "lap_time_seconds": 86.110,
        "duration": 3.8
    },
    {
        "id": "2021_Abu_Dhabi_Grand_Prix_LEWHAM01_44_20211212_170200",
        "race_id": "2021_Abu_Dhabi_Grand_Prix",
        "grand_prix": "2021 Abu Dhabi Grand Prix",
        "year": 2021,
        "driver_id": "LEWHAM01",
        "racing_number": "44",
        "driver_code": "HAM",
        "session_date": "2021-12-12",
        "message_timestamp": "2021-12-12T13:51:00.000Z",
        "ground_truth_transcript": "This has been manipulated man.",
        "whisper_transcript": "This has been manipulated man.",
        "wer": 0.0,
        "arousal": 0.78,
        "dominance": 0.40,
        "valence": 0.15,
        "mood_label": "Stressed",
        "lap_number": 58,
        "lap_time_seconds": 89.430,
        "duration": 2.9
    }
]

def generate_sample_audio_file(filename: str, frequency: float = 440.0, duration: float = 3.0):
    """Generates synthetic audio file for demo highlights if live dataset clip is absent."""
    filepath = os.path.join(STATIC_AUDIO_DIR, filename)
    if not os.path.exists(filepath):
        sr = 16000
        t = np.linspace(0, duration, int(sr * duration), False)
        # Create radio-filtered beep tone with subtle background noise
        tone = 0.3 * np.sin(2 * np.pi * frequency * t) + 0.05 * np.random.normal(size=t.shape)
        sf.write(filepath, tone, sr)

def populate_demo_data():
    """Populates the database with initial demo races, lap timings, and messages."""
    print("[Processor] Initializing database...")
    init_db()

    races_summary = {}
    drivers_summary = {}

    for msg in DEMO_HIGHLIGHT_MESSAGES:
        race_id = msg['race_id']
        races_summary[race_id] = races_summary.get(race_id, 0) + 1
        
        drv_key = (msg['driver_id'], race_id)
        drivers_summary[drv_key] = drivers_summary.get(drv_key, 0) + 1

        # Create sample audio file
        audio_filename = f"{msg['id']}.wav"
        generate_sample_audio_file(audio_filename, duration=msg['duration'])
        msg['audio_filename'] = audio_filename

        save_message(msg)

    # Save races metadata
    for msg in DEMO_HIGHLIGHT_MESSAGES:
        save_race(msg['race_id'], msg['grand_prix'], msg['year'], msg['session_date'], races_summary[msg['race_id']])
        save_driver(msg['driver_id'], msg['race_id'], msg['racing_number'], msg['driver_code'], drivers_summary[(msg['driver_id'], msg['race_id'])])

    # Generate full race lap timing curves for visualization
    for race_id, grand_prix in [("2018_Australian_Grand_Prix", "2018 Australian Grand Prix"), ("2021_Abu_Dhabi_Grand_Prix", "2021 Abu Dhabi Grand Prix")]:
        for drv_code, base_lap_time in [("RIC", 87.2), ("HAM", 86.8), ("VER", 87.0), ("RAI", 87.5)]:
            laps_list = []
            for lap in range(1, 59):
                # Add natural lap time variance + degradation + stress spike
                noise = np.random.normal(0, 0.4)
                deg = lap * 0.03
                pit = 1 if lap in (20, 40) else 0
                lap_time = base_lap_time + deg + noise + (22.0 if pit else 0.0)
                
                laps_list.append({
                    "lap_number": lap,
                    "lap_time_seconds": round(lap_time, 3),
                    "is_pit": pit,
                    "lap_start_time_sec": lap * 87.0,
                    "lap_end_time_sec": (lap + 1) * 87.0
                })
            save_laps(race_id, drv_code, laps_list)

    print("[Processor] Demo dataset successfully loaded into SQLite!")

def process_hf_dataset_batch(max_rows: int = 100):
    """
    Optional live Hugging Face dataset processing loop.
    Reads MikCil/f1-team-radio, runs Whisper + Wav2Vec2 + FastF1 alignment.
    """
    from backend.dataset_loader import get_hf_dataset, export_audio_to_file
    ds = get_hf_dataset()
    if ds is None:
        print("[Processor] Skipping HF live stream, dataset offline or downloading.")
        return

    print(f"[Processor] Processing up to {max_rows} rows from MikCil/f1-team-radio...")
    # Group by race
    races_processed = set()

    for idx, row in enumerate(ds):
        if idx >= max_rows:
            break

        row_id = row['id']
        driver_id = row['driver_id']
        grand_prix = row['grand_prix']
        race_id = row['race_id']
        racing_number = row['racing_number']
        session_date = str(row['session_date'])
        message_ts = str(row['message_timestamp'])
        gt_transcript = row['transcription']
        audio_dict = row['audio']

        driver_code = get_driver_code(driver_id)
        year, event_name = extract_year_and_event(grand_prix, session_date)

        # Export audio
        audio_filename = f"{row_id}.wav"
        export_audio_to_file(audio_dict, audio_filename)

        # Run STT + Emotion Inference
        audio_array = audio_dict['array']
        sr = audio_dict['sampling_rate']

        whisper_text = transcribe_audio(audio_array, sr)
        wer_val = compute_wer(gt_transcript, whisper_text)
        emotion_res = analyze_stress_and_emotion(audio_array, sr)

        msg_obj = {
            "id": row_id,
            "race_id": race_id,
            "grand_prix": grand_prix,
            "year": year,
            "driver_id": driver_id,
            "driver_code": driver_code,
            "racing_number": racing_number,
            "session_date": session_date,
            "message_timestamp": message_ts,
            "ground_truth_transcript": gt_transcript,
            "whisper_transcript": whisper_text,
            "wer": wer_val,
            "arousal": emotion_res['arousal'],
            "dominance": emotion_res['dominance'],
            "valence": emotion_res['valence'],
            "mood_label": emotion_res['mood_label'],
            "duration": emotion_res['duration'],
            "audio_filename": audio_filename,
            "lap_number": None,
            "lap_time_seconds": None
        }

        save_message(msg_obj)
        save_race(race_id, grand_prix, year, session_date, 1)
        save_driver(driver_id, race_id, racing_number, driver_code, 1)

        print(f"[{idx+1}/{max_rows}] Processed message {row_id} -> {emotion_res['mood_label']} (WER: {wer_val})")

if __name__ == "__main__":
    populate_demo_data()
