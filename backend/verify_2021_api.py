import requests

def verify():
    ver = requests.get('http://127.0.0.1:8000/api/races/2021_Abu_Dhabi_Grand_Prix/drivers/MAXVER01/messages').json()
    ham = requests.get('http://127.0.0.1:8000/api/races/2021_Abu_Dhabi_Grand_Prix/drivers/LEWHAM01/messages').json()

    print(f"VER Total Audio Clips: {len(ver)}")
    for m in ver:
        print(f"  [VER Lap #{m['lap_number']}] {m['whisper_transcript'][:55]}... -> {m['audio_filename']}")

    print(f"\nHAM Total Audio Clips: {len(ham)}")
    for m in ham:
        print(f"  [HAM Lap #{m['lap_number']}] {m['whisper_transcript'][:55]}... -> {m['audio_filename']}")

if __name__ == "__main__":
    verify()
