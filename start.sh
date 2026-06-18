#!/bin/bash
#
# OmniStream Startup Script
# Runs TTS server, Kick bridge, Stream engine, and OmniversifyStudio (Electrobun)
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
    echo -e "${YELLOW}[1/8] Setting up Python virtual environment...${NC}"
    python3 -m venv .venv
    .venv/bin/pip install fastapi uvicorn pydantic piper-tts kickapi cloudscraper ua-generator
    echo -e "${GREEN}Virtual environment ready${NC}"
else
    echo -e "${GREEN}[1/8] Python virtual environment already exists${NC}"
fi

# Check if LuxTTS is installed
echo -e "${YELLOW}[2/8] Checking LuxTTS...${NC}"
if ! .venv/bin/python -c "import zipvoice" 2>/dev/null; then
    echo -e "${YELLOW}Installing LuxTTS...${NC}"
    .venv/bin/pip install git+https://github.com/ysharma3501/LuxTTS.git
    echo -e "${GREEN}LuxTTS installed${NC}"
else
    echo -e "${GREEN}LuxTTS already installed${NC}"
fi

# Check if models exist
echo -e "${YELLOW}[3/8] Checking TTS models...${NC}"
if [ ! -d "models/piper" ] || [ -z "$(ls -A models/piper/*.onnx 2>/dev/null)" ]; then
    echo -e "${YELLOW}Warning: No TTS models found in models/piper/${NC}"
    echo "Download models from: https://huggingface.co/diffusionstudio/piper-voices"
fi

# Kill existing processes on ports
echo -e "${YELLOW}[4/8] Checking ports...${NC}"
for port in 3002 3003 3004 3005 3006; do
    if lsof -ti:$port >/dev/null 2>&1; then
        echo "Killing existing process on port $port..."
        kill $(lsof -ti:$port) 2>/dev/null || true
        sleep 1
    fi
done

# Start TTS server (Piper)
echo -e "${YELLOW}[5/8] Starting TTS server (Piper)...${NC}"
.venv/bin/python tts_server.py &
TTS_PID=$!
echo "TTS server started (PID: $TTS_PID)"

# Start LuxTTS server
echo -e "${YELLOW}[6/8] Starting LuxTTS server...${NC}"
.venv/bin/python lux_server.py &
LUX_PID=$!
echo "LuxTTS server started (PID: $LUX_PID)"

# Start Kick Bridge service
echo -e "${YELLOW}[7/8] Starting Kick Bridge service...${NC}"
.venv/bin/python kick_service.py &
KICK_PID=$!
echo "Kick Bridge service started (PID: $KICK_PID)"

# Start C++ Stream Engine
echo -e "${YELLOW}[8/8] Starting C++ Stream Engine...${NC}"
./stream_engine/build/omnistream_engine &
ENGINE_PID=$!
echo "C++ Stream Engine started (PID: $ENGINE_PID)"

# Wait for servers to start
echo -e "${YELLOW}Waiting for servers to initialize...${NC}"
sleep 5

# Check servers
echo ""
if curl -s http://localhost:3002/health >/dev/null 2>&1; then
    echo -e "${GREEN}✓ Piper TTS server running on port 3002${NC}"
else
    echo -e "${YELLOW}⚠ Piper TTS server starting...${NC}"
fi
if curl -s http://localhost:3003/docs >/dev/null 2>&1; then
    echo -e "${GREEN}✓ Kick Bridge running on port 3003${NC}"
else
    echo -e "${YELLOW}⚠ Kick Bridge starting...${NC}"
fi
if curl -s http://localhost:3005/health >/dev/null 2>&1; then
    echo -e "${GREEN}✓ LuxTTS running on port 3005${NC}"
else
    echo -e "${YELLOW}⚠ LuxTTS loading model (first run takes ~30s)...${NC}"
fi
if kill -0 $ENGINE_PID 2>/dev/null; then
    echo -e "${GREEN}✓ C++ Stream Engine running on port 3006${NC}"
fi
if [ -n "$SOPRANO_PID" ] && kill -0 $SOPRANO_PID 2>/dev/null; then
    echo -e "${GREEN}✓ SopranoTTS running on port 3004${NC}"
fi

# Start OmniversifyStudio (Electrobun app)
echo ""
echo "=========================================="
echo "  OmniversifyStudio is ready!"
echo "=========================================="
echo ""
echo "Press Ctrl+C to stop all services"
echo ""

cd omniversify-studio
bun run dev

# Cleanup on exit
echo ""
echo "Shutting down..."
cd ..
kill $TTS_PID 2>/dev/null || true
kill $KICK_PID 2>/dev/null || true
kill $ENGINE_PID 2>/dev/null || true
kill $SOPRANO_PID 2>/dev/null || true
kill $LUX_PID 2>/dev/null || true