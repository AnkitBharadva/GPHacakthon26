import os
import fastf1
import pandas as pd
from typing import Dict, List, Any, Optional, Tuple
from datetime import datetime

# Enable local disk cache for FastF1 session downloads
CACHE_DIR = os.path.join(os.path.dirname(__file__), "fastf1_cache")
os.makedirs(CACHE_DIR, exist_ok=True)
try:
    fastf1.Cache.enable_cache(CACHE_DIR)
except Exception as e:
    print(f"[FastF1] Cache warning: {e}")

def get_driver_code(driver_id: str) -> str:
    """
    Extract 3-letter driver code from HF driver_id.
    Format is 8-char: 3-char first name + 3-char surname + 01 (e.g. MAXVER01 -> VER, LEWHAM01 -> HAM)
    """
    if len(driver_id) >= 6:
        return driver_id[3:6].upper()
    return driver_id[:3].upper()

def extract_year_and_event(grand_prix: str, session_date: Optional[str] = None) -> Tuple[int, str]:
    """
    Parses grand_prix string (e.g., '2018 Australian Grand Prix') into (2018, 'Australian Grand Prix').
    """
    parts = grand_prix.strip().split(" ", 1)
    if parts[0].isdigit() and len(parts[0]) == 4:
        year = int(parts[0])
        event = parts[1] if len(parts) > 1 else grand_prix
    else:
        if session_date:
            year = int(session_date.split("-")[0])
        else:
            year = 2018
        event = grand_prix
    return year, event

def load_race_session_laps(grand_prix: str, session_date: Optional[str] = None) -> Dict[str, Any]:
    """
    Fetches lap data for a race from FastF1.
    Returns dictionary with driver_laps mapping and session start datetime reference.
    """
    year, event_name = extract_year_and_event(grand_prix, session_date)
    print(f"[FastF1] Fetching laps for {year} {event_name}...")
    
    try:
        session = fastf1.get_session(year, event_name, 'R')
        session.load(laps=True, telemetry=False, weather=False, messages=False)
    except Exception as e:
        print(f"[FastF1] Primary session load failed for {year} {event_name}: {e}. Retrying without exact match...")
        try:
            # Fallback event clean up: strip "Grand Prix" if needed
            clean_event = event_name.replace("Grand Prix", "").strip()
            session = fastf1.get_session(year, clean_event, 'R')
            session.load(laps=True, telemetry=False, weather=False, messages=False)
        except Exception as err:
            print(f"[FastF1] Error loading session {year} {event_name}: {err}")
            return {"laps_by_driver": {}, "session_start": None, "error": str(err)}

    session_start = session.date
    laps_by_driver = {}
    
    if session.laps is None or session.laps.empty:
        return {"laps_by_driver": {}, "session_start": session_start, "error": "No laps found"}

    for driver_code in session.laps['Driver'].unique():
        if not driver_code or pd.isna(driver_code):
            continue
        drv_laps = session.laps.pick_driver(driver_code)
        parsed_laps = []
        
        for _, lap in drv_laps.iterrows():
            lap_num = int(lap['LapNumber']) if pd.notna(lap['LapNumber']) else 0
            lap_sec = lap['LapTime'].total_seconds() if pd.notna(lap['LapTime']) else None
            
            # Session relative timestamps in seconds
            lap_end_sec = lap['Time'].total_seconds() if pd.notna(lap['Time']) else None
            
            # Calculate lap start time
            if lap_end_sec is not None and lap_sec is not None:
                lap_start_sec = lap_end_sec - lap_sec
            else:
                lap_start_sec = lap_end_sec
                
            is_pit = pd.notna(lap['PitInTime']) or pd.notna(lap['PitOutTime'])
            
            parsed_laps.append({
                "lap_number": lap_num,
                "lap_time_seconds": round(lap_sec, 3) if lap_sec else None,
                "is_pit": is_pit,
                "lap_start_time_sec": round(lap_start_sec, 3) if lap_start_sec is not None else 0.0,
                "lap_end_time_sec": round(lap_end_sec, 3) if lap_end_sec is not None else 0.0
            })
        
        laps_by_driver[driver_code] = parsed_laps
        
    return {
        "laps_by_driver": laps_by_driver,
        "session_start": session_start,
        "error": None
    }
