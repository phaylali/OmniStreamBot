# OmniStreamBot

A unified chat dashboard for streamers that combines Twitch and Kick chat into a single view with real-time Text-to-Speech (TTS) capabilities.

![OmniStreamBot Demo](https://via.placeholder.com/800x450/1a1a2a/e94560?text=OmniStreamBot)

## Features

- **Unified Chat** - View Twitch and Kick chat in a single, merged stream
- **Real-time TTS** - Hear chat messages spoken aloud using AI-powered neural voices (Kokoro, Piper, Edge, etc.)
- **Offline TTS** - Runs 100% locally using Kokoro.js in-browser or via a local Python Piper server - no cloud APIs required
- **Real-time Volume** - Adjust audio volume dynamically on the fly while messages are playing
- **Dark Mode** - Premium dark UI designed for streamers
- **Persistent Settings** - Usernames and preferences saved automatically

## Getting Started

### Prerequisites

- [Bun](https://bun.sh/) - Package manager and runtime (recommended)
- OR [Node.js](https://nodejs.org/) (v18+)

### Installation

```bash
# Recommended: Starts both the optional Python Piper TTS server and the Nuxt app
./start.sh
```

Alternatively, to run just the UI without the Python TTS server:

```bash
# Install dependencies
bun install

# Start development server
bun run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Building for Production

```bash
bun run build
```

The output will be in the `.output/` directory.

## Usage

1. Enter your **Twitch username** in the settings panel
2. Enter your **Kick username** (if monitoring Kick chat)
3. Toggle **TTS** on/off as needed
4. Select a voice and adjust volume
5. **Click "Initiate & Test"** - This loads the TTS model (~93MB first time) and enables TTS for chat messages
6. The chat will automatically connect and display messages from both platforms in real-time

> **Important**: You must click "Initiate & Test" at least once before chat messages will be spoken. The TTS model needs to be loaded first. After changing voices, reload the browser tab for the new voice to take effect.

## Tech Stack

- **Framework**: Nuxt 4 (Vue 3)
- **Styling**: TailwindCSS
- **Runtime**: Bun / Node.js
- **TTS Engines**: Kokoro.js (Browser-based ONNX), Piper TTS (Local Python FastAPI), Edge TTS, Google
- **Chat**: WebSocket connections to Twitch IRC and Kick Pusher

## License

MIT
