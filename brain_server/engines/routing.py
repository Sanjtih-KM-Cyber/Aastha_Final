"""
Voice routing (ROADMAP V1, V2): pick ONE consistent voice per persona and the right pronunciation
language for the text. Pure Python (no model imports) so it can be unit-tested anywhere.

- Latin script (English / romanised Hinglish)  -> Kokoro, persona voice, lang "en-us"
- Devanagari (Hindi / Marathi native script)    -> Kokoro, SAME persona voice, lang "hi"
- Other Indic scripts (Bengali, Tamil, ...)     -> Indic Parler (Kokoro can't speak them), fixed persona description
- A cloning sample                              -> F5 (only when explicitly provided)

The [STYLE: ...] tag no longer switches engines (that made Aastha's voice change between notes);
it only nudges speaking speed.
"""
import os
import re

KOKORO_VOICES = {
    "aastha": os.environ.get("KOKORO_VOICE_AASTHA", "hf_alpha"),  # Hindi-trained female voice
    "aastik": os.environ.get("KOKORO_VOICE_AASTIK", "hm_omega"),  # Hindi-trained male voice
}

DEVANAGARI = re.compile(r"[ऀ-ॿ]")
OTHER_INDIC = re.compile(
    r"[ঀ-৿਀-੿઀-૿଀-୿஀-௿ఀ-౿ಀ-೿ഀ-ൿ]"
)
LETTER = re.compile(r"[A-Za-zऀ-ൿ]")

SLOW_WORDS = ("slow", "soft", "gentle", "calm", "whisper", "sad", "tender", "soothing")
FAST_WORDS = ("fast", "excited", "energetic", "cheerful", "upbeat")


def detect_script(text: str) -> str:
    letters = LETTER.findall(text or "")
    if not letters:
        return "latin"
    deva = sum(1 for ch in letters if DEVANAGARI.match(ch))
    other = sum(1 for ch in letters if OTHER_INDIC.match(ch))
    if other / len(letters) > 0.3:
        return "other_indic"
    if deva / len(letters) > 0.3:
        return "devanagari"
    return "latin"


def speed_for(description):
    d = (description or "").lower()
    if any(w in d for w in SLOW_WORDS):
        return 0.92
    if any(w in d for w in FAST_WORDS):
        return 1.06
    return 1.0


def choose_engine(text: str, has_voice_sample: bool, voice_preset: str = "aastha", description=None) -> dict:
    preset = "aastik" if (voice_preset or "").lower() in ("aastik", "aarav") else "aastha"
    if has_voice_sample:
        return {"engine": "f5"}
    script = detect_script(text)
    if script == "other_indic":
        return {"engine": "parler", "gender": "male" if preset == "aastik" else "female", "description": description}
    return {
        "engine": "kokoro",
        "voice": KOKORO_VOICES[preset],
        "lang": "hi" if script == "devanagari" else "en-us",
        "speed": speed_for(description),
    }


def trim_for_speech(text: str, limit: int = 1500) -> str:
    """Cut at a sentence boundary (incl. Hindi danda) instead of mid-word."""
    text = (text or "").strip()
    if len(text) <= limit:
        return text
    cut = text[:limit]
    best = max(cut.rfind(p) for p in (". ", "! ", "? ", "। ", "\n"))
    return cut[: best + 1].strip() if best > limit * 0.5 else cut.rsplit(" ", 1)[0].strip()
