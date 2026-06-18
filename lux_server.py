#!/usr/bin/env python3
"""
LuxTTS Server for OmniversifyStudio
Lightweight, ultra-fast TTS with voice cloning (1GB VRAM, 150x realtime)

Install:
  pip install git+https://github.com/ysharma3501/LuxTTS.git
  pip install fastapi uvicorn soundfile scipy

Run:
  python3 lux_server.py
"""

from fastapi import FastAPI, Request
from fastapi.responses import StreamingResponse, FileResponse
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import io
import sys
import os
import tempfile

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

model = None
model_loaded = False
device = "cpu"


def load_model():
    global model, model_loaded, device
    if model_loaded:
        return

    try:
        import torch

        # Auto-detect device
        if torch.cuda.is_available():
            device = "cuda"
            print(f"[LuxTTS] Using GPU: {torch.cuda.get_device_name(0)}")
        elif hasattr(torch.backends, "mps") and torch.backends.mps.is_available():
            device = "mps"
            print("[LuxTTS] Using Apple MPS")
        else:
            device = "cpu"
            print("[LuxTTS] Using CPU")

        print(f"[LuxTTS] Loading model on {device}...")

        from zipvoice.luxvoice import LuxTTS

        model = LuxTTS("YatharthS/LuxTTS", device=device, threads=4)
        model_loaded = True
        print("[LuxTTS] Model loaded!")
        print("[LuxTTS] ~150x realtime on GPU, >1x on CPU")
        print("[LuxTTS] 48kHz high-quality output")
    except ImportError as e:
        print(f"[LuxTTS] Error: Missing dependency - {e}")
        print(
            "[LuxTTS] Install with: pip install git+https://github.com/ysharma3501/LuxTTS.git"
        )
        sys.exit(1)
    except Exception as e:
        print(f"[LuxTTS] Failed to load model: {e}")
        sys.exit(1)


@app.on_event("startup")
async def startup():
    load_model()


@app.get("/health")
async def health():
    return {
        "status": "ok",
        "tts_engine": "lux",
        "model_loaded": model_loaded,
        "device": device,
    }


@app.get("/voices")
async def voices():
    """List available voice presets (placeholder for future)"""
    return {
        "voices": [
            {"id": "default", "name": "Default", "lang": "en"},
        ],
        "note": "LuxTTS uses voice cloning - provide reference audio for custom voices",
    }


@app.post("/tts")
async def tts_simple(request: Request):
    """
    Simple TTS endpoint with optional voice cloning
    """
    if not model_loaded:
        return StreamingResponse(
            iter([b'{"error": "Model not loaded"}']),
            media_type="application/json",
            status_code=503,
        )

    try:
        import soundfile as sf
        import torch

        body = await request.json()
        text = body.get("text", "")
        reference_audio_path = body.get("reference_audio", None)
        speed = body.get("speed", 1.0)
        num_steps = body.get("num_steps", 4)

        if not text:
            return StreamingResponse(
                iter([b'{"error": "No text provided"}']),
                media_type="application/json",
                status_code=400,
            )

        print(f"[LuxTTS] Generating: {text[:50]}...")

        # If reference audio path is provided, use it for voice cloning
        if reference_audio_path and os.path.exists(reference_audio_path):
            print(f"[LuxTTS] Using reference audio: {reference_audio_path}")
            encoded_prompt = model.encode_prompt(reference_audio_path, rms=0.01)
        else:
            # Use default voice (no cloning)
            print("[LuxTTS] Using default voice (no reference audio)")
            # Create a minimal silent audio as placeholder
            # LuxTTS requires some reference audio
            reference_audio_path = None
            encoded_prompt = None

        # Generate speech
        if encoded_prompt is not None:
            final_wav = model.generate_speech(
                text,
                encoded_prompt,
                num_steps=num_steps,
                speed=speed,
            )
        else:
            # Without reference, we need a fallback
            # Create a simple silent prompt for default generation
            import numpy as np

            dummy_audio = np.zeros(16000, dtype=np.float32)  # 1 second silence
            with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
                sf.write(tmp.name, dummy_audio, 16000)
                tmp_path = tmp.name

            try:
                encoded_prompt = model.encode_prompt(tmp_path, rms=0.01)
                final_wav = model.generate_speech(
                    text,
                    encoded_prompt,
                    num_steps=num_steps,
                    speed=speed,
                )
            finally:
                os.unlink(tmp_path)

        # Convert to WAV bytes
        audio_np = final_wav.numpy().squeeze()
        buffer = io.BytesIO()
        sf.write(buffer, audio_np, 48000, format="wav")
        buffer.seek(0)

        print(f"[LuxTTS] Generated {len(audio_np) / 48000:.2f}s audio")

        return StreamingResponse(
            iter([buffer.read()]),
            media_type="audio/wav",
            headers={"Content-Disposition": "attachment; filename=speech.wav"},
        )

    except Exception as e:
        print(f"[LuxTTS] Error: {e}")
        import traceback

        traceback.print_exc()
        return StreamingResponse(
            iter([f'{{"error": "{str(e)}"}}'.encode()]),
            media_type="application/json",
            status_code=500,
        )


@app.post("/v1/audio/speech")
async def openai_compatible(request: Request):
    """
    OpenAI-compatible TTS endpoint
    """
    return await tts_simple(request)


if __name__ == "__main__":
    print("==========================================")
    print("  LuxTTS Server")
    print("  Lightweight, Ultra-Fast TTS")
    print("  1GB VRAM | 150x realtime | 48kHz")
    print("  Running on http://127.0.0.1:3005")
    print("==========================================")
    uvicorn.run(app, host="127.0.0.1", port=3005)
