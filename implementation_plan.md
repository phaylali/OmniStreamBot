# OmniStreamBot Implementation Plan

This document outlines the architecture and steps to build the Twitch/Kick chat monitoring and TTS application.

## Nuxt.js vs Hono.js
For this task, **Nuxt.js** is the better choice. It provides a robust, full-stack Vue framework out of the box, making it exceptionally easy to build the frontend UI (the 80/20 split layout, dark mode) while also providing server APIs if needed. Hono.js is incredibly fast but is primarily an API/router framework; you would still need a frontend framework like Vue or React on top of it to build the UI. Nuxt handles both frontend and backend seamlessly.

## Proposed Changes

### Core Technology Stack
- **Framework**: Nuxt.js 3
- **Package Manager / Runtime**: Bun
- **Styling**: Tailwind CSS (for quick, responsive 80/20 layout and dark mode)
- **State Management**: Vue reactivity (Pinia if necessary, but native `ref`/`reactive` is likely enough)

### UI Architecture
The layout will use a clean, dark mode aesthetic.
- **Left Pane (80%)**: The unified chat window, displaying real-time messages from both platforms.
- **Right Pane (20%)**: The settings sidebar.
  - Twitch Username input.
  - Kick Username input.
  - TTS Enable/Disable toggle.
  - TTS Voice selector.
  - TTS Engine selector (built to be modular).

### Chat Integration
To keep things lightweight and avoid requiring user OAuth tokens where possible:
- **Twitch**: We will use a direct WebSocket connection to Twitch's anonymous IRC server (`wss://irc-ws.chat.twitch.tv:443`). This requires zero API keys and just works for reading public chat.
- **Kick**: We will connect to Kick's WebSocket/Pusher API to listen to chat messages for the specified channel.

### Text-to-Speech (TTS) Strategy
To meet the requirement of "just working without any APIs or proprietary stuff":
1. **Web Speech API (Default Engine)**: We will start by implementing the browser's native `speechSynthesis` API. It runs locally, requires zero installation, has no API keys, and is completely free.
2. **Modular Design**: The TTS logic will be encapsulated in a class or composable (e.g., `useTTS()`), which defines a standard interface like `speak(text)`.
3. **Future Engines (Piper)**: By keeping the architecture modular, we can later plug in Piper TTS (either via a local server or WASM) as a selectable engine in the sidebar.

## Implementation Steps

1. **Project Initialization**: Open a Nuxt 3 project using Bun in the current directory.
2. **UI/UX Development**: Implement the 80/20 split screen with Tailwind CSS in dark mode.
3. **State & Settings**: Create the state configuration for usernames and TTS settings.
4. **TTS Module**: Implement the flexible TTS wrapper using the Web Speech API.
5. **Twitch Listener**: Connect to Twitch WebSocket, parse messages, display them, and trigger TTS.
6. **Kick Listener**: Connect to Kick WebSocket, parse messages, display them, and trigger TTS.

## User Review Required

> [!NOTE]
> Please review the choice of **Nuxt.js** and the initial **Web Speech API** TTS implementation. If you approve, I will proceed with creating the project structure and starting the development.
