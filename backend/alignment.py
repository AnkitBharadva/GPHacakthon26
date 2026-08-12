from datetime import datetime, timezone
from typing import Dict, List, Any, Optional
from backend.fastf1_loader import get_driver_code

def parse_iso_timestamp(ts_str: str) -> datetime:
    """Parses UTC ISO timestamp string, handling 'Z' suffix."""
    clean_ts = ts_str.replace("Z", "+00:00")
    return datetime.fromisoformat(clean_ts)

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
        # Return messages with lap_number=None if no FastF1 laps available
        for msg in messages:
            msg['lap_number'] = None
            msg['lap_time_seconds'] = None
        return messages

    # Sort laps by start time
    sorted_laps = sorted(driver_laps, key=lambda x: x.get('lap_start_time_sec', 0.0))
    
    # Get reference start datetime
    if session_start_dt is None:
        # Estimate reference start from first message
        first_msg_dt = parse_iso_timestamp(messages[0]['message_timestamp'])
        # Assume first message happens ~10 mins into session if not specified
        ref_start_sec = sorted_laps[0].get('lap_start_time_sec', 0.0) if sorted_laps else 0.0
    
    for msg in messages:
        try:
            msg_dt = parse_iso_timestamp(msg['message_timestamp'])
            
            if session_start_dt is not None:
                # Session relative seconds
                msg_offset_sec = (msg_dt - session_start_dt).total_seconds()
            else:
                # If session start reference unavailable, use message order heuristic
                msg_offset_sec = (msg_dt - parse_iso_timestamp(messages[0]['message_timestamp'])).total_seconds()

            matched_lap = None
            min_dist = float('inf')
            
            for lap in sorted_laps:
                l_start = lap.get('lap_start_time_sec', 0.0)
                l_end = lap.get('lap_end_time_sec', 0.0)
                
                # If message fell within lap window
                if l_start <= msg_offset_sec <= l_end:
                    matched_lap = lap
                    break
                
                # Check distance to lap end
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
