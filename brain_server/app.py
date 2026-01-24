from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.responses import StreamingResponse
from engines.tts_hybrid import tts_engine
from engines.vision import vision_engine

app = FastAPI(title="Aastha Brain Server", description="The Vision & Voice Microservice")

@app.get("/")
def health_check():
    return {
        "status": "online",
        "gpu": "available" if tts_engine.device == "cuda" else "cpu",
        "model": "Kokoro-v1.0 + Parler-TTS + F5-TTS"
    }

@app.post("/speak")
async def speak(
    text: str = Form(...),
    voice_preset: str = Form("aastha"),
    description: str = Form(None), # Style Tag content
    voice_sample: UploadFile = File(None)
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

        # Pass arguments to engine
        audio_buffer = tts_engine.generate(text, voice_bytes, voice_preset, description)

        if not audio_buffer:
            raise HTTPException(status_code=500, detail="TTS Generation Failed")

        return StreamingResponse(audio_buffer, media_type="audio/wav")

    except Exception as e:
        print(f"Speak Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/see")
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
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=7860)
