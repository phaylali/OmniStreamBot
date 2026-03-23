# OmniStreamBot

A unified chat dashboard for streamers that combines Twitch and Kick chat into a single view with real-time Text-to-Speech (TTS) capabilities.

![OmniStreamBot Demo](https://via.placeholder.com/800x450/1a1a2a/e94560?text=OmniStreamBot)

## Features

- **Stream Studio** - Capture screen and webcam, composite on canvas, and stream to Twitch/Kick simultaneously
- **Emote Support** - View Twitch and Kick emotes directly in the chat stream
- **Real-time TTS** - Hear chat messages spoken aloud using neural voices (Kokoro, Piper)
- **Emote-Free TTS** - Emotes are intelligently filtered out so you only hear the message text
- **Offline TTS** - Runs 100% locally using Kokoro.js in-browser or via a local Python Piper server
- **Dynamic User Management** - Click any username in chat to quickly **Block** or **Allow** users via a popup card.
- **Real-time Audio** - Adjust volume, rate, and pitch on the fly with immediate feedback - no reload required
- **OBS Ready** - Copy your local IP and overlay link with one click for easy browser source setup
- **Dark Mode** - Premium dark UI designed for streamers
- **Persistent Settings** - Usernames, preferences, and block/allow lists saved automatically

## Getting Started

### Prerequisites

- [Bun](https://bun.sh/) - Package manager and runtime (recommended)
- [Python 3.10+](https://www.python.org/downloads/) - For the Piper TTS and Kick Bridge servers
- [uv](https://github.com/astral-sh/uv) - Fast Python package manager (installer script included in `start.sh`)

### Installation

```bash
# Recommended: Automatically sets up everything and starts all services
./start.sh
```

The startup script handles:

1. Python virtual environment setup via `uv`
2. Starting the **Piper TTS server** (port 3002)
3. Starting the **Kick Bridge service** (port 3003, handles Cloudflare bypass)
4. Starting the **C++ Stream Engine** (port 3006)
5. Starting the **Nuxt development server** (port 3000)

Alternatively, to run just the UI without the Python TTS server:

```bash
# Install dependencies
bun install

# Start development server
bun run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Usage

### Chat & TTS

1. Enter your **Twitch username** and/or **Kick username** in its respective settings field.
2. Toggle **TTS** on to enable voice reading.
3. Select a **TTS Engine**:
   - **Browser**: Lightest, uses system voices.
   - **Server Piper**: High quality, local Python server (requires `models/piper/` models).
   - **Kokoro**: Premium neural quality, runs in-browser (downloads ~93MB on first use).
4. Adjust **Volume**, **Rate**, and **Pitch** as desired. Changes take effect instantly.
5. Click **"Initiate & Test"** to prepare the selected engine.
6. **Community Management**: Click any name in the chat stream to open a popup card. From there, you can instantly add users to your **Allowlist** or **Blocklist**.

> **Note**: The first time you use Kokoro, it will download the model file. Server Piper requires `.onnx` and `.json` model files to be placed in the `models/piper/` directory.

### Streaming

1. Navigate to the **Stream Studio** tab.
2. Select your **Screen** source (required) and optionally your **Webcam**.
3. Adjust the layout (position, size) of each source on the canvas preview.
4. Enter your **Twitch Stream Key** and/or **Kick Stream Key**.
5. Click **Go Live** to start streaming to both platforms simultaneously.
6. Click **Stop** to end the stream.

The stream uses a C++ engine with FFmpeg to encode and push to RTMP endpoints. Video is captured at ~15 FPS as JPEG frames and sent via WebSocket to the engine.

## Tech Stack

- **Framework**: Nuxt 4 (Vue 3)
- **Styling**: TailwindCSS (with Dark Mode)
- **Streaming**: Canvas compositing + C++ WebSocket server + FFmpeg (RTMP push)
- **TTS Engines**:
  - **Kokoro.js** (In-browser ONNX runtime)
  - **Piper TTS** (Local CPU-optimized synthesis via Python FastAPI)
  - **Web Speech API** (Native browser voices)
- **Chat**: WebSocket connections to Twitch IRC and Kick Pusher
- **State Management**: Shared reactive singleton with LocalStorage persistence

## License

MIT
