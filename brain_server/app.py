import hmac
import os

from fastapi import Depends, FastAPI, File, Form, Header, HTTPException, UploadFile
from fastapi.responses import StreamingResponse

from engines.tts_hybrid import tts_engine
from engines.vision import vision_engine

app = FastAPI(title="Aastha Brain Server", description="The Vision & Voice Microservice")

# Shared secret between the Node API and this service.
# Set BRAIN_SHARED_SECRET in BOTH the Hugging Face Space secrets and the Render env.
# If unset, requests are allowed (so existing deploys keep working) but a warning is logged.
BRAIN_SHARED_SECRET = os.environ.get("BRAIN_SHARED_SECRET", "")
if not BRAIN_SHARED_SECRET:
    print("[Security] WARNING: BRAIN_SHARED_SECRET is not set — /speak and /see are publicly callable.")


def require_secret(x_brain_secret: str = Header(default="")):
    if not BRAIN_SHARED_SECRET:
        return
    if not hmac.compare_digest(x_brain_secret, BRAIN_SHARED_SECRET):
        raise HTTPException(status_code=401, detail="Unauthorized")


@app.get("/")
def health_check():
    return {
        "status": "online",
        "gpu": "available" if tts_engine.device == "cuda" else "cpu",
    }


@app.post("/speak", dependencies=[Depends(require_secret)])
async def speak(
    text: str = Form(...),
    voice_preset: str = Form("aastha"),
    description: str = Form(None),  # Style Tag content
    voice_sample: UploadFile = File(None),
):
    """
    Hybrid TTS Endpoint.
    - If `voice_sample` is provided: Uses F5-TTS for cloning.
    - If `description` is provided: Uses Parler-TTS for expressive style.
    - Else: Uses Kokoro-v1.0 (Standard/Fast).
    """
    try:
        voice_bytes = None
        if voice_sample:
            voice_bytes = await voice_sample.read()

        audio_buffer = tts_engine.generate(text, voice_bytes, voice_preset, description)
    except Exception as e:
        print(f"Speak Error: {e}")
        raise HTTPException(status_code=500, detail="TTS generation failed")

    if not audio_buffer:
        raise HTTPException(status_code=500, detail="TTS generation failed")

    return StreamingResponse(audio_buffer, media_type="audio/wav")


@app.post("/see", dependencies=[Depends(require_secret)])
async def see(image: UploadFile = File(...)):
    """
    Vision Endpoint (BLIP).
    Returns a text caption of the image.
    """
    try:
        image_bytes = await image.read()
        caption = vision_engine.analyze(image_bytes)
        return {"caption": caption}
    except Exception as e:
        print(f"See Error: {e}")
        raise HTTPException(status_code=500, detail="Image analysis failed")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=7860)
