import os
import sqlite3
from backend.emotion_engine import analyze_stress_and_emotion

DB_PATH = os.path.join(os.path.dirname(__file__), "silent_codriver.db")
STATIC_AUDIO_DIR = os.path.join(os.path.dirname(__file__), "static", "audio")

def recalibrate():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute("SELECT id, driver_code, lap_number, ground_truth_transcript, whisper_transcript, audio_filename FROM messages")
    messages = cursor.fetchall()
    print(f"[Recalibration] Re-scoring {len(messages)} messages with multi-modal acoustic + semantic engine...")

    mood_counts = {}

    for msg in messages:
        filename = msg["audio_filename"]
        if not filename:
            filename = f"{msg['id']}.wav"
        
        filepath = os.path.join(STATIC_AUDIO_DIR, filename)
        if not os.path.exists(filepath):
            print(f"Skipping {filepath}, file not found")
            continue

        txt = msg["whisper_transcript"] or msg["ground_truth_transcript"] or ""
        emotion = analyze_stress_and_emotion(filepath, transcript=txt)

        cursor.execute("""
            UPDATE messages
            SET arousal = ?,
                dominance = ?,
                valence = ?,
                mood_label = ?,
                duration = ?
            WHERE id = ?
        """, (
            emotion["arousal"],
            emotion["dominance"],
            emotion["valence"],
            emotion["mood_label"],
            emotion["duration"],
            msg["id"]
        ))

        mood = emotion["mood_label"]
        mood_counts[mood] = mood_counts.get(mood, 0) + 1
        print(f"  ✓ [{msg['driver_code']} Lap #{msg['lap_number']}] -> [{mood:8s} | A={emotion['arousal']:.3f}, D={emotion['dominance']:.3f}, V={emotion['valence']:.3f}] | '{txt[:45]}'")

    conn.commit()
    conn.close()

    print("\n[Recalibration] Emotion breakdown:")
    for mood, count in mood_counts.items():
        print(f"  - {mood}: {count} messages")

if __name__ == "__main__":
    recalibrate()
