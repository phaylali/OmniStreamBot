# OmniStreamBot - Developer Notes

## Architecture Overview

OmniStreamBot is a Nuxt 4 application that provides a unified chat interface for streamers. It connects directly to Twitch and Kick WebSocket APIs, merging both chat streams into a single UI with real-time TTS.

## Project Structure

```
├── app/
│   ├── app.vue                 # Main application component
│   └── composables/
│       ├── useSettings.ts      # Shared Reactive Settings (Singleton)
│       ├── useTwitchChat.ts    # Twitch IRC WebSocket connection
│       ├── useKickChat.ts      # Kick Pusher WebSocket connection
│       ├── useEmotes.ts        # Unified Emote parsing (Twitch & Kick)
│       ├── useTTS.ts           # Main TTS entry point & coordination
│       └── tts/                # Engine implementations (Piper, Kokoro, Browser)
├── tts_server.py              # Local FastAPI server for Piper TTS
├── kick_service.py            # Local FastAPI bridge for Kick (Cloudflare bypass)
├── start.sh                   # Startup script for TTS, Kick bridge, and Nuxt
└── models/
    └── piper/                 # Place .onnx and .json voices here
```

## Chat Integration

### Twitch Chat

**Protocol**: IRC over WebSocket (`wss://irc-ws.chat.twitch.tv:443`)

- Uses **anonymous authentication** (no OAuth token required)
- Parses IRC PRIVMSG tags for username, color, and message content
- Supports any public Twitch channel

**Implementation**: `app/composables/useTwitchChat.ts`

### Kick Chat

**Protocol**: Pusher WebSocket (`wss://ws-us2.pusher.com`)

- Requires fetching the Chatroom ID first via Kick API.
- **Python Bridge**: We use `kick_service.py` (FastAPI + `kickapi` + `cloudscraper`) to bypass Cloudflare and fetch metadata.
- Subscribes to `chatrooms.{id}.v2` channel.

**Implementation**:

- Local Bridge: `kick_service.py` - handles Cloudflare bypass.
- Server API: `server/api/kick/[channel].ts` - proxies requests to the local bridge.
- Client: `app/composables/useKickChat.ts` - manages WebSocket.

## Emote Support

**Implementation**: `app/composables/useEmotes.ts`

OmniStreamBot provides unified parsing for Twitch and Kick emotes:

- **Twitch**: Parses the `emotes` tag from IRC for exact indices.
- **Kick**: Parses `[emote:id:name]` patterns in message text.
- **Unified Rendering**: The `getMessageParts` function returns an array of text and emote objects for the UI.
- **TTS Filtering**: The `getCleanText` function strips all emotes before the text is sent to the speech engine.

## Text-to-Speech (TTS)

**Multiple Engines Supported**:

- **Server Piper**: Local FastAPI Python server (`tts_server.py`) using `piper-tts`.
  - **Dynamic Voices**: The server provides a `/voices` endpoint that scans `models/piper/` for `.onnx` files.
  - **Auto-Sync**: The frontend fetches this list on initialization, making voice selection dynamic.
- **Kokoro.js**: 82M parameter neural TTS model running 100% in-browser via WebAssembly.
- **Browser TTS**: Native `window.speechSynthesis`.

**Real-time Audio Controls**:
All engines support dynamic real-time adjustment of **Volume**, **Rate**, and **Pitch**. Changes are applied immediately to the active utterance without requiring a reload or waiting for the next message.

**Implementation**: `app/composables/tts/` contains abstract factories and implementations for each engine.

## Settings & State Management

**Implementation**: `app/composables/useSettings.ts`

The settings composable uses a **Singleton Pattern** to ensure that all components (UI, TTS engine, etc.) share the exact same reactive state.

- **Storage**: Automatically persisted to `localStorage` under `omnistreambot-settings`.
- **Saved Settings**:
  - `twitchUsername`, `kickUsername`
  - `ttsEnabled`, `ttsEngine`
  - `selectedVoice`, `browserVoice`
  - `ttsVolume`, `ttsRate`, `ttsPitch`
  - `blocklist`, `allowlist` (Arrays of `{username, platform}`)
  - `blocklistEnabled`, `allowlistEnabled`

## User Action Popup

A custom floating UI that appears when clicking a username in the chat stream.

- **Logic**: Managed in `app/pages/index.vue` via `activeUserPopup` state.
- **Global Events**: Uses a window click listener to auto-close the popup when clicking away.
- **Actions**: Directly interfaces with the `addToList` logic to block or allow users without manual entry.

## Troubleshooting

### TTS not working

- Check browser console for `[TTS]` logs.
- **Must click "Initiate & Test"** button at least once to prepare the engine.
- First run for Kokoro requires internet to download the model (~93MB).
- Ensure browser has WebAssembly support.

### Kick/Twitch not connecting

- Check console for `[Kick]` or `[Twitch]` logs.
- **Kick Cloudflare Block**: If you see a 403 error for Kick, visit `kick.com` in your browser, solve the captcha, and restart the app.
- Kick usernames are case-sensitive for the ID lookup.
- Ensure usernames are the raw platform usernames, not display names.

## Streaming (StreamStudio)

### Architecture

The streaming feature uses a canvas-based compositing approach with a C++ FFmpeg ingestion server:

```
Browser (Canvas) -> WebSocket (JPEG frames) -> C++ Engine -> FFmpeg -> RTMP (Twitch/Kick)
```

### Components

- **StreamStudio** (`app/components/StreamStudio.vue`): Main UI for screen/webcam capture, canvas compositing, and stream controls
- **useStreamCaster** (`app/composables/useStreamCaster.ts`): Handles WebSocket connection and JPEG frame capture
- **C++ Engine** (`stream_engine/main.cpp`): WebSocket server on port 3006 that receives frames and pipes to FFmpeg
- **FFmpeg Muxer** (`stream_engine/ffmpeg_muxer.cpp`): Handles FFmpeg process spawning and RTMP output

### How It Works

1. User selects screen and/or webcam sources
2. Video elements render captured streams (positioned off-screen to satisfy Chrome autoplay)
3. Canvas render loop draws both sources with layout settings (positions, sizes)
4. When streaming starts, `useStreamCaster` connects to the C++ engine via WebSocket
5. C++ engine spawns FFmpeg with MJPEG input format (`-f mjpeg -i pipe:0`)
6. Frontend captures canvas frames as JPEG blobs and sends via WebSocket
7. C++ engine writes frames to FFmpeg stdin pipe
8. FFmpeg encodes with libx264 (ultrafast preset) and pushes to Twitch/Kick RTMP endpoints

### Stream Keys

- **Twitch**: Use stream key (not RTMP server key)
- **Kick**: Use stream key (rtmps://fa723fc1b171.global-contribute.live-video.net:443/app/)

### Ports

- **3000**: Nuxt web app
- **3002**: Piper TTS server
- **3003**: Kick Bridge service
- **3006**: C++ Stream Engine (WebSocket)

### GPU Acceleration

Tested but not fully working:
- `h264_vaapi` - failed (pixel format issue)
- `h264_amf` - failed (missing libamfrt64.so.1)
- `h264_vulkan` - failed (pixel format issue)

Currently using software encoding with libx264 (ultrafast preset).

### Known Issues

- Frame timing uses setTimeout which can be inconsistent
- No audio capture yet (video-only streaming)
- Stability depends on network conditions
