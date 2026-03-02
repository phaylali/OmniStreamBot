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
│       ├── useTTS.ts           # Main TTS entry point & coordination
│       └── tts/                # Engine implementations (Piper, Kokoro, Browser)
├── tts_server.py              # Local FastAPI server for Piper TTS
├── start.sh                   # Startup script for both TTS server and Nuxt app
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

- Requires fetching the Chatroom ID first via Kick API
- Kick API is blocked server-side, so we use a CORS proxy
- Subscribes to `chatrooms.{id}.v2` channel

**Implementation**:

- Server API: `server/api/kick/[channel].ts` - proxies API requests
- Client: `app/composables/useKickChat.ts` - manages WebSocket

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
- Kick usernames are case-sensitive for the ID lookup.
- Ensure usernames are the raw platform usernames, not display names.
