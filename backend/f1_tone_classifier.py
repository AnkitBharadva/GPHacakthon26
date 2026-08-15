import argparse
import sys
from pathlib import Path
import torch
import torch.nn as nn
import torch.nn.functional as F
from torch.nn.utils.rnn import pack_padded_sequence, pad_packed_sequence
import torchaudio
from transformers import WavLMModel

# Ensure UTF-8 output encoding for Windows terminal compatibility
if sys.stdout.encoding and sys.stdout.encoding.lower() != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

# ============================================================
# CONFIGURATION & CONSTANTS
# ============================================================

WAVLM_MODEL_NAME = "microsoft/wavlm-base-plus"

_CANDIDATE_PATHS = [
    Path(__file__).parent / "models" / "best_model.pt",
    Path(__file__).parent / "best_model.pt",
    Path(__file__).parent.parent / "checkpoints" / "best_model.pt",
    Path(__file__).parent.parent / "best_model.pt",
]

CHECKPOINT_PATH = next((p for p in _CANDIDATE_PATHS if p.exists()), _CANDIDATE_PATHS[0])

INPUT_DIR = Path("input")
TARGET_SR = 16000

EMOTION_CLASSES = ["Anger", "Disgust", "Fear", "Happy", "Neutral", "Sad"]

_GLOBAL_PREDICTOR = None

def get_tone_predictor():
    global _GLOBAL_PREDICTOR
    if _GLOBAL_PREDICTOR is None:
        _GLOBAL_PREDICTOR = FinalPredictor(checkpoint_path=CHECKPOINT_PATH)
    return _GLOBAL_PREDICTOR

def predict_f1_tone(audio_path, start_sec=0.0, end_sec=None):
    """
    Infers 6-class F1 Driver Tone using WinFunction/Tone-Detector-f1 and
    translates the 6 classes into the 3 canonical pit-wall states (STRESSED, TIRED, CALM).
    """
    try:
        predictor = get_tone_predictor()
        res = predictor.predict_single(audio_path, start_sec=start_sec, end_sec=end_sec)
        
        probs = res.get("probabilities", {})
        p_anger = probs.get("Anger", 0.0)
        p_disgust = probs.get("Disgust", 0.0)
        p_fear = probs.get("Fear", 0.0)
        p_happy = probs.get("Happy", 0.0)
        p_neutral = probs.get("Neutral", 0.0)
        p_sad = probs.get("Sad", 0.0)
        
        # Option 2: Top-1 Argmax Translation (Winning-Class Mapping)
        # Prevents 3-class entropy bias (where summing Anger+Disgust+Fear artificially beats a strong Neutral)
        raw_dominant = res.get("predicted_emotion", "Neutral")
        
        CLASS_TO_3STATE = {
            "Anger": "STRESSED",
            "Disgust": "STRESSED",
            "Fear": "STRESSED",
            "Sad": "TIRED",
            "Neutral": "CALM",
            "Happy": "CALM"
        }
        translated_state = CLASS_TO_3STATE.get(raw_dominant, "CALM")
        translated_confidence = probs.get(raw_dominant, res.get("confidence", 0.0))
        
        # 3-Class Aggregate Distributions for HUD display
        p_stressed = round(p_anger + p_disgust + p_fear, 2)
        p_tired = round(p_sad, 2)
        p_calm = round(p_neutral + p_happy, 2)
        
        translated_scores = {
            "STRESSED": p_stressed,
            "TIRED": p_tired,
            "CALM": p_calm
        }
        
        return {
            "status": "success",
            "model_name": "WinFunction/Tone-Detector-f1",
            "model_architecture": "WavLM-Base-Plus + BiLSTM + Attention Head",
            "predicted_emotion": raw_dominant,
            "confidence": res["confidence"],
            "probabilities": probs,
            "translated_state": translated_state,
            "translated_confidence": translated_confidence,
            "translated_method": "Top-1 Argmax Winning Class Mapping",
            "translated_probabilities": translated_scores,
            "translation_mapping": {
                "STRESSED": ["Anger", "Disgust", "Fear"],
                "TIRED": ["Sad"],
                "CALM": ["Neutral", "Happy"]
            },
            "chunks_processed": res.get("chunks_processed", 1),
            "chunk_predictions": res.get("chunk_predictions", [])
        }
    except Exception as e:
        import traceback
        return {
            "status": "error",
            "error": str(e),
            "model_name": "WinFunction/Tone-Detector-f1",
            "predicted_emotion": "Neutral",
            "confidence": 0.0,
            "probabilities": {cls_name: 0.0 for cls_name in EMOTION_CLASSES},
            "translated_state": "CALM",
            "translated_confidence": 0.0,
            "translated_probabilities": {"STRESSED": 0.0, "TIRED": 0.0, "CALM": 0.0},
            "translation_mapping": {
                "STRESSED": ["Anger", "Disgust", "Fear"],
                "TIRED": ["Sad"],
                "CALM": ["Neutral", "Happy"]
            }
        }
# MODEL ARCHITECTURE DEFINITION (Self-Contained Single File)
# ============================================================

class BiLSTMFeatureExtractor(nn.Module):
    def __init__(self, input_size=768, hidden_size=128, num_layers=1, dropout=0.0):
        super(BiLSTMFeatureExtractor, self).__init__()
        self.input_size = input_size
        self.hidden_size = hidden_size
        self.num_layers = num_layers
        self.bidirectional = True
        
        self.bilstm = nn.LSTM(
            input_size=input_size,
            hidden_size=hidden_size,
            num_layers=num_layers,
            batch_first=True,
            bidirectional=True,
            dropout=dropout if num_layers > 1 else 0.0
        )
        
    def forward(self, x, mask=None):
        batch_size, seq_len, _ = x.shape
        
        if mask is not None:
            lengths = mask.sum(dim=1).cpu()
            packed_x = pack_padded_sequence(
                x,
                lengths,
                batch_first=True,
                enforce_sorted=False
            )
            packed_out, (hn, cn) = self.bilstm(packed_x)
            out, _ = pad_packed_sequence(
                packed_out,
                batch_first=True,
                total_length=seq_len
            )
        else:
            out, (hn, cn) = self.bilstm(x)
            
        return out


class TemporalAttention(nn.Module):
    def __init__(self, input_dim=256):
        super(TemporalAttention, self).__init__()
        self.input_dim = input_dim
        self.w = nn.Linear(input_dim, 1, bias=False)
        
    def forward(self, h, mask=None):
        scores = self.w(torch.tanh(h)).squeeze(-1)  # [B, T]
        
        if mask is not None:
            scores = scores.masked_fill(mask == 0, -1e9)
            
        attn_weights = torch.softmax(scores, dim=1)  # [B, T]
        context = torch.bmm(attn_weights.unsqueeze(1), h).squeeze(1)  # [B, 256]
        
        return context, attn_weights


class BiLSTMAttentionClassifier(nn.Module):
    def __init__(self, input_size=768, hidden_size=128, num_classes=6, dropout=0.3):
        super(BiLSTMAttentionClassifier, self).__init__()
        self.bilstm = BiLSTMFeatureExtractor(
            input_size=input_size,
            hidden_size=hidden_size,
            num_layers=1,
            dropout=dropout
        )
        context_dim = hidden_size * 2  # 256
        self.attention = TemporalAttention(input_dim=context_dim)
        self.dropout = nn.Dropout(dropout)
        self.classifier = nn.Linear(context_dim, num_classes)
        
    def forward(self, x, mask=None):
        bilstm_out = self.bilstm(x, mask=mask)
        context, attn_weights = self.attention(bilstm_out, mask=mask)
        dropped_context = self.dropout(context)
        logits = self.classifier(dropped_context)
        return logits, attn_weights

# ============================================================
# EXACT AUDIO PREPROCESSING LOGIC (Used During Training)
# ============================================================

def preprocess_audio(audio_path, apply_f1_filter=True):
    """
    Load raw audio file (.wav, .mp3, .flac, .ogg), convert to 16 kHz mono, and peak-normalize amplitude.
    """
    audio_path = Path(audio_path)
    
    # 1. Load audio with torchaudio, fallback to soundfile for mp3/flac if needed
    try:
        waveform, sample_rate = torchaudio.load(str(audio_path))
    except Exception:
        import soundfile as sf
        data, sample_rate = sf.read(str(audio_path))
        waveform = torch.tensor(data, dtype=torch.float32)
        if waveform.ndim == 1:
            waveform = waveform.unsqueeze(0)
        elif waveform.ndim == 2:
            waveform = waveform.T
            
    # 2. Convert to mono if multi-channel
    if waveform.shape[0] > 1:
        waveform = waveform.mean(dim=0, keepdim=True)
        
    # 3. Resample to 16 kHz if necessary
    if sample_rate != TARGET_SR:
        resampler = torchaudio.transforms.Resample(orig_freq=sample_rate, new_freq=TARGET_SR)
        waveform = resampler(waveform)
        
    # 4. Optional Highpass Filter (150 Hz) to remove low-frequency engine rumbles
    if apply_f1_filter:
        try:
            waveform = torchaudio.functional.highpass_biquad(waveform, sample_rate=TARGET_SR, cutoff_freq=150.0)
        except Exception:
            pass

    # 5. Squeeze channel dimension [1, num_samples] -> [num_samples]
    waveform = waveform.squeeze(0)
    
    # 6. Amplitude peak normalization
    max_val = waveform.abs().max()
    if max_val > 0:
        waveform = waveform / max_val
        
    return waveform

# ============================================================
# FINAL PREDICTOR PIPELINE CLASS
# ============================================================

class FinalPredictor:
    def __init__(self, checkpoint_path=CHECKPOINT_PATH):
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        print("=" * 60)
        print("INITIALIZING F1 DRIVER TONE DETECTOR PIPELINE")
        print("=" * 60)
        print(f"Compute Device : {self.device}")
        if self.device.type == "cuda":
            print(f"GPU            : {torch.cuda.get_device_name(0)}")
            
        print(f"\n[1] Loading WavLM Encoder ({WAVLM_MODEL_NAME})...")
        self.wavlm = WavLMModel.from_pretrained(WAVLM_MODEL_NAME).to(self.device)
        self.wavlm.eval()
        
        checkpoint_path = Path(checkpoint_path)
        print(f"[2] Loading Trained Downstream Model ({checkpoint_path})...")
        if not checkpoint_path.exists():
            raise FileNotFoundError(f"Checkpoint file not found at {checkpoint_path}. Please run training first!")
            
        self.classifier = BiLSTMAttentionClassifier(
            input_size=768,
            hidden_size=128,
            num_classes=6
        ).to(self.device)
        
        checkpoint = torch.load(checkpoint_path, map_location=self.device, weights_only=False)
        self.classifier.load_state_dict(checkpoint["model_state_dict"])
        self.classifier.eval()
        print("Pipeline initialized and ready for inference!")
        print("=" * 60)
        
    def predict_single(self, audio_path, start_sec=0.0, end_sec=None, chunk_sec=3.0, calibrate_f1_radio=True):
        audio_path = Path(audio_path)
        if not audio_path.exists():
            raise FileNotFoundError(f"Audio file not found: {audio_path}")
            
        # 1. Preprocess raw audio waveform -> [num_samples] (with Highpass engine rumble filter)
        full_waveform = preprocess_audio(audio_path, apply_f1_filter=calibrate_f1_radio)
        full_num_samples = full_waveform.size(0)
        total_duration_sec = full_num_samples / float(TARGET_SR)
        
        # 2. Trim waveform based on start_sec and end_sec
        start_sample = max(0, int(start_sec * TARGET_SR))
        if end_sec is not None and end_sec > start_sec:
            end_sample = min(full_num_samples, int(end_sec * TARGET_SR))
        else:
            end_sample = full_num_samples
            
        waveform = full_waveform[start_sample:end_sample]
        num_samples = waveform.size(0)
        duration_sec = num_samples / float(TARGET_SR)
        
        chunk_samples = int(chunk_sec * TARGET_SR)  # 3.0 * 16000 = 48,000 samples
        
        chunk_probs_list = []
        chunk_details = []
        last_attn_weights = None
        
        with torch.no_grad():
            # If audio is longer than 3 seconds, slice into 3-second chunks
            if num_samples > chunk_samples:
                # 3-second non-overlapping chunks (or padded last chunk)
                starts = list(range(0, num_samples, chunk_samples))
                
                for idx, start in enumerate(starts):
                    end = min(start + chunk_samples, num_samples)
                    chunk_wave = waveform[start:end]
                    
                    # If last chunk is shorter than 0.5 sec and not first chunk, skip
                    if chunk_wave.size(0) < TARGET_SR * 0.5 and idx > 0:
                        continue
                        
                    if chunk_wave.size(0) < chunk_samples:
                        pad_len = chunk_samples - chunk_wave.size(0)
                        chunk_wave = F.pad(chunk_wave, (0, pad_len))
                        
                    chunk_input = chunk_wave.unsqueeze(0).to(self.device)
                    outputs = self.wavlm(input_values=chunk_input)
                    embedding = outputs.last_hidden_state
                    mask = torch.ones((1, embedding.size(1)), dtype=torch.int64, device=self.device)
                    
                    logits, attn_weights = self.classifier(embedding, mask=mask)
                    
                    # Apply Domain Calibration offset to remove artificial radio Disgust bias
                    if calibrate_f1_radio:
                        disgust_idx = EMOTION_CLASSES.index("Disgust")
                        logits[:, disgust_idx] -= 1.2
                        
                    probs = F.softmax(logits, dim=-1).squeeze(0)
                    chunk_probs_list.append(probs)
                    last_attn_weights = attn_weights.squeeze(0).cpu().numpy()
                    
                    # Store 3-second chunk detail with absolute timestamps
                    abs_start_sec = round(start_sec + (start / float(TARGET_SR)), 2)
                    abs_end_sec = round(start_sec + (min((start + chunk_samples), num_samples) / float(TARGET_SR)), 2)
                    
                    c_id = torch.argmax(probs).item()
                    c_emotion = EMOTION_CLASSES[c_id]
                    c_conf = probs[c_id].item() * 100.0
                    c_probs = {EMOTION_CLASSES[i]: round(probs[i].item() * 100.0, 2) for i in range(len(EMOTION_CLASSES))}
                    
                    chunk_details.append({
                        "chunk_index": idx + 1,
                        "time_range": f"{abs_start_sec:.1f}s - {abs_end_sec:.1f}s",
                        "start_sec": abs_start_sec,
                        "end_sec": abs_end_sec,
                        "predicted_emotion": c_emotion,
                        "confidence": round(c_conf, 2),
                        "probabilities": c_probs
                    })
                    
                if chunk_probs_list:
                    overall_probabilities = torch.stack(chunk_probs_list).mean(dim=0)
                else:
                    input_values = waveform.unsqueeze(0).to(self.device)
                    outputs = self.wavlm(input_values=input_values)
                    embedding = outputs.last_hidden_state
                    mask = torch.ones((1, embedding.size(1)), dtype=torch.int64, device=self.device)
                    logits, attn_weights = self.classifier(embedding, mask=mask)
                    if calibrate_f1_radio:
                        disgust_idx = EMOTION_CLASSES.index("Disgust")
                        logits[:, disgust_idx] -= 1.2
                    overall_probabilities = F.softmax(logits, dim=-1).squeeze(0)
                    last_attn_weights = attn_weights.squeeze(0).cpu().numpy()
            else:
                # Single pass for short audio (<= 3s)
                input_values = waveform.unsqueeze(0).to(self.device)
                outputs = self.wavlm(input_values=input_values)
                embedding = outputs.last_hidden_state
                mask = torch.ones((1, embedding.size(1)), dtype=torch.int64, device=self.device)
                logits, attn_weights = self.classifier(embedding, mask=mask)
                if calibrate_f1_radio:
                    disgust_idx = EMOTION_CLASSES.index("Disgust")
                    logits[:, disgust_idx] -= 1.2
                overall_probabilities = F.softmax(logits, dim=-1).squeeze(0)
                last_attn_weights = attn_weights.squeeze(0).cpu().numpy()
                
                abs_start_sec = round(start_sec, 2)
                abs_end_sec = round(start_sec + duration_sec, 2)
                c_id = torch.argmax(overall_probabilities).item()
                c_probs = {EMOTION_CLASSES[i]: round(overall_probabilities[i].item() * 100.0, 2) for i in range(len(EMOTION_CLASSES))}
                chunk_details.append({
                    "chunk_index": 1,
                    "time_range": f"{abs_start_sec:.1f}s - {abs_end_sec:.1f}s",
                    "start_sec": abs_start_sec,
                    "end_sec": abs_end_sec,
                    "predicted_emotion": EMOTION_CLASSES[c_id],
                    "confidence": round(overall_probabilities[c_id].item() * 100.0, 2),
                    "probabilities": c_probs
                })

        pred_id = torch.argmax(overall_probabilities).item()
        pred_emotion = EMOTION_CLASSES[pred_id]
        confidence = overall_probabilities[pred_id].item() * 100.0
        
        probs_dict = {
            EMOTION_CLASSES[i]: round(overall_probabilities[i].item() * 100.0, 2)
            for i in range(len(EMOTION_CLASSES))
        }
        
        return {
            "audio_file": audio_path.name,
            "total_audio_duration_sec": round(total_duration_sec, 2),
            "selected_start_sec": round(start_sec, 2),
            "selected_end_sec": round(end_sec if end_sec is not None else total_duration_sec, 2),
            "duration_sec": round(duration_sec, 2),
            "predicted_emotion": pred_emotion,
            "confidence": round(confidence, 2),
            "probabilities": probs_dict,
            "attention_weights": last_attn_weights,
            "chunks_processed": len(chunk_details),
            "chunk_predictions": chunk_details
        }

# Alias for backward compatibility
ToneDetectorF1Predictor = FinalPredictor

# ============================================================
# MAIN CLI DRIVER
# ============================================================

def print_report(result):
    print("\n" + "=" * 60)
    print(f"PREDICTION REPORT: {result['audio_file']}")
    print("=" * 60)
    print(f"Predicted Emotion : {result['predicted_emotion']} ({result['confidence']:.2f}% confidence)")
    print("-" * 60)
    print("EMOTION PROBABILITY BREAKDOWN:")
    for emotion, prob in result["probabilities"].items():
        bar = "#" * int(prob / 5)
        print(f"  {emotion:10s} : {prob:6.2f}% | {bar}")
    print("=" * 60)


def main():
    parser = argparse.ArgumentParser(description="F1 Driver Tone Predictor (ToneDetectorF1 Package)")
    parser.add_argument("--audio_path", type=str, default=None,
                        help="Path to specific raw driver audio file (.wav, .mp3, .flac, .ogg)")
    args = parser.parse_args()

    predictor = FinalPredictor()

    if args.audio_path:
        target_path = Path(args.audio_path)
        result = predictor.predict_single(target_path)
        print_report(result)
    else:
        # Scan input directory
        INPUT_DIR.mkdir(parents=True, exist_ok=True)
        valid_extensions = {".wav", ".mp3", ".flac", ".ogg", ".m4a"}
        audio_files = [
            f for f in INPUT_DIR.iterdir()
            if f.is_file() and f.suffix.lower() in valid_extensions
        ]

        if not audio_files:
            print(f"\n[INFO] No audio files found in 'input/' directory ({INPUT_DIR.resolve()}).")
            print("Usage Options:")
            print("  1. Place audio files in 'input/' folder and run: python modeling_f1tone.py")
            print("  2. Specify file path: python modeling_f1tone.py --audio_path <path_to_audio_file>")
        else:
            print(f"\nFound {len(audio_files)} audio file(s) in 'input/' directory. Processing predictions...")
            for audio_file in audio_files:
                result = predictor.predict_single(audio_file)
                print_report(result)


if __name__ == "__main__":
    main()
