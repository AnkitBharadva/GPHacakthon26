import pandas as pd

def search():
    df = pd.read_csv("f1_team_radio_mp3s/metadata.csv")
    print(f"Total rows in metadata: {len(df)}")

    keywords = [
        "manipulated", "michael", "checo", "legend", "unbelievable",
        "abu dhabi", "yas marina", "champion", "safety car", "latifi",
        "give that back", "cut the chicane", "corner", "fresh tyres",
        "hamilton", "verstappen", "max", "lewis"
    ]

    for kw in keywords:
        matches = df[df['transcription'].astype(str).str.contains(kw, case=False, na=False)]
        print(f"\nKeyword '{kw}': {len(matches)} matches")
        if 0 < len(matches) <= 8:
            for idx, r in matches.iterrows():
                print(f"  [{r['file_name']}] {r['transcription']}")

if __name__ == "__main__":
    search()
