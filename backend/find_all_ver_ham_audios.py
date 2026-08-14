import pandas as pd
import os
import glob

def find_all():
    df = pd.read_csv("f1_team_radio_mp3s/metadata.csv")
    print(f"Total dataset clips: {len(df)}")

    # 1. Search by 'driver' column
    if 'driver' in df.columns:
        print("\n--- Non-empty drivers in metadata ---")
        non_empty = df[df['driver'].notna() & (df['driver'] != '')]
        print(f"Clips with explicit driver field: {len(non_empty)}")
        print(non_empty['driver'].value_counts().head(20))

    # 2. Search by transcription mentions
    ver_matches = df[df['transcription'].astype(str).str.contains(r'\b(max|verstappen|red bull|checo|horner|gp)\b', case=False, regex=True, na=False)]
    ham_matches = df[df['transcription'].astype(str).str.contains(r'\b(lewis|hamilton|mercedes|bono|toto|bottas)\b', case=False, regex=True, na=False)]

    print(f"\nTotal Max/RedBull-related clips found: {len(ver_matches)}")
    print(f"Total Lewis/Mercedes-related clips found: {len(ham_matches)}")

    print("\n--- Top Max Clips Sample ---")
    for idx, r in ver_matches.head(15).iterrows():
        print(f"[{r['file_name']}] {r['transcription']}")

    print("\n--- Top Lewis Clips Sample ---")
    for idx, r in ham_matches.head(15).iterrows():
        print(f"[{r['file_name']}] {r['transcription']}")

if __name__ == "__main__":
    find_all()
