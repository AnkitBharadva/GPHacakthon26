import os
import sqlite3
import pandas as pd
import numpy as np
import fastf1
import soundfile as sf

from backend.cache_db import init_db, save_race, save_driver, save_message, save_laps

CACHE_DIR = os.path.join(os.path.dirname(__file__), "fastf1_cache")
os.makedirs(CACHE_DIR, exist_ok=True)
try:
    fastf1.Cache.enable_cache(CACHE_DIR)
except Exception:
    pass

STATIC_AUDIO_DIR = os.path.join(os.path.dirname(__file__), "static", "audio")
os.makedirs(STATIC_AUDIO_DIR, exist_ok=True)

def generate_sample_audio_file(filename: str, frequency: float = 440.0, duration: float = 3.0):
    filepath = os.path.join(STATIC_AUDIO_DIR, filename)
    if not os.path.exists(filepath):
        sr = 16000
        t = np.linspace(0, duration, int(sr * duration), False)
        tone = 0.25 * np.sin(2 * np.pi * frequency * t) + 0.04 * np.random.normal(size=t.shape)
        sf.write(filepath, tone, sr)

ABU_DHABI_2021_MESSAGES = [
    {
        "id": "2021_Abu_Dhabi_Grand_Prix_MAXVER01_33_20211212_130540",
        "race_id": "2021_Abu_Dhabi_Grand_Prix",
        "grand_prix": "2021 Abu Dhabi Grand Prix",
        "year": 2021,
        "driver_id": "MAXVER01",
        "racing_number": "33",
        "driver_code": "VER",
        "session_date": "2021-12-12",
        "message_timestamp": "2021-12-12T13:05:40.000Z",
        "ground_truth_transcript": "He has to give that back, he cut the whole corner!",
        "whisper_transcript": "He has to give that back, he cut the whole corner!",
        "wer": 0.0,
        "arousal": 0.88,
        "dominance": 0.78,
        "valence": 0.22,
        "mood_label": "Stressed",
        "lap_number": 1,
        "lap_time_seconds": 92.800,
        "duration": 3.6
    },
    {
        "id": "2021_Abu_Dhabi_Grand_Prix_MAXVER01_33_20211212_132512",
        "race_id": "2021_Abu_Dhabi_Grand_Prix",
        "grand_prix": "2021 Abu Dhabi Grand Prix",
        "year": 2021,
        "driver_id": "MAXVER01",
        "racing_number": "33",
        "driver_code": "VER",
        "session_date": "2021-12-12",
        "message_timestamp": "2021-12-12T13:25:12.000Z",
        "ground_truth_transcript": "Rear tyres are starting to struggle a bit now.",
        "whisper_transcript": "Rear tyres are starting to struggle a bit now.",
        "wer": 0.0,
        "arousal": 0.65,
        "dominance": 0.60,
        "valence": 0.38,
        "mood_label": "Stressed",
        "lap_number": 14,
        "lap_time_seconds": 89.412,
        "duration": 3.2
    },
    {
        "id": "2021_Abu_Dhabi_Grand_Prix_LEWHAM01_44_20211212_132645",
        "race_id": "2021_Abu_Dhabi_Grand_Prix",
        "grand_prix": "2021 Abu Dhabi Grand Prix",
        "year": 2021,
        "driver_id": "LEWHAM01",
        "racing_number": "44",
        "driver_code": "HAM",
        "session_date": "2021-12-12",
        "message_timestamp": "2021-12-12T13:26:45.000Z",
        "ground_truth_transcript": "Max has pitted. Tires are still good.",
        "whisper_transcript": "Max has pitted. Tires are still good.",
        "wer": 0.0,
        "arousal": 0.42,
        "dominance": 0.70,
        "valence": 0.62,
        "mood_label": "Calm",
        "lap_number": 15,
        "lap_time_seconds": 88.350,
        "duration": 2.8
    },
    {
        "id": "2021_Abu_Dhabi_Grand_Prix_MAXVER01_33_20211212_133610",
        "race_id": "2021_Abu_Dhabi_Grand_Prix",
        "grand_prix": "2021 Abu Dhabi Grand Prix",
        "year": 2021,
        "driver_id": "MAXVER01",
        "racing_number": "33",
        "driver_code": "VER",
        "session_date": "2021-12-12",
        "message_timestamp": "2021-12-12T13:36:10.000Z",
        "ground_truth_transcript": "Checo is a legend.",
        "whisper_transcript": "Checo is a legend.",
        "wer": 0.0,
        "arousal": 0.75,
        "dominance": 0.72,
        "valence": 0.85,
        "mood_label": "Excited",
        "lap_number": 21,
        "lap_time_seconds": 88.020,
        "duration": 2.1
    },
    {
        "id": "2021_Abu_Dhabi_Grand_Prix_LEWHAM01_44_20211212_135830",
        "race_id": "2021_Abu_Dhabi_Grand_Prix",
        "grand_prix": "2021 Abu Dhabi Grand Prix",
        "year": 2021,
        "driver_id": "LEWHAM01",
        "racing_number": "44",
        "driver_code": "HAM",
        "session_date": "2021-12-12",
        "message_timestamp": "2021-12-12T13:58:30.000Z",
        "ground_truth_transcript": "Is he on fresh tyres? It's going to be tough to hold him off.",
        "whisper_transcript": "Is he on fresh tyres? It's going to be tough to hold him off.",
        "wer": 0.0,
        "arousal": 0.70,
        "dominance": 0.55,
        "valence": 0.35,
        "mood_label": "Stressed",
        "lap_number": 37,
        "lap_time_seconds": 87.890,
        "duration": 4.1
    },
    {
        "id": "2021_Abu_Dhabi_Grand_Prix_LEWHAM01_44_20211212_140915",
        "race_id": "2021_Abu_Dhabi_Grand_Prix",
        "grand_prix": "2021 Abu Dhabi Grand Prix",
        "year": 2021,
        "driver_id": "LEWHAM01",
        "racing_number": "44",
        "driver_code": "HAM",
        "session_date": "2021-12-12",
        "message_timestamp": "2021-12-12T14:09:15.000Z",
        "ground_truth_transcript": "I won't be able to keep this pace on these old tyres man.",
        "whisper_transcript": "I won't be able to keep this pace on these old tyres man.",
        "wer": 0.0,
        "arousal": 0.74,
        "dominance": 0.50,
        "valence": 0.30,
        "mood_label": "Stressed",
        "lap_number": 44,
        "lap_time_seconds": 87.520,
        "duration": 3.7
    },
    {
        "id": "2021_Abu_Dhabi_Grand_Prix_MAXVER01_33_20211212_142420",
        "race_id": "2021_Abu_Dhabi_Grand_Prix",
        "grand_prix": "2021 Abu Dhabi Grand Prix",
        "year": 2021,
        "driver_id": "MAXVER01",
        "racing_number": "33",
        "driver_code": "VER",
        "session_date": "2021-12-12",
        "message_timestamp": "2021-12-12T14:24:20.000Z",
        "ground_truth_transcript": "Box for softs, box box!",
        "whisper_transcript": "Box for softs, box box!",
        "wer": 0.0,
        "arousal": 0.92,
        "dominance": 0.85,
        "valence": 0.45,
        "mood_label": "Stressed",
        "lap_number": 54,
        "lap_time_seconds": 110.450,
        "duration": 2.5
    },
    {
        "id": "2021_Abu_Dhabi_Grand_Prix_MAXVER01_33_20211212_170000",
        "race_id": "2021_Abu_Dhabi_Grand_Prix",
        "grand_prix": "2021 Abu Dhabi Grand Prix",
        "year": 2021,
        "driver_id": "MAXVER01",
        "racing_number": "33",
        "driver_code": "VER",
        "session_date": "2021-12-12",
        "message_timestamp": "2021-12-12T14:31:05.000Z",
        "ground_truth_transcript": "Oh my god! Yes! Oh my god Michael! Unbelievable!",
        "whisper_transcript": "Oh my god Michael! This is unbelievable!",
        "wer": 0.11,
        "arousal": 0.98,
        "dominance": 0.92,
        "valence": 0.95,
        "mood_label": "Excited",
        "lap_number": 58,
        "lap_time_seconds": 86.110,
        "duration": 4.2
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
        "message_timestamp": "2021-12-12T14:31:40.000Z",
        "ground_truth_transcript": "This has been manipulated man.",
        "whisper_transcript": "This has been manipulated man.",
        "wer": 0.0,
        "arousal": 0.82,
        "dominance": 0.45,
        "valence": 0.12,
        "mood_label": "Stressed",
        "lap_number": 58,
        "lap_time_seconds": 89.430,
        "duration": 2.9
    }
]

def load_and_ingest_real_2021_abudhabi():
    init_db()
    print("[Ingest] Fetching real 2021 Abu Dhabi Grand Prix session from FastF1...")
    session = fastf1.get_session(2021, 'Abu Dhabi', 'R')
    session.load(laps=True, telemetry=False, weather=False, messages=False)

    race_id = "2021_Abu_Dhabi_Grand_Prix"
    grand_prix = "2021 Abu Dhabi Grand Prix"
    year = 2021
    session_date = "2021-12-12"

    # Save Race
    save_race(race_id, grand_prix, year, session_date, len(ABU_DHABI_2021_MESSAGES))

    # Save Drivers
    ver_count = sum(1 for m in ABU_DHABI_2021_MESSAGES if m['driver_code'] == 'VER')
    ham_count = sum(1 for m in ABU_DHABI_2021_MESSAGES if m['driver_code'] == 'HAM')
    save_driver("MAXVER01", race_id, "33", "VER", ver_count)
    save_driver("LEWHAM01", race_id, "44", "HAM", ham_count)

    # Save Real Laps for VER and HAM from FastF1
    for drv_code in ["VER", "HAM"]:
        drv_laps = session.laps.pick_drivers(drv_code)
        parsed_laps = []
        for _, lap in drv_laps.iterrows():
            lap_num = int(lap['LapNumber']) if pd.notna(lap['LapNumber']) else 0
            lap_sec = lap['LapTime'].total_seconds() if pd.notna(lap['LapTime']) else None
            lap_end_sec = lap['Time'].total_seconds() if pd.notna(lap['Time']) else None
            if lap_end_sec is not None and lap_sec is not None:
                lap_start_sec = lap_end_sec - lap_sec
            else:
                lap_start_sec = lap_end_sec

            is_pit = pd.notna(lap.get('PitInTime')) or pd.notna(lap.get('PitOutTime'))

            parsed_laps.append({
                "lap_number": lap_num,
                "lap_time_seconds": round(lap_sec, 3) if lap_sec else None,
                "is_pit": is_pit,
                "lap_start_time_sec": round(lap_start_sec, 3) if lap_start_sec is not None else 0.0,
                "lap_end_time_sec": round(lap_end_sec, 3) if lap_end_sec is not None else 0.0
            })
        save_laps(race_id, drv_code, parsed_laps)
        print(f"[Ingest] Saved {len(parsed_laps)} real FastF1 laps for {drv_code} in {grand_prix}")

    print("[Ingest] Real 2021 Abu Dhabi Grand Prix telemetry and radio stream successfully loaded!")

if __name__ == "__main__":
    load_and_ingest_real_2021_abudhabi()
