import os
import shutil
import tempfile
import numpy as np
import soundfile as sf
from fastapi import FastAPI, File, UploadFile, Form, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from typing import List, Dict, Any, Optional

from backend.cache_db import (
    init_db, get_all_races, get_drivers_for_race, get_messages_for_driver,
    get_laps_for_driver, get_stats, get_db_connection
)
from backend.stt_engine import transcribe_audio, compute_wer
from backend.emotion_engine import analyze_stress_and_emotion, classify_mood
from backend.process_dataset import populate_demo_data
from backend.alignment import match_single_timestamp_to_lap

app = FastAPI(
    title="The Silent Co-Driver API",
    description="Formula 1 Audio STT + Vocal Stress & Lap Time Alignment Engine",
    version="1.0.0"
)

# Enable CORS for frontend web application
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static audio files for frontend player
AUDIO_DIR = os.path.join(os.path.dirname(__file__), "static", "audio")
os.makedirs(AUDIO_DIR, exist_ok=True)
app.mount("/static/audio", StaticFiles(directory=AUDIO_DIR), name="audio")

@app.on_event("startup")
def on_startup():
    init_db()
    races = get_all_races()
    if not races:
        print("[Startup] Empty database detected, seeding demo data...")
        populate_demo_data()
    else:
        print(f"[Startup] Database loaded successfully with {len(races)} races.")

class ReclassifyRequest(BaseModel):
    arousal_thresh: float = 0.60
    valence_thresh: float = 0.40
    tired_arousal: float = 0.40
    tired_valence: float = 0.55

@app.get("/")
def root():
    return {
        "status": "online",
        "app": "The Silent Co-Driver",
        "dataset": "MikCil/f1-team-radio (CC-BY-4.0)",
        "models": {
            "stt": "openai/whisper-base",
            "emotion": "audeering/wav2vec2-large-robust-12-ft-emotion-msp-dim"
        }
    }

@app.get("/api/races")
def list_races():
    return get_all_races()

@app.get("/api/races/{race_id}/drivers")
def list_drivers(race_id: str):
    return get_drivers_for_race(race_id)

@app.get("/api/races/{race_id}/drivers/{driver_id}/messages")
def list_messages(race_id: str, driver_id: str):
    return get_messages_for_driver(race_id, driver_id)

@app.get("/api/races/{race_id}/laps/{driver_code}")
def list_laps(race_id: str, driver_code: str):
    return get_laps_for_driver(race_id, driver_code)

@app.get("/api/stats")
def stats():
    return get_stats()

@app.post("/api/reclassify")
def reclassify(req: ReclassifyRequest):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id, arousal, valence, dominance, ground_truth_transcript, whisper_transcript FROM messages")
    messages = cursor.fetchall()
    
    updated_count = 0
    for msg in messages:
        txt = msg["whisper_transcript"] or msg["ground_truth_transcript"] or ""
        new_mood = classify_mood(
            msg["arousal"], 
            msg["valence"],
            dominance=msg["dominance"] if "dominance" in msg.keys() else 0.5,
            transcript=txt,
            arousal_thresh=req.arousal_thresh,
            valence_thresh=req.valence_thresh,
            tired_arousal=req.tired_arousal,
            tired_valence=req.tired_valence
        )
        cursor.execute("UPDATE messages SET mood_label = ? WHERE id = ?", (new_mood, msg["id"]))
        updated_count += 1
        
    conn.commit()
    conn.close()
    return {"status": "success", "updated_messages": updated_count}

@app.post("/api/audio/upload")
async def upload_audio_clip(
    file: UploadFile = File(...),
    reference_transcript: Optional[str] = Form(None),
    arousal_thresh: float = Form(0.6),
    valence_thresh: float = Form(0.4),
    grand_prix: Optional[str] = Form(None),
    year: Optional[int] = Form(None),
    driver_code: Optional[str] = Form(None),
    message_timestamp: Optional[str] = Form(None)
):
    """
    Accepts user uploaded audio clip (or stage recording),
    runs Whisper STT + Wav2Vec2 Emotion scoring live, and matches FastF1 telemetry lap if metadata provided!
    """
    temp_filename = f"upload_{file.filename}"
    temp_path = os.path.join(tempfile.gettempdir(), temp_filename)
    
    try:
        with open(temp_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
            
        # Read audio array with librosa or soundfile safely
        try:
            import librosa
            audio_data, sr = librosa.load(temp_path, sr=16000, mono=True)
        except Exception as read_err:
            print(f"[Upload] librosa.load fallback: {read_err}")
            audio_data, sr = sf.read(temp_path)
            if len(audio_data.shape) > 1:
                audio_data = np.mean(audio_data, axis=1) # stereo to mono
            if sr != 16000:
                import librosa
                audio_data = librosa.resample(audio_data, orig_sr=sr, target_sr=16000)
                sr = 16000
                
        audio_data = np.nan_to_num(audio_data)

        # Save to static audio directory for web player
        save_filename = f"live_{file.filename}.wav"
        save_path = os.path.join(AUDIO_DIR, save_filename)
        sf.write(save_path, audio_data, sr)

        # Run STT + Emotion Pipeline
        whisper_transcript = transcribe_audio(audio_data, sr)
        wer_val = compute_wer(reference_transcript, whisper_transcript) if reference_transcript else 0.0
        
        emotion_result = analyze_stress_and_emotion(
            audio_data, sr,
            transcript=whisper_transcript,
            arousal_thresh=arousal_thresh, 
            valence_thresh=valence_thresh
        )

        # Match with FastF1 telemetry lap data (from user form or auto-detected from audio)
        lap_info = match_single_timestamp_to_lap(
            grand_prix=grand_prix,
            driver_code=driver_code,
            timestamp_str=message_timestamp,
            year=year,
            filename=file.filename,
            whisper_transcript=whisper_transcript
        )
        
        return {
            "filename": save_filename,
            "audio_url": f"/static/audio/{save_filename}",
            "whisper_transcript": whisper_transcript,
            "reference_transcript": reference_transcript or "",
            "wer": wer_val,
            "duration": emotion_result["duration"],
            "arousal": emotion_result["arousal"],
            "dominance": emotion_result["dominance"],
            "valence": emotion_result["valence"],
            "mood_label": emotion_result["mood_label"],
            "telemetry_matched": lap_info.get("matched", False),
            "lap_number": lap_info.get("lap_number"),
            "lap_time_seconds": lap_info.get("lap_time_seconds"),
            "sector1_time": lap_info.get("sector1_time"),
            "sector2_time": lap_info.get("sector2_time"),
            "sector3_time": lap_info.get("sector3_time"),
            "tyre_compound": lap_info.get("tyre_compound"),
            "tyre_life": lap_info.get("tyre_life"),
            "speed_trap_kmh": lap_info.get("speed_trap_kmh"),
            "is_pit": lap_info.get("is_pit", False),
            "driver_code": lap_info.get("driver_code") or driver_code,
            "grand_prix": lap_info.get("grand_prix") or grand_prix,
            "message_timestamp": lap_info.get("message_timestamp") or message_timestamp
        }

    except Exception as e:
        print(f"[Upload Error] {e}")
        raise HTTPException(status_code=500, detail=f"Failed to process audio clip: {str(e)}")
    finally:
        if os.path.exists(temp_path):
            try:
                os.remove(temp_path)
            except Exception:
                pass
