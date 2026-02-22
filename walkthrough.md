# OmniStreamBot Walkthrough

The development of the **OmniStreamBot** is complete! We have built a clean, modular Nuxt.js application that successfully integrates Twitch chat, Kick chat, and Text-to-Speech (TTS) capabilities using the browser's native Web Speech API.

## Changes Made

1. **Nuxt.js Foundation**: Initialized the project with Nuxt 4, utilizing Bun as the package manager and runtime.
2. **Moroccan Luxury / Premium Dark Mode (TailwindCSS)**: Implemented an 80/20 split screen layout, using a deep `bg-gray-900` dark mode. The chat screen takes up the majority of the view, while the robust settings panel remains easily accessible on the right.
3. **State Management ([useSettings.ts](file:///home/phaylali/Documents/Apps/OmniStreamBot/app/composables/useSettings.ts))**: Built a reactive composable that automatically saves and loads the user's settings (usernames, TTS enablement, voice choice, volume) to `localStorage`.
4. **Twitch Chat Integration ([useTwitchChat.ts](file:///home/phaylali/Documents/Apps/OmniStreamBot/app/composables/useTwitchChat.ts))**: Connected seamlessly to Twitch's anonymous IRC WebSocket (`wss://irc-ws.chat.twitch.tv:443`). It accurately parses user messages and their custom name colors without needing any OAuth tokens.
5. **Kick Chat Integration ([useKickChat.ts](file:///home/phaylali/Documents/Apps/OmniStreamBot/app/composables/useKickChat.ts))**: Bypassed Kick API CORS restrictions by creating a Nuxt server proxy route (`/api/kick/[channel]`). This dynamically fetches the Chatroom ID, which allows the client to connect via Pusher WebSockets and receive real-time Kick messages.
6. **Modular TTS Engine ([useTTS.ts](file:///home/phaylali/Documents/Apps/OmniStreamBot/app/composables/useTTS.ts))**: Brought in the Web Speech API as the out-of-the-box text-to-speech engine. It allows full selection of installed system voices, volume tweaking, and can be toggled on or off instantly. It speaks every new message automatically.

## Validation and Video

The unified dashboard correctly merges both chat platforms into a single stream. The layout perfectly accommodates small streamers looking for an all-in-one monitor.

Below is a recording showing the UI connecting to an active stream and demonstrating the layout:
![OmniStreamBot Demo](/home/phaylali/.gemini/antigravity/brain/6eff2250-1649-4e0e-9e03-9365f465591b/omnistreambot_demo.webp)

## Future Enhancements
- As it's built with modularity in mind, adding support for external Piper TTS instances or WASM-based local models can easily be plugged right into [useTTS.ts](file:///home/phaylali/Documents/Apps/OmniStreamBot/app/composables/useTTS.ts).
