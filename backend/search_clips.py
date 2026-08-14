import os
import glob
import pandas as pd

def search_for_clips():
    print("--- 1. Searching f1_team_radio_mp3s metadata ---")
    meta_file = "f1_team_radio_mp3s/metadata.csv"
    if os.path.exists(meta_file):
        df = pd.read_csv(meta_file)
        print(f"Total rows in metadata.csv: {len(df)}")
        print(f"Columns: {df.columns.tolist()}")
        print(f"Driver counts:\n{df['driver'].value_counts().head(10)}")
        
        # Search for Abu Dhabi, 2021, Max, Lewis, Hamilton, Verstappen, etc.
        patterns = ['abu dhabi', '2021', 'verstappen', 'hamilton', 'michael', 'checo', 'manipulated', 'safety car']
        for p in patterns:
            matches = df[df.apply(lambda r: r.astype(str).str.contains(p, case=False).any(), axis=1)]
            print(f"Pattern '{p}': {len(matches)} matches")
            if len(matches) > 0 and len(matches) <= 10:
                print(matches.to_dict(orient='records'))
    else:
        print("f1_team_radio_mp3s/metadata.csv not found.")
        mp3s = glob.glob("f1_team_radio_mp3s/*.mp3") + glob.glob("f1_team_radio_mp3s/*.wav")
        print(f"Total audio files in f1_team_radio_mp3s: {len(mp3s)}")
        if mp3s:
            print(f"Sample audio files: {mp3s[:10]}")

    print("\n--- 2. Searching other directories for 2021/Abu Dhabi audio files ---")
    all_audio = glob.glob("**/*.mp3", recursive=True) + glob.glob("**/*.wav", recursive=True)
    print(f"All audio files in project: {len(all_audio)}")
    for a in all_audio:
        if any(w in a.lower() for w in ['2021', 'abu', 'dhabi', 'ver', 'ham', 'radio']):
            print(f"  -> {a}")

if __name__ == "__main__":
    search_for_clips()
