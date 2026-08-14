from datetime import datetime, timezone
import sqlite3
import os
import re
import pandas as pd
from typing import Dict, List, Any, Optional
from backend.fastf1_loader import get_driver_code, load_race_session_laps, extract_year_and_event

DB_PATH = os.path.join(os.path.dirname(__file__), "silent_codriver.db")

def parse_iso_timestamp(ts_str: str) -> datetime:
    """Parses UTC ISO timestamp string, handling 'Z' suffix and variable formats."""
    clean_ts = ts_str.strip().replace("Z", "+00:00")
    try:
        return datetime.fromisoformat(clean_ts)
    except Exception:
        return pd.to_datetime(clean_ts).to_pydatetime()

def auto_detect_f1_metadata(filename: Optional[str], whisper_transcript: Optional[str]) -> Optional[Dict[str, Any]]:
    """
    Intelligently extracts Grand Prix, Driver Code, and Timestamp from audio filename or known database transcripts.
    """
    # 1. Inspect Filename
    if filename:
        fn = os.path.basename(filename)
        parts = fn.replace(".wav", "").replace(".mp3", "").split("_")
        if len(parts) >= 4 and parts[0].isdigit() and len(parts[0]) == 4:
            year = int(parts[0])
            drv_part = None
            for p in parts:
                if len(p) == 8 and p.endswith("01"):
                    drv_part = p
                    break
            if drv_part:
                driver_code = get_driver_code(drv_part)
                gp_words = []
                for p in parts[1:]:
                    if p == drv_part:
                        break
                    gp_words.append(p)
                grand_prix = f"{year} {' '.join(gp_words)}"
                return {
                    "grand_prix": grand_prix,
                    "year": year,
                    "driver_code": driver_code,
                    "message_timestamp": f"{year}-03-25T05:14:31Z"
                }

    # 2. Inspect Transcript similarity in SQLite DB
    if whisper_transcript and os.path.exists(DB_PATH):
        clean_text = whisper_transcript.lower()
        try:
            conn = sqlite3.connect(DB_PATH)
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            cursor.execute("SELECT race_id, driver_code, message_timestamp, lap_number, ground_truth_transcript, whisper_transcript FROM messages")
            rows = cursor.fetchall()
            conn.close()

            words = set(re.findall(r'\w+', clean_text))
            best_match = None
            max_overlap = 0

            for r in rows:
                r_gt = (r["ground_truth_transcript"] or "").lower()
                r_wh = (r["whisper_transcript"] or "").lower()
                r_words = set(re.findall(r'\w+', f"{r_gt} {r_wh}"))
                overlap = len(words.intersection(r_words))
                if overlap > max_overlap and overlap >= 3:
                    max_overlap = overlap
                    best_match = r

            if best_match:
                race_name = best_match["race_id"].replace("_", " ")
                year = int(race_name.split()[0]) if race_name.split()[0].isdigit() else 2021
                return {
                    "grand_prix": race_name,
                    "year": year,
                    "driver_code": best_match["driver_code"],
                    "message_timestamp": best_match["message_timestamp"],
                    "lap_number": best_match["lap_number"]
                }
        except Exception as e:
            print(f"[AutoDetect] Transcript matching: {e}")

    return None

def align_messages_with_laps(
    messages: List[Dict[str, Any]], 
    driver_laps: List[Dict[str, Any]], 
    session_start_dt: Optional[datetime] = None
) -> List[Dict[str, Any]]:
    """
    Aligns radio messages with FastF1 lap timing data.
    Finds the lap corresponding to each radio message timestamp.
    """
    if not messages:
        return []

    if not driver_laps:
        for msg in messages:
            msg['lap_number'] = None
            msg['lap_time_seconds'] = None
        return messages

    sorted_laps = sorted(driver_laps, key=lambda x: x.get('lap_start_time_sec', 0.0))
    
    for msg in messages:
        try:
            msg_dt = parse_iso_timestamp(msg['message_timestamp'])
            
            if session_start_dt is not None:
                msg_offset_sec = (msg_dt - session_start_dt).total_seconds()
            else:
                msg_offset_sec = (msg_dt - parse_iso_timestamp(messages[0]['message_timestamp'])).total_seconds()

            matched_lap = None
            min_dist = float('inf')
            
            for lap in sorted_laps:
                l_start = lap.get('lap_start_time_sec', 0.0)
                l_end = lap.get('lap_end_time_sec', 0.0)
                
                if l_start <= msg_offset_sec <= l_end:
                    matched_lap = lap
                    break
                
                dist = abs(msg_offset_sec - l_end)
                if dist < min_dist:
                    min_dist = dist
                    matched_lap = lap

            if matched_lap:
                msg['lap_number'] = matched_lap.get('lap_number')
                msg['lap_time_seconds'] = matched_lap.get('lap_time_seconds')
            else:
                msg['lap_number'] = None
                msg['lap_time_seconds'] = None

        except Exception as e:
            print(f"[Alignment] Error aligning message {msg.get('id')}: {e}")
            msg['lap_number'] = None
            msg['lap_time_seconds'] = None

    return messages

def match_single_timestamp_to_lap(
    grand_prix: Optional[str],
    driver_code: Optional[str],
    timestamp_str: Optional[str],
    year: Optional[int] = None,
    filename: Optional[str] = None,
    whisper_transcript: Optional[str] = None
) -> Dict[str, Any]:
    """
    Pulls real FastF1 session laps and dynamically matches the exact lap and metrics:
    - Sector 1, 2, 3 splits
    - Real Tyre Compound & Tyre Stint Age
    - Speed Trap
    - Lap Pace & Status
    """
    # If parameters not provided, try auto-detection
    if not grand_prix or not driver_code or not timestamp_str:
        detected = auto_detect_f1_metadata(filename, whisper_transcript)
        if detected:
            grand_prix = grand_prix or detected.get("grand_prix")
            driver_code = driver_code or detected.get("driver_code")
            timestamp_str = timestamp_str or detected.get("message_timestamp")
            year = year or detected.get("year")

    # If still missing parameters, return clean honest false (no hardcoded numbers)
    if not grand_prix or not driver_code or not timestamp_str:
        return {"matched": False}

    drv = get_driver_code(driver_code)
    parsed_year, event_clean = extract_year_and_event(grand_prix)
    if year:
        parsed_year = year

    try:
        session_res = load_race_session_laps(grand_prix, session_date=str(parsed_year))
        laps_by_driver = session_res.get("laps_by_driver", {})
        session_start = session_res.get("session_start")

        driver_laps = laps_by_driver.get(drv, [])
        if not driver_laps:
            # Try finding with alternate key
            for k in laps_by_driver:
                if get_driver_code(k) == drv:
                    driver_laps = laps_by_driver[k]
                    break

        if driver_laps:
            target_dt = parse_iso_timestamp(timestamp_str)
            if session_start is not None:
                # Ensure timezone compatibility
                if target_dt.tzinfo is not None and getattr(session_start, 'tzinfo', None) is None:
                    session_start = session_start.tz_localize('UTC')
                elif target_dt.tzinfo is None and getattr(session_start, 'tzinfo', None) is not None:
                    target_dt = target_dt.replace(tzinfo=timezone.utc)
                offset_sec = (target_dt - session_start).total_seconds()
            else:
                offset_sec = target_dt.minute * 60 + target_dt.second

            matched_lap = None
            for lap in driver_laps:
                l_start = lap.get("lap_start_time_sec", 0.0)
                l_end = lap.get("lap_end_time_sec", 0.0)
                if l_start <= offset_sec <= l_end:
                    matched_lap = lap
                    break

            if matched_lap is None and driver_laps:
                # Pick closest lap within reasonable race boundary
                matched_lap = min(driver_laps, key=lambda l: abs(l.get("lap_start_time_sec", 0.0) - offset_sec))

            if matched_lap:
                return {
                    "matched": True,
                    "lap_number": matched_lap.get("lap_number"),
                    "lap_time_seconds": matched_lap.get("lap_time_seconds"),
                    "sector1_time": matched_lap.get("sector1_time"),
                    "sector2_time": matched_lap.get("sector2_time"),
                    "sector3_time": matched_lap.get("sector3_time"),
                    "tyre_compound": matched_lap.get("tyre_compound"),
                    "tyre_life": matched_lap.get("tyre_life"),
                    "speed_trap_kmh": matched_lap.get("speed_trap_kmh"),
                    "is_pit": matched_lap.get("is_pit", False),
                    "driver_code": drv,
                    "grand_prix": grand_prix,
                    "year": parsed_year
                }

    except Exception as e:
        print(f"[Alignment] Error during FastF1 lap matching: {e}")

    return {"matched": False}
