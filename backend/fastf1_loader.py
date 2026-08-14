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

DRIVER_NUMBER_TO_CODE = {
    '44': 'HAM', '33': 'VER', '1': 'VER', '3': 'RIC', '7': 'RAI',
    '77': 'BOT', '5': 'VET', '16': 'LEC', '55': 'SAI', '4': 'NOR',
    '81': 'PIA', '11': 'PER', '14': 'ALO', '31': 'OCO', '10': 'GAS',
    '18': 'STR', '63': 'RUS', '20': 'MAG', '27': 'HUL', '23': 'ALB'
}

DRIVER_CODE_TO_NUMBER = {v: k for k, v in DRIVER_NUMBER_TO_CODE.items()}

def get_driver_code(driver_id: str) -> str:
    """
    Extract 3-letter driver code from HF driver_id (e.g. MAXVER01 -> VER)
    or from racing number (e.g. '44' -> 'HAM').
    """
    driver_str = str(driver_id).strip().upper()
    if driver_str in DRIVER_NUMBER_TO_CODE:
        return DRIVER_NUMBER_TO_CODE[driver_str]
    if len(driver_str) >= 6:
        return driver_str[3:6].upper()
    return driver_str[:3].upper()

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
            year = 2021
        event = grand_prix
    return year, event

def load_race_session_laps(grand_prix: str, session_date: Optional[str] = None) -> Dict[str, Any]:
    """
    Fetches lap data for a race from FastF1 with full sector splits, tyre compounds, and speed traps.
    """
    year, event_name = extract_year_and_event(grand_prix, session_date)
    print(f"[FastF1] Fetching laps for {year} {event_name}...")
    
    session = None
    try:
        session = fastf1.get_session(year, event_name, 'R')
        session.load(laps=True, telemetry=False, weather=False, messages=False)
    except Exception as e:
        print(f"[FastF1] Primary session load failed for {year} {event_name}: {e}. Retrying without Grand Prix...")
        try:
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

    for driver_raw in session.laps['Driver'].unique():
        if not driver_raw or pd.isna(driver_raw):
            continue
            
        driver_code = get_driver_code(str(driver_raw))
        try:
            drv_laps = session.laps.pick_drivers(driver_raw)
        except Exception:
            drv_laps = session.laps[session.laps['Driver'] == driver_raw]
            
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
                
            is_pit = pd.notna(lap.get('PitInTime')) or pd.notna(lap.get('PitOutTime'))
            
            s1 = lap.get('Sector1Time')
            s2 = lap.get('Sector2Time')
            s3 = lap.get('Sector3Time')
            s1_sec = round(s1.total_seconds(), 3) if pd.notna(s1) else None
            s2_sec = round(s2.total_seconds(), 3) if pd.notna(s2) else None
            s3_sec = round(s3.total_seconds(), 3) if pd.notna(s3) else None

            compound = lap.get('Compound')
            compound_str = str(compound).upper() if pd.notna(compound) else None
            tyre_life = int(lap.get('TyreLife')) if pd.notna(lap.get('TyreLife')) else None
            speed_st = float(lap.get('SpeedST')) if pd.notna(lap.get('SpeedST')) else None

            parsed_laps.append({
                "lap_number": lap_num,
                "lap_time_seconds": round(lap_sec, 3) if lap_sec else None,
                "sector1_time": s1_sec,
                "sector2_time": s2_sec,
                "sector3_time": s3_sec,
                "tyre_compound": compound_str,
                "tyre_life": tyre_life,
                "speed_trap_kmh": round(speed_st, 1) if speed_st else None,
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
