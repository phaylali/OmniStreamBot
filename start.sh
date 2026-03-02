#!/bin/bash
#
# OmniStream Startup Script
# Runs both the TTS server and the Nuxt app
#

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "=========================================="
echo "  OmniStream - Starting..."
echo "=========================================="

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo -e "${RED}Error: Not in OmniStreamBot directory${NC}"
    exit 1
fi

# Check if virtual environment exists, if not create it
if [ ! -d ".venv" ]; then
    echo -e "${YELLOW}[1/6] Setting up Python virtual environment...${NC}"
    python3 -m venv .venv
    .venv/bin/pip install fastapi uvicorn pydantic piper-tts
    echo -e "${GREEN}Virtual environment ready${NC}"
else
    echo -e "${GREEN}[1/6] Python virtual environment already exists${NC}"
fi

# Check if models exist
echo -e "${YELLOW}[2/6] Checking TTS models...${NC}"
if [ ! -d "models/piper" ] || [ -z "$(ls -A models/piper/*.onnx 2>/dev/null)" ]; then
    echo -e "${YELLOW}Warning: No TTS models found in models/piper/${NC}"
    echo "Download models from: https://huggingface.co/diffusionstudio/piper-voices"
    echo ""
    echo "Example for en_US-amy-low:"
    echo "  mkdir -p models/piper"
    echo "  # Download en_US-amy-low.onnx and en_US-amy-low.onnx.json"
fi

# Kill existing processes on ports
echo -e "${YELLOW}[3/6] Checking ports...${NC}"
if lsof -ti:3002 >/dev/null 2>&1; then
    echo "Killing existing process on port 3002..."
    kill $(lsof -ti:3002) 2>/dev/null || true
    sleep 1
fi
if lsof -ti:3000 >/dev/null 2>&1; then
    echo "Killing existing process on port 3000..."
    kill $(lsof -ti:3000) 2>/dev/null || true
    sleep 1
fi

# Start TTS server
echo -e "${YELLOW}[4/6] Starting TTS server...${NC}"
.venv/bin/python tts_server.py &
TTS_PID=$!
echo "TTS server started (PID: $TTS_PID)"

# Wait for TTS server to start
sleep 2

# Check if TTS server is running
if curl -s http://localhost:3002/health >/dev/null 2>&1; then
    echo -e "${GREEN}TTS server is running on port 3002${NC}"
else
    echo -e "${YELLOW}Warning: TTS server may not have started properly${NC}"
    echo "Check that the virtual environment is working."
fi

# Start Nuxt app
echo -e "${YELLOW}[5/6] Starting Nuxt app...${NC}"
echo ""
echo "=========================================="
echo "  OmniStream is ready!"
echo "=========================================="
echo ""
echo "Press Ctrl+C to stop all services"
echo ""

# Run the app
bun run dev

# Cleanup on exit
echo ""
echo "Shutting down..."
kill $TTS_PID 2>/dev/null || true
