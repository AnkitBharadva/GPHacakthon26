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

# Ensure static directories exist
STATIC_DIR = os.path.join(os.path.dirname(__file__), "static")
AUDIO_DIR = os.path.join(STATIC_DIR, "audio")
os.makedirs(AUDIO_DIR, exist_ok=True)

app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

@app.on_event("startup")
def startup_event():
    init_db()
    # Populate initial demo data if database is empty
    races = get_all_races()
    if not races:
        print("[API Startup] Database empty, generating initial demo dataset...")
        populate_demo_data()

@app.get("/")
def read_root():
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
def get_races():
    """List of all available races in dataset."""
    return get_all_races()

@app.get("/api/races/{race_id}/drivers")
def get_race_drivers(race_id: str):
    """List of drivers with radio messages in a specific race."""
    drivers = get_drivers_for_race(race_id)
    if not drivers:
        raise HTTPException(status_code=404, detail=f"No drivers found for race {race_id}")
    return drivers

@app.get("/api/races/{race_id}/drivers/{driver_id}/messages")
def get_driver_messages(race_id: str, driver_id: str):
    """Joined radio message timeline + lap times + vocal mood scoring for a driver."""
    messages = get_messages_for_driver(race_id, driver_id)
    return messages

@app.get("/api/races/{race_id}/laps/{driver_code}")
def get_driver_laps(race_id: str, driver_code: str):
    """FastF1 lap times for lap performance line chart."""
    laps = get_laps_for_driver(race_id, driver_code.upper())
    return laps

class ThresholdConfig(BaseModel):
    arousal_thresh: float = 0.6
    valence_thresh: float = 0.4
    tired_arousal: float = 0.4
    tired_valence: float = 0.55

@app.post("/api/reclassify")
def reclassify_stress_thresholds(config: ThresholdConfig):
    """
    Re-classifies stress and mood labels across cached messages using updated thresholds.
    Allows real-time tuning by engineers / judges!
    """
    conn = get_db_connection()
    messages = conn.execute("SELECT id, arousal, valence FROM messages").fetchall()
    
    updated_count = 0
    for msg in messages:
        msg_id, arousal, valence = msg["id"], msg["arousal"], msg["valence"]
        new_mood = classify_mood(
            arousal, valence, 
            arousal_thresh=config.arousal_thresh,
            valence_thresh=config.valence_thresh,
            tired_arousal=config.tired_arousal,
            tired_valence=config.tired_valence
        )
        conn.execute("UPDATE messages SET mood_label = ? WHERE id = ?", (new_mood, msg_id))
        updated_count += 1
        
    conn.commit()
    conn.close()
    return {"status": "success", "updated_messages": updated_count, "config": config}

@app.post("/api/audio/upload")
async def upload_audio_clip(
    file: UploadFile = File(...),
    reference_transcript: Optional[str] = Form(None),
    arousal_thresh: float = Form(0.6),
    valence_thresh: float = Form(0.4)
):
    """
    Accepts user uploaded audio clip (or stage recording),
    runs Whisper STT + Wav2Vec2 Emotion scoring live!
    """
    temp_filename = f"upload_{file.filename}"
    temp_path = os.path.join(tempfile.gettempdir(), temp_filename)
    
    try:
        with open(temp_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
            
        # Read audio array with soundfile / librosa
        audio_data, sr = sf.read(temp_path)
        if len(audio_data.shape) > 1:
            audio_data = np.mean(audio_data, axis=1) # stereo to mono
            
        # Resample to 16000Hz if needed
        if sr != 16000:
            import librosa
            audio_data = librosa.resample(audio_data, orig_sr=sr, target_sr=16000)
            sr = 16000

        # Save to static audio directory for web player
        save_filename = f"live_{file.filename}.wav"
        save_path = os.path.join(AUDIO_DIR, save_filename)
        sf.write(save_path, audio_data, sr)

        # Run STT + Emotion Pipeline
        whisper_transcript = transcribe_audio(audio_data, sr)
        wer_val = compute_wer(reference_transcript, whisper_transcript) if reference_transcript else 0.0
        
        emotion_result = analyze_stress_and_emotion(
            audio_data, sr, 
            arousal_thresh=arousal_thresh, 
            valence_thresh=valence_thresh
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
            "mood_label": emotion_result["mood_label"]
        }

    except Exception as e:
        print(f"[Upload Error] {e}")
        raise HTTPException(status_code=500, detail=f"Failed to process audio clip: {str(e)}")
    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)

@app.get("/api/stats")
def get_system_stats():
    """Summary stats on dataset, STT WER accuracy, and mood distributions."""
    return get_stats()
