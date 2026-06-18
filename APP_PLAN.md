# OmniversifyStudio - Development Plan

## Project Goal

Transform OmniStreamBot from a browser-based Nuxt application into a native desktop application using Electrobun (a Bun-based desktop framework). The goal is to create a lightweight, performant streaming studio application that:

1. Displays Twitch and Kick chat in real-time
2. Provides Text-to-Speech (TTS) functionality with block/allow lists
3. Captures screen and webcam for streaming
4. Composites video sources on a canvas and streams to Twitch/Kick via FFmpeg
5. Runs as a native desktop app with minimal CPU usage through GPU acceleration

---

## Current Status

### ✅ Completed Features

1. **Electrobun Desktop App Setup**
   - Created `omniversify-studio/` project with Electrobun
   - Configured native WebKitGTK webview (fast, lightweight)
   - Build system copies HTML/JS to correct locations

2. **Chat System**
   - Twitch IRC WebSocket connection
   - Kick Pusher WebSocket connection via local bridge (port 3003)
   - Auto-scroll with proper flexbox layout for WebKit
   - Twitch emote parsing and rendering
   - Clickable usernames with popup menu to add to block/allow lists

3. **Block/Allow Lists**
   - Persistent storage in localStorage
   - Mutually exclusive toggles (only one can be active)
   - Manual add via input fields + platform selector
   - Click username to quickly add to list
   - Filtering applies to TTS only (all messages show in chat)

4. **TTS System**
   - Browser TTS (Web Speech API) - may be unreliable in WebKit
   - Server TTS (Piper) via local Python server
   - Queue system to prevent overlapping speech
   - Uses `en_US-amy-low` voice for Piper

5. **Stream Studio (Partial)**
   - Canvas for video compositing
   - Screen capture button (getDisplayMedia)
   - Webcam capture button (getUserMedia)
   - Position/size controls for sources

6. **Backend Integration**
   - Works with existing services:
     - Port 3002: Piper TTS server
     - Port 3003: Kick bridge service
     - Port 3006: C++ FFmpeg stream engine

---

## Challenges & Issues

### 🔴 Critical

1. **WebKit Speech Synthesis Reliability**
   - Browser TTS often fails or produces errors in WebKitGTK
   - May need to rely on Server (Piper) TTS only

2. **Build Timing**
   - Electrobun dev server takes time to copy files to Resources
   - Need to wait ~10+ seconds after startup before files appear

3. **TTS Queue Race Conditions**
   - Rapid chat messages can overwhelm TTS queue
   - Need better throttling

### 🟡 Known Limitations

1. **No GPU Acceleration Yet**
   - Canvas compositing uses CPU rendering
   - WGPU is bundled but not utilized
   - FFmpeg uses software encoding (libx264 ultrafast)

2. **No Audio Capture**
   - Stream is video-only
   - Audio would require additional capture pipeline

3. **No Native Screen Capture API**
   - Using browser's getDisplayMedia which works but isn't optimal for desktop app

---

## Technical Approach

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    OmniversifyStudio                         │
│                    (Electrobun App)                          │
├─────────────────────────────────────────────────────────────┤
│  HTML/JS UI (WebKitGTK)                                     │
│  ├── Chat Panel (Twitch IRC + Kick Pusher)                 │
│  ├── Stream Studio (Canvas compositing)                     │
│  └── Settings (TTS, Block/Allow lists)                      │
├─────────────────────────────────────────────────────────────┤
│  Backend Services (External)                                 │
│  ├── Port 3002: Piper TTS Server (Python)                  │
│  ├── Port 3003: Kick Bridge (Python)                         │
│  └── Port 3006: C++ FFmpeg Engine                           │
└─────────────────────────────────────────────────────────────┘
```

### Key Technologies

| Component         | Technology                          |
| ----------------- | ----------------------------------- |
| Desktop Framework | Electrobun (Bun runtime)            |
| WebView           | WebKitGTK (native Linux)            |
| Chat              | WebSocket (Twitch IRC, Kick Pusher) |
| TTS               | Web Speech API / Piper (Python)     |
| Streaming         | Canvas + C++ FFmpeg + RTMP          |
| Storage           | localStorage                        |

---

## Future Enhancements

### High Priority

1. **GPU-Accelerated Compositing**
   - Use WGPU for video processing
   - Offload compositing to GPU
   - Reduce CPU usage significantly

2. **Native Screen Capture**
   - Use Electrobun native APIs for screen capture
   - More reliable than browser getDisplayMedia

3. **Audio Capture & Streaming**
   - Add microphone capture
   - Mix audio with video stream

### Medium Priority

1. **Better TTS Throttling**
   - Rate limit TTS to prevent queue overflow
   - Skip messages if queue gets too long

2. **7TV/BetterTTV Emotes**
   - Fetch emotes from 7TV API
   - Parse and display properly

3. **Stream Settings UI**
   - Bitrate selection
   - Resolution options
   - FPS controls

### Low Priority

1. **Better Error Handling**
   - Reconnection for dropped chat connections
   - Graceful degradation

2. **Settings Panel**
   - Voice selection for TTS
   - Volume/rate sliders
   - Theme options

---

## Files Structure

```
OmniStreamBot/
├── start.sh                    # Main startup script
├── tts_server.py               # Piper TTS server (port 3002)
├── kick_service.py             # Kick bridge (port 3003)
├── stream_engine/             # C++ FFmpeg engine (port 3006)
│
├── omniversify-studio/         # Electrobun desktop app
│   ├── electrobun.config.ts    # Build configuration
│   ├── src/
│   │   ├── bun/index.ts        # Main process entry
│   │   └── views/main/
│   │       └── index.html      # UI (all functionality)
│   └── build/                  # Compiled app
│
└── app/                       # Original Nuxt app (backup)
```

---

## Running the App

```bash
# Start everything (TTS, Kick bridge, Stream engine, App)
./start.sh

# Or manually:
cd omniversify-studio
bun run dev
```

---

## Development Notes

1. **Testing Changes**: After editing `index.html`, need to wait for rebuild (~10-15 seconds) before testing
2. **Console Logs**: Check terminal output for debugging logs (prefixed with `[TTS]`, `[Omniversify]`, etc.)
3. **WebKit Specific**: Some browser APIs behave differently in WebKitGTK - test thoroughly
4. **LocalStorage**: All settings persist in browser localStorage (works in WebView)
5. **External Services**: App requires TTS server, Kick bridge, and C++ stream engine to be running
