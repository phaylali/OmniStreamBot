#!/bin/bash
# LightTTS server launcher
# Lightweight GPU-accelerated TTS using CosyVoice

LIGHTTTS_DIR="${LIGHTTTS_DIR:-$HOME/light-tts}"
MODEL_DIR="${MODEL_DIR:-$LIGHTTTS_DIR/pretrained_models/CosyVoice2-0.5B}"

echo "Starting LightTTS server..."

# Check if LightTTS is installed
if [ ! -d "$LIGHTTTS_DIR" ]; then
    echo "LightTTS not found. Installing..."
    git clone --recursive https://github.com/ModelTC/LightTTS.git "$LIGHTTTS_DIR"
    cd "$LIGHTTTS_DIR"
    pip install -r requirements.txt
fi

# Check if model exists, download if not
if [ ! -d "$MODEL_DIR" ]; then
    echo "Downloading CosyVoice2 model..."
    mkdir -p "$MODEL_DIR"
    python3 -c "
from huggingface_hub import snapshot_download
snapshot_download('FunAudioLLM/CosyVoice2-0.5B', local_dir='$MODEL_DIR')
"
fi

# Start the server
cd "$LIGHTTTS_DIR"
python3 -m light_tts.server.api_server \
    --model_dir "$MODEL_DIR" \
    --host 127.0.0.1 \
    --port 3004 &
    
echo "LightTTS server started on port 3004"
wait