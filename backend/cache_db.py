import sqlite3
import json
import os
from typing import List, Dict, Any, Optional

DB_PATH = os.path.join(os.path.dirname(__file__), "silent_codriver.db")

def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Table: Races
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS races (
        race_id TEXT PRIMARY KEY,
        grand_prix TEXT NOT NULL,
        year INTEGER NOT NULL,
        session_date TEXT,
        message_count INTEGER DEFAULT 0
    )
    """)
    
    # Table: Drivers
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS drivers (
        driver_id TEXT NOT NULL,
        race_id TEXT NOT NULL,
        racing_number TEXT,
        driver_code TEXT NOT NULL,
        message_count INTEGER DEFAULT 0,
        PRIMARY KEY (driver_id, race_id)
    )
    """)
    
    # Table: Messages (Radio audio + STT + Stress + Alignment)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        race_id TEXT NOT NULL,
        driver_id TEXT NOT NULL,
        driver_code TEXT NOT NULL,
        racing_number TEXT,
        session_date TEXT,
        message_timestamp TEXT NOT NULL,
        duration REAL DEFAULT 0.0,
        ground_truth_transcript TEXT,
        whisper_transcript TEXT,
        wer REAL DEFAULT 0.0,
        arousal REAL DEFAULT 0.0,
        dominance REAL DEFAULT 0.0,
        valence REAL DEFAULT 0.0,
        mood_label TEXT NOT NULL,
        lap_number INTEGER,
        lap_time_seconds REAL,
        audio_filename TEXT,
        FOREIGN KEY(race_id) REFERENCES races(race_id)
    )
    """)
    
    # Table: Laps (FastF1 telemetry summary per race/driver)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS laps (
        race_id TEXT NOT NULL,
        driver_code TEXT NOT NULL,
        lap_number INTEGER NOT NULL,
        lap_time_seconds REAL,
        is_pit INTEGER DEFAULT 0,
        lap_start_time_sec REAL,
        lap_end_time_sec REAL,
        PRIMARY KEY (race_id, driver_code, lap_number)
    )
    """)

    # Table: System Settings (e.g. stress thresholds)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
    )
    """)
    
    # Default settings
    cursor.execute("INSERT OR IGNORE INTO settings (key, value) VALUES ('arousal_thresh', '0.6')")
    cursor.execute("INSERT OR IGNORE INTO settings (key, value) VALUES ('valence_thresh', '0.4')")
    cursor.execute("INSERT OR IGNORE INTO settings (key, value) VALUES ('tired_arousal', '0.4')")
    cursor.execute("INSERT OR IGNORE INTO settings (key, value) VALUES ('tired_valence', '0.55')")
    
    conn.commit()
    conn.close()

def save_race(race_id: str, grand_prix: str, year: int, session_date: str, message_count: int):
    conn = get_db_connection()
    conn.execute("""
        INSERT INTO races (race_id, grand_prix, year, session_date, message_count)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(race_id) DO UPDATE SET message_count = excluded.message_count
    """, (race_id, grand_prix, year, session_date, message_count))
    conn.commit()
    conn.close()

def save_driver(driver_id: str, race_id: str, racing_number: str, driver_code: str, message_count: int):
    conn = get_db_connection()
    conn.execute("""
        INSERT INTO drivers (driver_id, race_id, racing_number, driver_code, message_count)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(driver_id, race_id) DO UPDATE SET message_count = excluded.message_count
    """, (driver_id, race_id, racing_number, driver_code, message_count))
    conn.commit()
    conn.close()

def save_message(msg_data: Dict[str, Any]):
    conn = get_db_connection()
    conn.execute("""
        INSERT INTO messages (
            id, race_id, driver_id, driver_code, racing_number, session_date,
            message_timestamp, duration, ground_truth_transcript, whisper_transcript,
            wer, arousal, dominance, valence, mood_label, lap_number, lap_time_seconds, audio_filename
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
            whisper_transcript = excluded.whisper_transcript,
            wer = excluded.wer,
            arousal = excluded.arousal,
            dominance = excluded.dominance,
            valence = excluded.valence,
            mood_label = excluded.mood_label,
            lap_number = excluded.lap_number,
            lap_time_seconds = excluded.lap_time_seconds
    """, (
        msg_data['id'], msg_data['race_id'], msg_data['driver_id'], msg_data['driver_code'],
        msg_data.get('racing_number', ''), msg_data.get('session_date', ''),
        msg_data['message_timestamp'], msg_data.get('duration', 0.0),
        msg_data.get('ground_truth_transcript', ''), msg_data.get('whisper_transcript', ''),
        msg_data.get('wer', 0.0), msg_data.get('arousal', 0.0),
        msg_data.get('dominance', 0.0), msg_data.get('valence', 0.0),
        msg_data.get('mood_label', 'Calm'), msg_data.get('lap_number'),
        msg_data.get('lap_time_seconds'), msg_data.get('audio_filename', '')
    ))
    conn.commit()
    conn.close()

def save_laps(race_id: str, driver_code: str, laps_list: List[Dict[str, Any]]):
    conn = get_db_connection()
    for lap in laps_list:
        conn.execute("""
            INSERT INTO laps (race_id, driver_code, lap_number, lap_time_seconds, is_pit, lap_start_time_sec, lap_end_time_sec)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(race_id, driver_code, lap_number) DO UPDATE SET
                lap_time_seconds = excluded.lap_time_seconds,
                is_pit = excluded.is_pit
        """, (
            race_id, driver_code, lap['lap_number'], lap.get('lap_time_seconds'),
            1 if lap.get('is_pit') else 0, lap.get('lap_start_time_sec', 0.0), lap.get('lap_end_time_sec', 0.0)
        ))
    conn.commit()
    conn.close()

def get_all_races() -> List[Dict[str, Any]]:
    conn = get_db_connection()
    rows = conn.execute("SELECT * FROM races ORDER BY session_date DESC, grand_prix ASC").fetchall()
    conn.close()
    return [dict(r) for r in rows]

def get_drivers_for_race(race_id: str) -> List[Dict[str, Any]]:
    conn = get_db_connection()
    rows = conn.execute("SELECT * FROM drivers WHERE race_id = ? ORDER BY driver_code ASC", (race_id,)).fetchall()
    conn.close()
    return [dict(r) for r in rows]

def get_messages_for_driver(race_id: str, driver_id: str) -> List[Dict[str, Any]]:
    conn = get_db_connection()
    rows = conn.execute("""
        SELECT * FROM messages 
        WHERE race_id = ? AND driver_id = ? 
        ORDER BY message_timestamp ASC
    """, (race_id, driver_id)).fetchall()
    conn.close()
    return [dict(r) for r in rows]

def get_laps_for_driver(race_id: str, driver_code: str) -> List[Dict[str, Any]]:
    conn = get_db_connection()
    rows = conn.execute("""
        SELECT * FROM laps 
        WHERE race_id = ? AND driver_code = ? 
        ORDER BY lap_number ASC
    """, (race_id, driver_code)).fetchall()
    conn.close()
    return [dict(r) for r in rows]

def get_stats() -> Dict[str, Any]:
    conn = get_db_connection()
    total_messages = conn.execute("SELECT COUNT(*) FROM messages").fetchone()[0]
    total_races = conn.execute("SELECT COUNT(*) FROM races").fetchone()[0]
    avg_wer = conn.execute("SELECT AVG(wer) FROM messages WHERE wer > 0").fetchone()[0] or 0.0
    
    mood_counts = dict(conn.execute("SELECT mood_label, COUNT(*) FROM messages GROUP BY mood_label").fetchall())
    
    conn.close()
    return {
        "total_messages": total_messages,
        "total_races": total_races,
        "avg_wer": round(avg_wer, 4),
        "mood_counts": mood_counts
    }
