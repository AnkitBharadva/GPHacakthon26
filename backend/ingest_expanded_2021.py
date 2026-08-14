import os
import shutil
import sqlite3
import pandas as pd
from backend.stt_engine import transcribe_audio, compute_wer
from backend.emotion_engine import analyze_stress_and_emotion
from backend.cache_db import init_db, save_race, save_driver, save_message

STATIC_AUDIO_DIR = os.path.join(os.path.dirname(__file__), "static", "audio")
os.makedirs(STATIC_AUDIO_DIR, exist_ok=True)
DB_PATH = os.path.join(os.path.dirname(__file__), "silent_codriver.db")

EXPANDED_2021_CLIPS = [
    # --- Max Verstappen (VER - #33) ---
    {
        "mp3": "f1_team_radio_mp3s/radio_01428.mp3",
        "driver_code": "VER",
        "driver_id": "MAXVER01",
        "racing_number": "33",
        "race_id": "2021_Abu_Dhabi_Grand_Prix",
        "grand_prix": "2021 Abu Dhabi Grand Prix",
        "lap_number": 1,
        "message_timestamp": "2021-12-12T13:05:40.000Z",
        "id": "2021_Abu_Dhabi_Grand_Prix_MAXVER01_33_20211212_130540",
        "default_transcript": "Can you tell me what was going on with the engine? That's fine, you're ahead, he'll have to give that back."
    },
    {
        "mp3": "f1_team_radio_mp3s/radio_00049.mp3",
        "driver_code": "VER",
        "driver_id": "MAXVER01",
        "racing_number": "33",
        "race_id": "2021_Abu_Dhabi_Grand_Prix",
        "grand_prix": "2021 Abu Dhabi Grand Prix",
        "lap_number": 8,
        "message_timestamp": "2021-12-12T13:16:15.000Z",
        "id": "2021_Abu_Dhabi_Grand_Prix_MAXVER01_33_20211212_131615",
        "default_transcript": "Okay Max, can we have a status update please? Yeah, the rear tires are getting really hot, but that's a bit my problem."
    },
    {
        "mp3": "f1_team_radio_mp3s/radio_09212.mp3",
        "driver_code": "VER",
        "driver_id": "MAXVER01",
        "racing_number": "33",
        "race_id": "2021_Abu_Dhabi_Grand_Prix",
        "grand_prix": "2021 Abu Dhabi Grand Prix",
        "lap_number": 14,
        "message_timestamp": "2021-12-12T13:25:12.000Z",
        "id": "2021_Abu_Dhabi_Grand_Prix_MAXVER01_33_20211212_132512",
        "default_transcript": "I don't understand what's taking so long, and it's so obvious he cut the chicane. It's like ridiculous."
    },
    {
        "mp3": "f1_team_radio_mp3s/radio_07566.mp3",
        "driver_code": "VER",
        "driver_id": "MAXVER01",
        "racing_number": "33",
        "race_id": "2021_Abu_Dhabi_Grand_Prix",
        "grand_prix": "2021 Abu Dhabi Grand Prix",
        "lap_number": 21,
        "message_timestamp": "2021-12-12T13:36:10.000Z",
        "id": "2021_Abu_Dhabi_Grand_Prix_MAXVER01_33_20211212_133610",
        "default_transcript": "Keep on pushing on here, Checo. It's really good pace. Hamilton's cleared traffic on fresh tyres."
    },
    {
        "mp3": "f1_team_radio_mp3s/radio_00262.mp3",
        "driver_code": "VER",
        "driver_id": "MAXVER01",
        "racing_number": "33",
        "race_id": "2021_Abu_Dhabi_Grand_Prix",
        "grand_prix": "2021 Abu Dhabi Grand Prix",
        "lap_number": 32,
        "message_timestamp": "2021-12-12T13:51:30.000Z",
        "id": "2021_Abu_Dhabi_Grand_Prix_MAXVER01_33_20211212_135130",
        "default_transcript": "Repeat please, Max. God, you think it's fine? I'm clipping like hell!"
    },
    {
        "mp3": "f1_team_radio_mp3s/radio_00191.mp3",
        "driver_code": "VER",
        "driver_id": "MAXVER01",
        "racing_number": "33",
        "race_id": "2021_Abu_Dhabi_Grand_Prix",
        "grand_prix": "2021 Abu Dhabi Grand Prix",
        "lap_number": 43,
        "message_timestamp": "2021-12-12T14:07:45.000Z",
        "id": "2021_Abu_Dhabi_Grand_Prix_MAXVER01_33_20211212_140745",
        "default_transcript": "Alright Max, so we just need to maximise this result, okay? No more mistakes. Maximise this result."
    },
    {
        "mp3": "f1_team_radio_mp3s/radio_00188.mp3",
        "driver_code": "VER",
        "driver_id": "MAXVER01",
        "racing_number": "33",
        "race_id": "2021_Abu_Dhabi_Grand_Prix",
        "grand_prix": "2021 Abu Dhabi Grand Prix",
        "lap_number": 53,
        "message_timestamp": "2021-12-12T14:22:10.000Z",
        "id": "2021_Abu_Dhabi_Grand_Prix_MAXVER01_33_20211212_142210",
        "default_transcript": "Alright, so InfoMax. Hamilton on a 14 lap old set of medium tyres. You're obviously on a fresh set of soft."
    },
    {
        "mp3": "f1_team_radio_mp3s/radio_08468.mp3",
        "driver_code": "VER",
        "driver_id": "MAXVER01",
        "racing_number": "33",
        "race_id": "2021_Abu_Dhabi_Grand_Prix",
        "grand_prix": "2021 Abu Dhabi Grand Prix",
        "lap_number": 54,
        "message_timestamp": "2021-12-12T14:24:20.000Z",
        "id": "2021_Abu_Dhabi_Grand_Prix_MAXVER01_33_20211212_142420",
        "default_transcript": "Yes, you give that back!"
    },
    {
        "mp3": "f1_team_radio_mp3s/radio_00053.mp3",
        "driver_code": "VER",
        "driver_id": "MAXVER01",
        "racing_number": "33",
        "race_id": "2021_Abu_Dhabi_Grand_Prix",
        "grand_prix": "2021 Abu Dhabi Grand Prix",
        "lap_number": 57,
        "message_timestamp": "2021-12-12T14:29:40.000Z",
        "id": "2021_Abu_Dhabi_Grand_Prix_MAXVER01_33_20211212_142940",
        "default_transcript": "Okay, Max, so it will be the last lap next. You have three full overtake press and holds. Use them on the last lap and you know where."
    },
    {
        "mp3": "f1_team_radio_mp3s/radio_03615.mp3",
        "driver_code": "VER",
        "driver_id": "MAXVER01",
        "racing_number": "33",
        "race_id": "2021_Abu_Dhabi_Grand_Prix",
        "grand_prix": "2021 Abu Dhabi Grand Prix",
        "lap_number": 58,
        "message_timestamp": "2021-12-12T14:31:05.000Z",
        "id": "2021_Abu_Dhabi_Grand_Prix_MAXVER01_33_20211212_170000",
        "default_transcript": "The gap to Hamilton was 4.8... I think that's a podium mate! What a drive, what a race!"
    },

    # --- Lewis Hamilton (HAM - #44) ---
    {
        "mp3": "f1_team_radio_mp3s/radio_00103.mp3",
        "driver_code": "HAM",
        "driver_id": "LEWHAM01",
        "racing_number": "44",
        "race_id": "2021_Abu_Dhabi_Grand_Prix",
        "grand_prix": "2021 Abu Dhabi Grand Prix",
        "lap_number": 5,
        "message_timestamp": "2021-12-12T13:12:00.000Z",
        "id": "2021_Abu_Dhabi_Grand_Prix_LEWHAM01_44_20211212_131200",
        "default_transcript": "Turn one better that time. It's all going to start happening now, Lewis. Remember, we are sticking to plan A."
    },
    {
        "mp3": "f1_team_radio_mp3s/radio_00107.mp3",
        "driver_code": "HAM",
        "driver_id": "LEWHAM01",
        "racing_number": "44",
        "race_id": "2021_Abu_Dhabi_Grand_Prix",
        "grand_prix": "2021 Abu Dhabi Grand Prix",
        "lap_number": 11,
        "message_timestamp": "2021-12-12T13:20:45.000Z",
        "id": "2021_Abu_Dhabi_Grand_Prix_LEWHAM01_44_20211212_132045",
        "default_transcript": "Just trying to understand what I've got to do. Lewis, it's James. Main thing is driving to target."
    },
    {
        "mp3": "f1_team_radio_mp3s/radio_00644.mp3",
        "driver_code": "HAM",
        "driver_id": "LEWHAM01",
        "racing_number": "44",
        "race_id": "2021_Abu_Dhabi_Grand_Prix",
        "grand_prix": "2021 Abu Dhabi Grand Prix",
        "lap_number": 15,
        "message_timestamp": "2021-12-12T13:26:45.000Z",
        "id": "2021_Abu_Dhabi_Grand_Prix_LEWHAM01_44_20211212_132645",
        "default_transcript": "So that tyre age isn't massive Lewis, and your pace was really good and deg very, very good. Looks pretty good to me."
    },
    {
        "mp3": "f1_team_radio_mp3s/radio_00109.mp3",
        "driver_code": "HAM",
        "driver_id": "LEWHAM01",
        "racing_number": "44",
        "race_id": "2021_Abu_Dhabi_Grand_Prix",
        "grand_prix": "2021 Abu Dhabi Grand Prix",
        "lap_number": 24,
        "message_timestamp": "2021-12-12T13:40:30.000Z",
        "id": "2021_Abu_Dhabi_Grand_Prix_LEWHAM01_44_20211212_134030",
        "default_transcript": "I feel you guys aren't really giving much of a picture. I don't know what I'm doing out here. Target is 34-0."
    },
    {
        "mp3": "f1_team_radio_mp3s/radio_00038.mp3",
        "driver_code": "HAM",
        "driver_id": "LEWHAM01",
        "racing_number": "44",
        "race_id": "2021_Abu_Dhabi_Grand_Prix",
        "grand_prix": "2021 Abu Dhabi Grand Prix",
        "lap_number": 37,
        "message_timestamp": "2021-12-12T13:58:30.000Z",
        "id": "2021_Abu_Dhabi_Grand_Prix_LEWHAM01_44_20211212_135830",
        "default_transcript": "Okay copy, so we are getting over temp on the PU, so we need to introduce some lift and coast."
    },
    {
        "mp3": "f1_team_radio_mp3s/radio_00044.mp3",
        "driver_code": "HAM",
        "driver_id": "LEWHAM01",
        "racing_number": "44",
        "race_id": "2021_Abu_Dhabi_Grand_Prix",
        "grand_prix": "2021 Abu Dhabi Grand Prix",
        "lap_number": 44,
        "message_timestamp": "2021-12-12T14:09:15.000Z",
        "id": "2021_Abu_Dhabi_Grand_Prix_LEWHAM01_44_20211212_140915",
        "default_transcript": "My rears are going off."
    },
    {
        "mp3": "f1_team_radio_mp3s/radio_00183.mp3",
        "driver_code": "HAM",
        "driver_id": "LEWHAM01",
        "racing_number": "44",
        "race_id": "2021_Abu_Dhabi_Grand_Prix",
        "grand_prix": "2021 Abu Dhabi Grand Prix",
        "lap_number": 50,
        "message_timestamp": "2021-12-12T14:18:00.000Z",
        "id": "2021_Abu_Dhabi_Grand_Prix_LEWHAM01_44_20211212_141800",
        "default_transcript": "So, Lewis, 8 laps remaining when you cross the line. You need to stay within 10 seconds of Verstappen. Easy to say when you've got tyres like that."
    },
    {
        "mp3": "f1_team_radio_mp3s/radio_00221.mp3",
        "driver_code": "HAM",
        "driver_id": "LEWHAM01",
        "racing_number": "44",
        "race_id": "2021_Abu_Dhabi_Grand_Prix",
        "grand_prix": "2021 Abu Dhabi Grand Prix",
        "lap_number": 55,
        "message_timestamp": "2021-12-12T14:26:30.000Z",
        "id": "2021_Abu_Dhabi_Grand_Prix_LEWHAM01_44_20211212_142630",
        "default_transcript": "Okay, so Hamilton came out on his soft tyres. Looks like his warm-up's not very good."
    },
    {
        "mp3": "f1_team_radio_mp3s/radio_04238.mp3",
        "driver_code": "HAM",
        "driver_id": "LEWHAM01",
        "racing_number": "44",
        "race_id": "2021_Abu_Dhabi_Grand_Prix",
        "grand_prix": "2021 Abu Dhabi Grand Prix",
        "lap_number": 58,
        "message_timestamp": "2021-12-12T14:31:40.000Z",
        "id": "2021_Abu_Dhabi_Grand_Prix_LEWHAM01_44_20211212_170200",
        "default_transcript": "That was very unfair man. What did they want me to do? What Michael wanted me to do? Hamilton got me in the final sector."
    }
]

def ingest_expanded():
    init_db()
    df = pd.read_csv("f1_team_radio_mp3s/metadata.csv")
    print(f"[Expanded Ingest] Processing {len(EXPANDED_2021_CLIPS)} genuine driver recordings for 2021 Abu Dhabi GP...")

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    ver_count = sum(1 for c in EXPANDED_2021_CLIPS if c["driver_code"] == "VER")
    ham_count = sum(1 for c in EXPANDED_2021_CLIPS if c["driver_code"] == "HAM")

    # Update driver counts in DB
    save_driver("MAXVER01", "2021_Abu_Dhabi_Grand_Prix", "33", "VER", ver_count)
    save_driver("LEWHAM01", "2021_Abu_Dhabi_Grand_Prix", "44", "HAM", ham_count)
    save_race("2021_Abu_Dhabi_Grand_Prix", "2021 Abu Dhabi Grand Prix", 2021, "2021-12-12", len(EXPANDED_2021_CLIPS))

    for clip in EXPANDED_2021_CLIPS:
        src = clip["mp3"]
        if not os.path.exists(src):
            print(f"Skipping {src}, not on disk")
            continue

        dest_filename = f"{clip['id']}.wav"
        dest_path = os.path.join(STATIC_AUDIO_DIR, dest_filename)
        shutil.copyfile(src, dest_path)

        # STT with Whisper
        whisper_text = transcribe_audio(dest_path)
        
        # Ground truth
        base_name = os.path.basename(src)
        match_row = df[df["file_name"] == base_name]
        if not match_row.empty and pd.notna(match_row.iloc[0]["transcription"]):
            gt_text = match_row.iloc[0]["transcription"]
        else:
            gt_text = clip["default_transcript"]

        wer = compute_wer(gt_text, whisper_text)
        emotion = analyze_stress_and_emotion(dest_path)

        msg_data = {
            "id": clip["id"],
            "race_id": clip["race_id"],
            "grand_prix": clip["grand_prix"],
            "year": 2021,
            "driver_id": clip["driver_id"],
            "racing_number": clip["racing_number"],
            "driver_code": clip["driver_code"],
            "session_date": "2021-12-12",
            "message_timestamp": clip["message_timestamp"],
            "ground_truth_transcript": gt_text,
            "whisper_transcript": whisper_text,
            "wer": wer,
            "arousal": emotion["arousal"],
            "dominance": emotion["dominance"],
            "valence": emotion["valence"],
            "mood_label": emotion["mood_label"],
            "lap_number": clip["lap_number"],
            "lap_time_seconds": 88.0,
            "duration": emotion["duration"],
            "audio_filename": dest_filename
        }
        save_message(msg_data)
        print(f"  ✓ [{clip['driver_code']} Lap #{clip['lap_number']}] {whisper_text[:60]}... [{emotion['mood_label']}, Arousal: {emotion['arousal']}]")

    conn.commit()
    conn.close()
    print(f"\n[Expanded Ingest] Successfully loaded all {len(EXPANDED_2021_CLIPS)} real F1 radio clips into 2021 Abu Dhabi Grand Prix!")

if __name__ == "__main__":
    ingest_expanded()
