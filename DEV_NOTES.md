# OmniStreamBot - Developer Notes

## Architecture Overview

OmniStreamBot is a Nuxt 4 application that provides a unified chat interface for streamers. It connects directly to Twitch and Kick WebSocket APIs, merging both chat streams into a single UI with real-time TTS.

## Project Structure

```
OmniStreamBot/
├── app/
│   ├── app.vue                 # Main application component
│   └── composables/
│       ├── useSettings.ts      # Persistent settings (localStorage)
│       ├── useTwitchChat.ts   # Twitch IRC WebSocket connection
│       ├── useKickChat.ts     # Kick Pusher WebSocket connection
│       └── useTTS.ts          # Kokoro.js TTS engine
├── server/
│   └── api/kick/[channel].ts  # Server proxy for Kick API (bypasses CORS)
├── nuxt.config.ts             # Nuxt configuration
├── tailwind.config.ts         # TailwindCSS configuration
└── package.json
```

## Chat Integration

### Twitch Chat

**Protocol**: IRC over WebSocket (`wss://irc-ws.chat.twitch.tv:443`)

- Uses **anonymous authentication** (no OAuth token required)
- Parses IRC PRIVMSG tags for username, color, and message content
- Supports any public Twitch channel

**Implementation**: `app/composables/useTwitchChat.ts`

```typescript
// Key points:
// 1. Connect to Twitch IRC WebSocket
// 2. Send anonymous login commands (justinfan random number)
// 3. Parse PRIVMSG events for chat data
// 4. Extract color from IRC tags (#FF0000 format)
```

### Kick Chat

**Protocol**: Pusher WebSocket (`wss://ws-us2.pusher.com`)

- Requires fetching the Chatroom ID first via Kick API
- Kick API is blocked server-side, so we use a CORS proxy
- Subscribes to `chatrooms.{id}.v2` channel

**Implementation**: 
- Server API: `server/api/kick/[channel].ts` - proxies API requests
- Client: `app/composables/useKickChat.ts` - manages WebSocket

```typescript
// Key flow:
// 1. Fetch chatroom ID from Kick API via server proxy
// 2. Connect to Pusher WebSocket with chatroom ID
// 3. Subscribe to chatroom events
// 4. Parse App\Events\ChatMessageEvent for messages
```

## Text-to-Speech (TTS)

**Engine**: Kokoro.js (https://github.com/hexgrad/kokoro)

- 82M parameter neural TTS model
- Runs 100% in-browser using ONNX Runtime with WebAssembly
- No external APIs, no internet required after first load
- First run downloads ~93MB model, then caches locally

**Important**: The TTS model is lazy-loaded. Users must click "Initiate & Test" at least once to load the model before chat messages will be spoken. Voice changes require a browser tab reload to take effect.

**Implementation**: `app/composables/useTTS.ts`

```typescript
// Key points:
// 1. Lazy-loads Kokoro model on app mount
// 2. Uses quantized model (q8) for smaller download size
// 3. Generates WAV audio, converts to Blob URL for playback
// 4. Default voice: af_sarah (American Female)
// 5. Other voices available: af_heart, am_fen, bf_emma, etc.
```

## Settings Persistence

**Implementation**: `app/composables/useSettings.ts`

- Uses Vue's `ref` for reactive state
- Saves to `localStorage` under key `omnistreambot-settings`
- Automatically saves on any setting change
- Loads saved settings on app initialization

```typescript
// Saved settings:
// - twitchUsername: string
// - kickUsername: string
// - ttsEnabled: boolean
// - selectedVoiceURI: string (reserved for future voice selection)
// - ttsVolume: number (0-1)
```

## API Proxy

**File**: `server/api/kick/[channel].ts`

Kick's API blocks server-side requests. We use a CORS proxy (allorigins.win) to bypass this:

```typescript
// Flow:
// 1. Receive channel name from client
// 2. Request kick.com/api/v1/channels/{channel} via proxy
// 3. Extract chatroom.id from response
// 4. Return chatroom ID to client
```

## Styling

- **TailwindCSS** for all styling
- Dark mode default (`bg-gray-900`)
- 80/20 split layout (chat/settings)
- Custom animations for new messages

## Running Locally

```bash
# Install dependencies
bun install

# Development
bun run dev

# Production build
bun run build

# Preview production
bun run preview
```

## Troubleshooting

### TTS not working
- Check browser console for `[TTS]` logs
- **Must click "Initiate & Test"** button at least once to load the TTS model before chat messages will be spoken
- First run requires internet to download the model (~93MB)
- After changing voice, reload the browser tab for the new voice to take effect
- Ensure browser has WebAssembly support

### Kick not connecting
- Check console for `[Kick]` logs
- The API proxy may be temporarily unavailable
- Kick usernames are case-sensitive (stored lowercase)

### Twitch not connecting
- Ensure username is correct (not display name)
- Some channels may block anonymous chat
