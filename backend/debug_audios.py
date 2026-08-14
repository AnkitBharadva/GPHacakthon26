import sqlite3
import os
import wave

conn = sqlite3.connect('backend/silent_codriver.db')
c = conn.cursor()
c.execute('SELECT id, driver_code, lap_number, message_timestamp, audio_filename, ground_truth_transcript, duration FROM messages WHERE race_id="2021_Abu_Dhabi_Grand_Prix"')
rows = c.fetchall()

print(f"Total rows: {len(rows)}")
for r in rows:
    msg_id, driver, lap, ts, filename, gt, dur = r
    filepath = os.path.join("backend/static/audio", filename) if filename else None
    exists = os.path.exists(filepath) if filepath else False
    size = os.path.getsize(filepath) if exists else 0
    print(f"[{driver} Lap #{lap}] ts={ts} | file={filename} | exists={exists} ({size}B, dur={dur}s) | gt='{gt[:40]}...'")
