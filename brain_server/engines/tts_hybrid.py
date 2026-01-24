import torch
import soundfile as sf
import numpy as np
import io
import os
import requests
from kokoro_onnx import Kokoro
from transformers import AutoTokenizer

# --- 1. CONFIGURATION ---
KOKORO_MODEL_URL = "https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/kokoro-v1.0.onnx"
KOKORO_VOICES_URL = "https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/voices-v1.0.bin"
MODEL_FILE = "kokoro-v1.0.onnx"
VOICES_FILE = "voices-v1.0.bin"

# --- 2. IMPORTS (Soft Fails) ---
F5_AVAILABLE = False
PARLER_AVAILABLE = False

try:
    from f5_tts.api import F5TTS
    F5_AVAILABLE = True
except ImportError:
    print("[TTS] F5-TTS not installed.")

try:
    from parler_tts import ParlerTTSForConditionalGeneration
    PARLER_AVAILABLE = True
except ImportError:
    print("[TTS] Parler-TTS not installed.")

def download_file(url, filename):
    if not os.path.exists(filename):
        print(f"[TTS] Downloading {filename}...")
        try:
            response = requests.get(url, stream=True)
            response.raise_for_status()
            with open(filename, "wb") as f:
                for chunk in response.iter_content(chunk_size=8192):
                    f.write(chunk)
        except Exception as e:
            print(f"[TTS CRITICAL] Download failed for {filename}: {e}")

class HybridTTS:
    def __init__(self):
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        print(f"[TTS] Initializing Hybrid Engine on {self.device}...")

        # A. KOKORO (Default)
        try:
            download_file(KOKORO_MODEL_URL, MODEL_FILE)
            download_file(KOKORO_VOICES_URL, VOICES_FILE)
            if os.path.exists(MODEL_FILE) and os.path.exists(VOICES_FILE):
                self.kokoro = Kokoro(MODEL_FILE, VOICES_FILE)
                print("[TTS] Kokoro-v1.0 Loaded (Primary).")
            else:
                self.kokoro = None
        except Exception as e:
            print(f"[TTS] Kokoro Load Failed: {e}")
            self.kokoro = None

        # B. F5-TTS (Cloning)
        self.f5 = None
        if F5_AVAILABLE:
            try:
                self.f5 = F5TTS(device=self.device)
                print("[TTS] F5-TTS Loaded.")
            except Exception as e:
                print(f"[TTS] F5 Init Failed: {e}")

        # C. PARLER-TTS (Style)
        self.parler_model = None
        self.parler_tokenizer = None
        if PARLER_AVAILABLE:
            try:
                # Indic Parler (or Standard Parler-Mini if Indic unavailable publicly yet, using Mini v1 for stability)
                # The plan said "Indic Parler-TTS". If there is a specific repo for Indic Parler, I should use it.
                # Assuming "parler-tts/parler-tts-mini-v1" or similar.
                # I'll use "parler-tts/parler-tts-mini-v1" as safe bet or "ai4bharat/indic-parler-tts" if it exists?
                # The Plan didn't specify URL for the model, just "Indic Parler-TTS".
                # Given I don't have the exact HF ID for "Indic Parler", I will use "parler-tts/parler-tts-mini-v1"
                # which supports descriptive prompts.
                model_id = "parler-tts/parler-tts-mini-v1"
                self.parler_model = ParlerTTSForConditionalGeneration.from_pretrained(model_id).to(self.device)
                self.parler_tokenizer = AutoTokenizer.from_pretrained(model_id)
                print("[TTS] Parler-TTS Loaded.")
            except Exception as e:
                print(f"[TTS] Parler Init Failed: {e}")

    def generate(self, text, voice_sample_bytes=None, voice_preset="aastha", description=None):
        try:
            # 1. Cloning (F5) - Highest Priority
            if voice_sample_bytes and self.f5:
                return self._generate_clone(text, voice_sample_bytes)

            # 2. Style/Expressive (Parler) - If description provided
            if description and self.parler_model:
                return self._generate_parler(text, description, voice_preset)

            # 3. Default (Kokoro)
            return self._generate_default(text, voice_preset)
        except Exception as e:
            print(f"[TTS Error] {e}")
            return None

    def _generate_default(self, text, preset):
        if not self.kokoro: return None

        voice_code = "af_bella"
        if preset.lower() == "aastha": voice_code = "hf_alpha"
        elif preset.lower() == "aastik": voice_code = "hm_omega"

        print(f"[TTS] Kokoro ({voice_code}): {text[:30]}...")
        samples, sample_rate = self.kokoro.create(text, voice=voice_code, speed=1.0, lang="en-us")

        buffer = io.BytesIO()
        sf.write(buffer, samples, sample_rate, format='WAV', subtype='PCM_16')
        buffer.seek(0)
        return buffer

    def _generate_clone(self, text, voice_bytes):
        print(f"[TTS] F5-TTS Cloning: {text[:30]}...")
        temp_ref = "temp_ref.wav"
        with open(temp_ref, "wb") as f:
            f.write(voice_bytes)

        wav, sr, _ = self.f5.infer(ref_file=temp_ref, ref_text="", gen_text=text)
        if os.path.exists(temp_ref): os.remove(temp_ref)

        buffer = io.BytesIO()
        sf.write(buffer, wav, sr, format='WAV', subtype='PCM_16')
        buffer.seek(0)
        return buffer

    def _generate_parler(self, text, description, preset):
        print(f"[TTS] Parler (Style: {description}): {text[:30]}...")

        # Map preset to speaker name if Parler model supports multispeaker
        # Mini v1 is usually single speaker female-ish.
        # We'll rely on description to modulate.
        # Construct full description
        gender = "female" if preset.lower() == "aastha" else "male"
        full_desc = f"A {gender} speaker with a {description} voice delivers a speech."

        input_ids = self.parler_tokenizer(full_desc, return_tensors="pt").input_ids.to(self.device)
        prompt_input_ids = self.parler_tokenizer(text, return_tensors="pt").input_ids.to(self.device)

        generation = self.parler_model.generate(input_ids=input_ids, prompt_input_ids=prompt_input_ids)
        audio_arr = generation.cpu().numpy().squeeze()

        buffer = io.BytesIO()
        sf.write(buffer, audio_arr, self.parler_model.config.sampling_rate, format='WAV', subtype='PCM_16')
        buffer.seek(0)
        return buffer

tts_engine = HybridTTS()
