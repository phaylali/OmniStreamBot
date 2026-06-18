#!/usr/bin/env python3
"""
SopranoTTS Server for OmniversifyStudio
Lightweight, ultra-realistic TTS with OpenAI-compatible API

Install:
  pip install soprano-tts
  # or for GPU:
  pip install soprano-tts[lmdeploy]

Run:
  python3 soprano_server.py
"""

from fastapi import FastAPI, Request
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import io
import sys

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

model = None
model_loaded = False


def load_model():
    global model, model_loaded
    if model_loaded:
        return

    try:
        print("[Soprano] Loading model on CPU (80M params)...")
        from soprano import SopranoTTS

        # Force CPU - works on AMD/Intel GPUs
        model = SopranoTTS(
            backend="auto", device="cpu", cache_size_mb=200, decoder_batch_size=2
        )
        model_loaded = True
        print("[Soprano] Model loaded! Running on CPU.")
        print("[Soprano] ~20x real-time speed on CPU")
    except ImportError:
        print(
            "[Soprano] Error: soprano-tts not installed. Run: pip install soprano-tts"
        )
        sys.exit(1)
    except Exception as e:
        print(f"[Soprano] Failed to load model: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"[Soprano] Failed to load model: {e}")
        sys.exit(1)


@app.on_event("startup")
async def startup():
    load_model()


@app.get("/health")
async def health():
    return {"status": "ok", "tts_engine": "soprano", "model_loaded": model_loaded}


@app.get("/voices")
async def voices():
    # Soprano uses a single voice model
    return {"voices": [{"id": "soprano", "name": "Soprano Default", "lang": "en"}]}


@app.post("/v1/audio/speech")
async def text_to_speech(request: Request):
    """
    OpenAI-compatible TTS endpoint
    """
    if not model_loaded:
        return StreamingResponse(
            iter([b'{"error": "Model not loaded"}']),
            media_type="application/json",
            status_code=503,
        )

    try:
        body = await request.json()
        text = body.get("input", body.get("text", ""))

        if not text:
            return StreamingResponse(
                iter([b'{"error": "No text provided"}']),
                media_type="application/json",
                status_code=400,
            )

        print(f"[Soprano] Generating: {text[:50]}...")

        # Generate audio
        audio_bytes = model.infer(text)

        print(f"[Soprano] Generated {len(audio_bytes)} bytes")

        # Return WAV audio
        return StreamingResponse(
            iter([audio_bytes]),
            media_type="audio/wav",
            headers={"Content-Disposition": "attachment; filename=speech.wav"},
        )

    except Exception as e:
        print(f"[Soprano] Error: {e}")
        return StreamingResponse(
            iter([f'{{"error": "{str(e)}"}}'.encode()]),
            media_type="application/json",
            status_code=500,
        )


@app.post("/tts")
async def tts_simple(request: Request):
    """
    Simple TTS endpoint (compatible with OmniStreamBot)
    """
    if not model_loaded:
        return StreamingResponse(
            iter([b'{"error": "Model not loaded"}']),
            media_type="application/json",
            status_code=503,
        )

    try:
        body = await request.json()
        text = body.get("text", "")

        if not text:
            return StreamingResponse(
                iter([b'{"error": "No text provided"}']),
                media_type="application/json",
                status_code=400,
            )

        print(f"[Soprano] Generating: {text[:50]}...")

        # Generate audio
        audio_bytes = model.infer(text)

        print(f"[Soprano] Generated {len(audio_bytes)} bytes")

        return StreamingResponse(iter([audio_bytes]), media_type="audio/wav")

    except Exception as e:
        print(f"[Soprano] Error: {e}")
        return StreamingResponse(
            iter([f'{{"error": "{str(e)}"}}'.encode()]),
            media_type="application/json",
            status_code=500,
        )


if __name__ == "__main__":
    print("==========================================")
    print("  SopranoTTS Server")
    print("  Lightweight, Ultra-Realistic TTS")
    print("  Running on http://127.0.0.1:3004")
    print("==========================================")
    uvicorn.run(app, host="127.0.0.1", port=3004)
