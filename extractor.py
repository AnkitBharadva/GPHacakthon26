import os
import pandas as pd
from datasets import load_dataset, Audio
from tqdm import tqdm

# 1. Create output directory
output_dir = "./f1_team_radio_mp3s"
os.makedirs(output_dir, exist_ok=True)

print("Downloading/Loading dataset...")
ds = load_dataset("MikCil/f1-team-radio", split="train")

# 2. CRITICAL STEP: Disable automatic audio decoding
# This completely bypasses torchcodec and FFmpeg
ds = ds.cast_column("audio", Audio(decode=False))

metadata = []

print("Extracting raw audio files...")
for idx, item in enumerate(tqdm(ds)):
    audio_data = item["audio"]
    
    # 'audio_data' is now a dictionary containing the raw file bytes
    raw_bytes = audio_data.get("bytes")
    
    # Determine the file extension
    original_path = audio_data.get("path", "")
    ext = os.path.splitext(original_path)[-1] if original_path else ".mp3"
    if not ext:
        ext = ".mp3"
        
    filename = f"radio_{idx:05d}{ext}"
    filepath = os.path.join(output_dir, filename)
    
    # 3. Save the raw audio binary directly to disk
    if raw_bytes:
        with open(filepath, "wb") as f:
            f.write(raw_bytes)
            
    # 4. Record metadata
    metadata.append({
        "file_name": filename,
        "transcription": item.get("text", item.get("transcription", "")),
        "driver": item.get("driver", ""),
        "team": item.get("team", "")
    })

# Save metadata table
df = pd.DataFrame(metadata)
df.to_csv(os.path.join(output_dir, "metadata.csv"), index=False)

print(f"\nSuccessfully extracted {len(ds)} audio files into '{output_dir}'.")