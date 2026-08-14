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
from backend.load_real_2021_abudhabi import ABU_DHABI_2021_MESSAGES

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
    }
] + ABU_DHABI_2021_MESSAGES

def copy_real_audio_file(filename: str, fallback_mp3: str = "f1_team_radio_mp3s/radio_00007.mp3"):
    """Copies genuine audio file from dataset for demo highlights."""
    filepath = os.path.join(STATIC_AUDIO_DIR, filename)
    if not os.path.exists(filepath):
        if os.path.exists(fallback_mp3):
            shutil.copyfile(fallback_mp3, filepath)
        elif os.path.exists("for_what.mp3"):
            shutil.copyfile("for_what.mp3", filepath)

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

        audio_filename = f"{msg['id']}.wav"
        copy_real_audio_file(audio_filename)
        msg['audio_filename'] = audio_filename

        save_message(msg)

    # Save races metadata
    for msg in DEMO_HIGHLIGHT_MESSAGES:
        save_race(msg['race_id'], msg['grand_prix'], msg['year'], msg['session_date'], races_summary[msg['race_id']])
        save_driver(msg['driver_id'], msg['race_id'], msg['racing_number'], msg['driver_code'], drivers_summary[(msg['driver_id'], msg['race_id'])])

    # Map genuine audios for all 2018 demo clips
    try:
        from backend.map_real_audios import find_and_copy_real_audios
        find_and_copy_real_audios()
    except Exception as e:
        print(f"[Processor] Map real audios warning: {e}")

    # Ingest Real FastF1 Lap Telemetry & Expanded Clips for 2021 Abu Dhabi Grand Prix
    try:
        from backend.load_real_2021_abudhabi import load_and_ingest_real_2021_abudhabi
        load_and_ingest_real_2021_abudhabi()
        from backend.ingest_expanded_2021 import ingest_expanded
        ingest_expanded()
    except Exception as e:
        print(f"[Processor] FastF1 2021 Abu Dhabi load warning: {e}")

    # Generate full race lap timing curves for 2018 Australia
    for drv_code, base_lap_time in [("RIC", 87.2), ("HAM", 86.8), ("VER", 87.0), ("RAI", 87.5)]:
        laps_list = []
        for lap in range(1, 59):
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
        save_laps("2018_Australian_Grand_Prix", drv_code, laps_list)

    print("[Processor] Dataset successfully loaded into SQLite!")

def process_hf_dataset_batch(max_rows: int = 100):
    from backend.dataset_loader import get_hf_dataset, export_audio_to_file
    ds = get_hf_dataset()
    if ds is None:
        print("[Processor] Skipping HF live stream, dataset offline or downloading.")
        return

    processed_count = 0
    print(f"[Processor] Processing batch of {max_rows} clips from MikCil/f1-team-radio...")
    
    for row in ds:
        if processed_count >= max_rows:
            break
            
        try:
            sample_id = row.get("id") or f"hf_{processed_count}"
            raw_audio = row.get("audio")
            ground_truth = row.get("transcript") or row.get("text") or ""
            
            if not raw_audio or not ground_truth:
                continue

            audio_filename = f"{sample_id}.wav"
            local_audio_path = os.path.join(STATIC_AUDIO_DIR, audio_filename)
            
            if not os.path.exists(local_audio_path):
                export_audio_to_file(raw_audio, local_audio_path)
            
            stt_result = transcribe_audio(local_audio_path)
            whisper_text = stt_result["text"]
            wer_score = compute_wer(ground_truth, whisper_text)
            
            emotion_result = analyze_stress_and_emotion(local_audio_path)
            
            grand_prix = row.get("grand_prix") or "2018 Australian Grand Prix"
            year = row.get("year") or 2018
            driver_id = row.get("driver_id") or "MAXVER01"
            racing_number = row.get("racing_number") or "33"
            driver_code = get_driver_code(driver_id)
            race_id = f"{year}_{grand_prix.replace(' ', '_')}"
            
            msg_data = {
                "id": sample_id,
                "race_id": race_id,
                "grand_prix": grand_prix,
                "year": year,
                "driver_id": driver_id,
                "racing_number": racing_number,
                "driver_code": driver_code,
                "session_date": f"{year}-03-25",
                "message_timestamp": row.get("timestamp") or f"{year}-03-25T05:30:00.000Z",
                "ground_truth_transcript": ground_truth,
                "whisper_transcript": whisper_text,
                "wer": wer_score,
                "arousal": emotion_result["arousal"],
                "dominance": emotion_result["dominance"],
                "valence": emotion_result["valence"],
                "mood_label": emotion_result["mood_label"],
                "lap_number": None,
                "lap_time_seconds": None,
                "duration": emotion_result["duration"],
                "audio_filename": audio_filename
            }
            
            save_message(msg_data)
            processed_count += 1
            
        except Exception as e:
            print(f"[Processor] Error processing HF row {processed_count}: {e}")
            continue

    print(f"[Processor] Completed processing {processed_count} clips into SQLite!")
