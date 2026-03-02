import io
import wave
import traceback
from fastapi import FastAPI, HTTPException
from fastapi.responses import Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import sys

# We will try to import piper but also fallback if needed.
try:
    from piper.voice import PiperVoice
except ImportError:
    PiperVoice = None

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class TTSRequest(BaseModel):
    text: str
    voice: str = "en_US-amy-low"

loaded_voices = {}

@app.get("/health")
async def health_check():
    return {"status": "ok", "piper": PiperVoice is not None}

@app.get("/voices")
async def get_voices():
    import os
    voices = []
    models_dir = "models/piper"
    if os.path.exists(models_dir):
        for filename in os.listdir(models_dir):
            if filename.endswith(".onnx"):
                voice_id = filename[:-5]
                voices.append({
                    "id": voice_id,
                    "name": voice_id.replace("_", " ").title(),
                    "lang": voice_id.split("-")[0] if "-" in voice_id else "en-US"
                })
    return voices

@app.post("/tts")
async def generate_tts(req: TTSRequest):
    if PiperVoice is None:
        raise HTTPException(status_code=500, detail="piper-tts is not installed")
        
    model_path = f"models/piper/{req.voice}.onnx"
    try:
        if req.voice not in loaded_voices:
            loaded_voices[req.voice] = PiperVoice.load(model_path)
            
        voice = loaded_voices[req.voice]
        
        wav_io = io.BytesIO()
        with wave.open(wav_io, "wb") as wav_file:
            wav_file.setnchannels(1)
            wav_file.setsampwidth(2)
            wav_file.setframerate(voice.config.sample_rate)
            voice.synthesize_wav(req.text, wav_file)
            
        wav_bytes = wav_io.getvalue()
        return Response(content=wav_bytes, media_type="audio/wav")
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=3002)
