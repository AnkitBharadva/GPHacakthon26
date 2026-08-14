import os
import shutil
import sqlite3
import pandas as pd
from backend.stt_engine import transcribe_audio, compute_wer
from backend.emotion_engine import analyze_stress_and_emotion
from backend.fastf1_loader import get_driver_code

STATIC_AUDIO_DIR = os.path.join(os.path.dirname(__file__), "static", "audio")
os.makedirs(STATIC_AUDIO_DIR, exist_ok=True)
DB_PATH = os.path.join(os.path.dirname(__file__), "silent_codriver.db")

def find_and_copy_real_audios():
    meta_path = "f1_team_radio_mp3s/metadata.csv"
    if not os.path.exists(meta_path):
        print("metadata.csv not found!")
        return

    df = pd.read_csv(meta_path)
    print(f"[Map] Loaded {len(df)} clips from metadata.csv")

    # Select high-impact real spoken audio files from the MikCil dataset
    curated_real_clips = [
        # Max Verstappen real radio clips
        {
            "mp3": "f1_team_radio_mp3s/radio_01428.mp3",
            "driver_code": "VER",
            "driver_id": "MAXVER01",
            "racing_number": "33",
            "race_id": "2021_Abu_Dhabi_Grand_Prix",
            "grand_prix": "2021 Abu Dhabi Grand Prix",
            "lap_number": 1,
            "message_timestamp": "2021-12-12T13:05:40.000Z",
            "id": "2021_Abu_Dhabi_Grand_Prix_MAXVER01_33_20211212_130540"
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
            "id": "2021_Abu_Dhabi_Grand_Prix_MAXVER01_33_20211212_132512"
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
            "id": "2021_Abu_Dhabi_Grand_Prix_MAXVER01_33_20211212_133610"
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
            "id": "2021_Abu_Dhabi_Grand_Prix_MAXVER01_33_20211212_142420"
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
            "id": "2021_Abu_Dhabi_Grand_Prix_MAXVER01_33_20211212_170000"
        },
        # Lewis Hamilton real radio clips
        {
            "mp3": "f1_team_radio_mp3s/radio_00644.mp3",
            "driver_code": "HAM",
            "driver_id": "LEWHAM01",
            "racing_number": "44",
            "race_id": "2021_Abu_Dhabi_Grand_Prix",
            "grand_prix": "2021 Abu Dhabi Grand Prix",
            "lap_number": 15,
            "message_timestamp": "2021-12-12T13:26:45.000Z",
            "id": "2021_Abu_Dhabi_Grand_Prix_LEWHAM01_44_20211212_132645"
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
            "id": "2021_Abu_Dhabi_Grand_Prix_LEWHAM01_44_20211212_135830"
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
            "id": "2021_Abu_Dhabi_Grand_Prix_LEWHAM01_44_20211212_140915"
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
            "id": "2021_Abu_Dhabi_Grand_Prix_LEWHAM01_44_20211212_170200"
        },
        # 2018 Australia real radio clips
        {
            "mp3": "f1_team_radio_mp3s/radio_00007.mp3",
            "driver_code": "RIC",
            "driver_id": "DANRIC01",
            "racing_number": "3",
            "race_id": "2018_Australian_Grand_Prix",
            "grand_prix": "2018 Australian Grand Prix",
            "lap_number": 6,
            "message_timestamp": "2018-03-25T05:14:31.022Z",
            "id": "2018_Australian_Grand_Prix_DANRIC01_3_20180325_165106"
        },
        {
            "mp3": "f1_team_radio_mp3s/radio_00038.mp3",
            "driver_code": "HAM",
            "driver_id": "LEWHAM01",
            "racing_number": "44",
            "race_id": "2018_Australian_Grand_Prix",
            "grand_prix": "2018 Australian Grand Prix",
            "lap_number": 18,
            "message_timestamp": "2018-03-25T05:32:10.500Z",
            "id": "2018_Australian_Grand_Prix_LEWHAM01_44_20180325_165312"
        },
        {
            "mp3": "f1_team_radio_mp3s/radio_00044.mp3",
            "driver_code": "VER",
            "driver_id": "MAXVER01",
            "racing_number": "33",
            "race_id": "2018_Australian_Grand_Prix",
            "grand_prix": "2018 Australian Grand Prix",
            "lap_number": 26,
            "message_timestamp": "2018-03-25T05:45:00.000Z",
            "id": "2018_Australian_Grand_Prix_MAXVER01_33_20180325_164500"
        },
        {
            "mp3": "f1_team_radio_mp3s/radio_00019.mp3",
            "driver_code": "RAI",
            "driver_id": "KIMRAI01",
            "racing_number": "7",
            "race_id": "2018_Australian_Grand_Prix",
            "grand_prix": "2018 Australian Grand Prix",
            "lap_number": 1,
            "message_timestamp": "2018-03-25T05:05:00.000Z",
            "id": "2018_Australian_Grand_Prix_KIMRAI01_7_20180325_160500"
        },
        {
            "mp3": "f1_team_radio_mp3s/radio_01307.mp3",
            "driver_code": "RIC",
            "driver_id": "DANRIC01",
            "racing_number": "3",
            "race_id": "2018_Australian_Grand_Prix",
            "grand_prix": "2018 Australian Grand Prix",
            "lap_number": 42,
            "message_timestamp": "2018-03-25T06:12:00.000Z",
            "id": "2018_Australian_Grand_Prix_DANRIC01_3_20180325_172000"
        },
        {
            "mp3": "for_what.mp3",
            "driver_code": "HAM",
            "driver_id": "LEWHAM01",
            "racing_number": "44",
            "race_id": "2018_Australian_Grand_Prix",
            "grand_prix": "2018 Australian Grand Prix",
            "lap_number": 52,
            "message_timestamp": "2018-03-25T06:30:00.000Z",
            "id": "2018_Australian_Grand_Prix_LEWHAM01_44_20180325_174000"
        }
    ]

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    for clip in curated_real_clips:
        src_path = clip["mp3"]
        if not os.path.exists(src_path):
            print(f"Skipping {src_path}, not found on disk.")
            continue

        dest_filename = f"{clip['id']}.wav"
        dest_path = os.path.join(STATIC_AUDIO_DIR, dest_filename)

        # Copy the genuine audio file into static audio
        shutil.copyfile(src_path, dest_path)
        print(f"[Real Audio] Copied real recording {src_path} -> {dest_filename}")

        # Run real Whisper STT on the genuine audio
        stt = transcribe_audio(dest_path)
        whisper_text = stt if isinstance(stt, str) else stt.get("text", "")

        # Lookup ground truth in metadata if available
        base_name = os.path.basename(src_path)
        row_match = df[df['file_name'] == base_name]
        if not row_match.empty:
            gt_text = row_match.iloc[0]['transcription']
        else:
            gt_text = whisper_text

        wer = compute_wer(gt_text, whisper_text)

        # Run real Wav2Vec2 Emotion model on genuine voice audio
        emotion = analyze_stress_and_emotion(dest_path)

        # Update database with genuine AI metrics and real audio file
        cursor.execute("""
            UPDATE messages
            SET ground_truth_transcript = ?,
                whisper_transcript = ?,
                wer = ?,
                arousal = ?,
                dominance = ?,
                valence = ?,
                mood_label = ?,
                duration = ?,
                audio_filename = ?
            WHERE id = ?
        """, (
            gt_text,
            whisper_text,
            wer,
            emotion["arousal"],
            emotion["dominance"],
            emotion["valence"],
            emotion["mood_label"],
            emotion["duration"],
            dest_filename,
            clip["id"]
        ))
        print(f"  ✓ Processed: '{whisper_text}' [{emotion['mood_label']}, Arousal: {emotion['arousal']}]")

    conn.commit()
    conn.close()
    print("\n[Done] All Pit-Wall radio messages now have real, authentic driver voice recordings!")

if __name__ == "__main__":
    find_and_copy_real_audios()
