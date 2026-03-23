# OmniStream: C++ Streaming Studio Plan

This document provides a comprehensive overview of the architecture and implementation for transforming OmniStreamBot into a lightweight, high-performance streaming software.

## 1. Vision & Goals
OmniStream aims to replace bloated streaming software like OBS for basic use cases (1080p, chat overlays, webcam PIP).
- **Lightweight**: Minimum CPU/RAM overhead by offloading UI to a browser and streaming to a lean C++ backend.
- **Unified**: Handle Twitch and Kick streaming/chat from a single interface.
- **Modular**: Ease of adding new overlays or stream destinations.

---

## 2. Architecture Overview

### Strategy: Browser Compositing (Option A)
We use the browser for human-interface tasks (selecting cameras, drawing overlays, rendering chat) and a native C++ application for heavy-duty networking and stream multiplexing.

1.  **Frontend (Nuxt/Vue)**:
    *   **Capture**: Uses `getUserMedia` (Webcam/Mic) and `getDisplayMedia` (Screen Share).
    *   **Mix**: Combines video/audio inputs on a hidden `<canvas>` and a Web Audio `AudioContext`.
    *   **Ingest**: Encodes the final canvas to a byte-stream (VP8/Opus) and sends it over a local WebSocket.

2.  **Backend (C++ Engine)**:
    *   **WS Ingest**: A high-performance WebSocket server (port 3004) receiving binary video/audio chunks.
    *   **FFmpeg Pipe**: Spawns an `ffmpeg` subprocess and pipes the binary chunks directly into its `stdin`.
    *   **Multi-Stream**: FFmpeg transcodes and pushes the stream to multiple RTMP destinations (`tee` muxer) simultaneously.

---

## 3. UI Layout Evolution (20 / 60 / 20)

To accommodate the studio, the main dashboard (`index.vue`) was refactored into three columns:

- **Chat Sidebar (20%)**: Unified Twitch and Kick chat messages.
- **Stream Studio (60%)**: 
    - **Live Preview**: 1920x1080 canvas showing the current composite.
    - **PIP (Picture-in-Picture)**: Automatically overlays the webcam in the bottom-right corner when enabled.
    - **Controls**: Start/Stop streaming buttons and device toggles.
- **Settings Sidebar (20%)**: 
    - **Stream Keys**: Secure fields for Twitch and Kick keys.
    - **TTS Controls**: Voice selection, rate, and volume.

---

## 4. Technical Implementation Details

### C++ Ingest Server (`stream_engine/`)
Built with `CMake`, `Asio`, and `WebSocket++`.
- **`main.cpp`**: Orchestrates the server. It handles `start`/`stop` JSON commands and binary chunks. 
- **`ffmpeg_muxer.cpp`**:
    - Uses `popen()` to spawn `ffmpeg`.
    - Command: `ffmpeg -i pipe:0 -c:v libx264 -preset veryfast -b:v 6000k -f flv rtmp://...`
    - High-quality ingest: 6Mbps locally ensuring no quality loss before reaching the streaming platform.

### Audio Mixing Layer
Handled in `StreamStudio.vue` using the **Web Audio API**:
- **System Audio Node**: From the screen share track.
- **Microphone Node**: From the user's audio track.
- **Destination Node**: A `MediaStreamAudioDestinationNode` that mixes both and feeds into the final `MediaRecorder`.

### Streaming Protocol
1.  Browser triggers `MediaRecorder.start(100)` (sends chunks every 100ms).
2.  `MediaRecorder.ondataavailable` sends the blob to the C++ server.
3.  C++ server writes the raw bytes to the FFmpeg pipe seamlessly.
4.  FFmpeg pushes to RTMP servers (Twitch: `rtmp://live.twitch.tv`, Kick: `rtmps://...`).

---

## 5. Next Steps & Polish
- [ ] **Scene Presets**: Add buttons to change layouts (e.g., Just Chatting with large webcam).
- [ ] **WebRTC Support**: Investigate WHIP/WHEP for even lower latency than WebSockets.
- [ ] **Hardware Acceleration**: Configure FFmpeg to use `h264_nvenc` (NVIDIA) or `h264_vaapi` (Intel/AMD) for zero CPU usage.
- [ ] **Overlays**: Directly draw CSS overlays onto the canvas for "burnt-in" alerts/emotes/chat.

---
*OmniStream: Stream lighter, stream better.*
