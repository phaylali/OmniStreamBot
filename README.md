# OmniStreamBot

A unified chat dashboard for streamers that combines Twitch and Kick chat into a single view with real-time Text-to-Speech (TTS) capabilities.

![OmniStreamBot Demo](https://via.placeholder.com/800x450/1a1a2a/e94560?text=OmniStreamBot)

## Features

- **Unified Chat** - View Twitch and Kick chat in a single, merged stream
- **Real-time TTS** - Hear chat messages spoken aloud using AI-powered neural voices
- **Offline TTS** - Runs 100% locally in the browser using Kokoro.js - no cloud APIs required
- **Dark Mode** - Premium dark UI designed for streamers
- **Persistent Settings** - Usernames and preferences saved automatically

## Getting Started

### Prerequisites

- [Bun](https://bun.sh/) - Package manager and runtime (recommended)
- OR [Node.js](https://nodejs.org/) (v18+)

### Installation

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
4. Adjust volume with the slider

The chat will automatically connect and display messages from both platforms in real-time.

## Tech Stack

- **Framework**: Nuxt 4 (Vue 3)
- **Styling**: TailwindCSS
- **Runtime**: Bun / Node.js
- **TTS Engine**: Kokoro.js (ONNX-based neural TTS)
- **Chat**: WebSocket connections to Twitch IRC and Kick Pusher

## License

MIT
