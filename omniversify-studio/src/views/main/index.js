// src/services/settings.ts
var defaultSettings = {
  twitchUsername: "",
  kickUsername: "",
  ttsEnabled: false,
  ttsEngine: "server",
  selectedVoice: "en_US-amy-low",
  ttsVolume: 1,
  ttsRate: 1,
  ttsPitch: 1,
  blocklist: [],
  allowlist: [],
  blocklistEnabled: false,
  allowlistEnabled: false
};

class SettingsService {
  settings = { ...defaultSettings };
  listeners = new Set;
  constructor() {
    this.load();
  }
  load() {
    try {
      const stored = globalThis.localStorage?.getItem("omniversify-settings");
      if (stored) {
        this.settings = { ...defaultSettings, ...JSON.parse(stored) };
      }
    } catch (e) {
      console.error("[Settings] Failed to load:", e);
    }
  }
  save() {
    try {
      globalThis.localStorage?.setItem("omniversify-settings", JSON.stringify(this.settings));
    } catch (e) {
      console.error("[Settings] Failed to save:", e);
    }
    this.notify();
  }
  notify() {
    this.listeners.forEach((cb) => cb(this.settings));
  }
  get() {
    return { ...this.settings };
  }
  set(partial) {
    this.settings = { ...this.settings, ...partial };
    this.save();
  }
  subscribe(cb) {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }
}
var settingsService = new SettingsService;

// src/services/twitch.ts
class TwitchService {
  ws = null;
  onMessageCb = null;
  isConnected = false;
  channel = "";
  connect(channel, onMessage) {
    this.disconnect();
    if (!channel.trim())
      return;
    this.channel = channel.trim().toLowerCase();
    this.onMessageCb = onMessage;
    this.ws = new WebSocket("wss://irc-ws.chat.twitch.tv:443");
    this.ws.onopen = () => {
      console.log("[Twitch] Connected to IRC");
      this.ws?.send("CAP REQ :twitch.tv/tags twitch.tv/commands");
      this.ws?.send("PASS SCHMOOPIIE");
      this.ws?.send(`NICK justinfan${Math.floor(Math.random() * 1e5)}`);
      this.ws?.send(`JOIN #${this.channel}`);
      this.isConnected = true;
    };
    this.ws.onmessage = (event) => {
      const messages = event.data.split(`\r
`);
      for (const raw of messages) {
        if (!raw)
          continue;
        if (raw.startsWith("PING")) {
          this.ws?.send("PONG :tmi.twitch.tv");
        } else {
          this.parseMessage(raw);
        }
      }
    };
    this.ws.onclose = () => {
      console.log("[Twitch] Disconnected");
      this.isConnected = false;
      this.ws = null;
    };
    this.ws.onerror = (err) => {
      console.error("[Twitch] Error:", err);
    };
  }
  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.isConnected = false;
  }
  parseMessage(raw) {
    if (!raw.includes("PRIVMSG") || !this.onMessageCb)
      return;
    try {
      let color = "#a855f7";
      let displayName = "Unknown";
      let messageContent = "";
      let emotes = "";
      const tagsMatch = raw.match(/^@([^ ]+) /);
      if (tagsMatch?.[1]) {
        const tagsList = tagsMatch[1].split(";");
        for (const tag of tagsList) {
          const [key, value] = tag.split("=");
          if (key === "color" && value)
            color = value;
          if (key === "display-name" && value)
            displayName = value;
          if (key === "emotes" && value)
            emotes = value;
        }
      }
      const messageMatch = raw.match(/PRIVMSG #[^ ]+ :(.+)$/);
      if (messageMatch?.[1]) {
        messageContent = messageMatch[1].trim();
      }
      if (displayName === "Unknown") {
        const nameMatch = raw.match(/:([^!]+)!/);
        if (nameMatch?.[1])
          displayName = nameMatch[1];
      }
      this.onMessageCb({
        id: Math.random().toString(36).substring(2, 9),
        platform: "twitch",
        username: displayName,
        message: messageContent,
        color,
        timestamp: Date.now(),
        emotes
      });
    } catch (e) {
      console.error("[Twitch] Parse error:", e);
    }
  }
  get connected() {
    return this.isConnected;
  }
}
var twitchService = new TwitchService;

// src/services/kick.ts
class KickService {
  ws = null;
  onMessageCb = null;
  isConnected = false;
  chatroomId = null;
  async connect(channel, onMessage) {
    this.disconnect();
    if (!channel.trim())
      return;
    const channelLower = channel.trim().toLowerCase();
    this.onMessageCb = onMessage;
    try {
      const res = await fetch(`http://localhost:3003/chatroom/${channelLower}`);
      if (res.status === 403) {
        console.error("[Kick] Cloudflare blocked. Visit kick.com in browser and solve captcha.");
        return;
      }
      if (!res.ok) {
        console.error("[Kick] Failed to get chatroom ID:", res.status);
        return;
      }
      const data = await res.json();
      this.chatroomId = data.chatroomId;
      console.log("[Kick] Chatroom ID:", this.chatroomId);
      this.ws = new WebSocket("wss://ws-us2.pusher.com/app/32cbd69e4b950bf97679?protocol=7&client=js&version=7.6.0&flash=false");
      this.ws.onopen = () => {
        console.log("[Kick] Pusher connected");
        this.ws?.send(JSON.stringify({
          event: "pusher:subscribe",
          data: { auth: "", channel: `chatrooms.${this.chatroomId}.v2` }
        }));
        this.isConnected = true;
      };
      this.ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.event === "App\\Events\\ChatMessageEvent") {
            const chatData = JSON.parse(msg.data);
            this.onMessageCb?.({
              id: chatData.id || Math.random().toString(36).substring(2, 9),
              platform: "kick",
              username: chatData.sender?.username || "Unknown",
              message: chatData.content || "",
              color: chatData.sender?.identity?.color || "#53fc18",
              timestamp: Date.now()
            });
          }
          if (msg.event === "pusher:ping") {
            this.ws?.send(JSON.stringify({ event: "pusher:pong" }));
          }
        } catch (e) {}
      };
      this.ws.onclose = () => {
        console.log("[Kick] Disconnected");
        this.isConnected = false;
        this.ws = null;
      };
      this.ws.onerror = (err) => {
        console.error("[Kick] Error:", err);
      };
    } catch (e) {
      console.error("[Kick] Connection error:", e);
    }
  }
  disconnect() {
    if (this.ws) {
      if (this.chatroomId) {
        try {
          this.ws.send(JSON.stringify({
            event: "pusher:unsubscribe",
            data: { channel: `chatrooms.${this.chatroomId}.v2` }
          }));
        } catch (e) {}
      }
      this.ws.close();
      this.ws = null;
    }
    this.isConnected = false;
    this.chatroomId = null;
  }
  get connected() {
    return this.isConnected;
  }
}
var kickService = new KickService;

// src/services/tts.ts
class TTSServerEngine {
  voices = [];
  currentVoice = "en_US-amy-low";
  audioContext = null;
  currentSource = null;
  async loadVoices() {
    try {
      const res = await fetch("http://localhost:3002/voices");
      if (res.ok) {
        const data = await res.json();
        this.voices = data.voices || [];
        console.log("[TTS] Loaded voices:", this.voices);
      }
    } catch (e) {
      console.warn("[TTS] Server not available");
    }
  }
  getVoices() {
    return this.voices;
  }
  setVoice(voice) {
    this.currentVoice = voice;
  }
  async speak(text, options) {
    console.log(`[TTS Server] Speaking: "${text.substring(0, 40)}..."`);
    const startTime = Date.now();
    try {
      const res = await fetch("http://localhost:3002/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
          voice: this.currentVoice
        })
      });
      if (!res.ok) {
        console.error(`[TTS Server] HTTP error: ${res.status}`);
        return;
      }
      const blob = await res.blob();
      console.log(`[TTS Server] Got ${blob.size} bytes in ${Date.now() - startTime}ms`);
      if (blob.size === 0) {
        console.error("[TTS Server] Empty response");
        return;
      }
      if (!this.audioContext) {
        this.audioContext = new (window.AudioContext || window.webkitAudioContext);
      }
      if (this.audioContext.state === "suspended") {
        try {
          await this.audioContext.resume();
        } catch (e) {}
      }
      const arrayBuffer = await blob.arrayBuffer();
      let audioBuffer;
      try {
        audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
      } catch (e) {
        console.error("[TTS Server] Failed to decode audio data:", e);
        return;
      }
      return new Promise((resolve) => {
        let resolved = false;
        const finish = () => {
          if (resolved)
            return;
          resolved = true;
          console.log(`[TTS Server] ✓ Done in ${Date.now() - startTime}ms`);
          resolve();
        };
        try {
          const source = this.audioContext.createBufferSource();
          source.buffer = audioBuffer;
          this.currentSource = source;
          if (options.rate !== 1) {
            source.playbackRate.value = options.rate;
          }
          const gainNode = this.audioContext.createGain();
          gainNode.gain.value = options.volume;
          source.connect(gainNode);
          gainNode.connect(this.audioContext.destination);
          source.onended = () => {
            this.currentSource = null;
            finish();
          };
          source.start(0);
          console.log("[TTS Server] Playback started via Web Audio API");
        } catch (e) {
          console.error("[TTS Server] Audio play failed:", e.message);
          this.currentSource = null;
          finish();
        }
        setTimeout(() => {
          if (!resolved) {
            console.warn("[TTS Server] Timeout");
            finish();
          }
        }, 30000);
      });
    } catch (e) {
      console.error("[TTS Server] Fetch error:", e);
    }
  }
  cancel() {
    if (this.currentSource) {
      try {
        this.currentSource.stop();
      } catch (e) {}
      this.currentSource = null;
    }
  }
}

class TTSBrowserEngine {
  synth;
  currentVoice = null;
  supported = false;
  constructor() {
    this.synth = globalThis.speechSynthesis || null;
    this.supported = typeof window !== "undefined" && "SpeechSynthesisUtterance" in window;
  }
  loadVoices() {
    return this.synth ? this.synth.getVoices() : [];
  }
  setVoice(name) {
    if (!this.synth)
      return;
    const voices = this.synth.getVoices();
    this.currentVoice = voices.find((v) => v.name === name) || null;
  }
  activeUtterance = null;
  async speak(text, options) {
    const startTime = Date.now();
    const voiceName = this.currentVoice?.name || "default";
    console.log(`[TTS Browser] Speaking: "${text.substring(0, 40)}${text.length > 40 ? "..." : ""}" (voice: ${voiceName})`);
    if (!this.supported || !this.synth) {
      console.error("[TTS Browser] Web Speech API is not supported in this environment!");
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      try {
        const utterance = new window.SpeechSynthesisUtterance(text);
        this.activeUtterance = utterance;
        utterance.volume = options.volume;
        utterance.rate = options.rate;
        utterance.pitch = options.pitch;
        if (this.currentVoice) {
          utterance.voice = this.currentVoice;
        }
        const finish = () => {
          this.activeUtterance = null;
          const totalTime = Date.now() - startTime;
          console.log(`[TTS Browser] ✓ Completed in ${totalTime}ms`);
          resolve();
        };
        utterance.onend = finish;
        utterance.onerror = (e) => {
          console.error(`[TTS Browser] Error: ${e.error || "Unknown"}`);
          finish();
        };
        setTimeout(() => {
          if (this.activeUtterance === utterance) {
            console.warn("[TTS Browser] Timeout after 30s");
            finish();
          }
        }, 30000);
        this.synth.speak(utterance);
        console.log(`[TTS Browser] speak() called, voices available: ${this.synth.getVoices().length}`);
      } catch (e) {
        console.error("[TTS Browser] Initialization crashed:", e);
        resolve();
      }
    });
  }
  cancel() {
    if (this.supported && this.synth && this.activeUtterance) {
      this.synth.cancel();
      this.activeUtterance = null;
    }
  }
}

class SopranoEngine {
  currentVoice = "soprano";
  audioContext = null;
  currentSource = null;
  async loadVoices() {
    console.log("[TTS Soprano] Ready (single voice)");
  }
  async speak(text, options) {
    console.log(`[TTS Soprano] Speaking: "${text.substring(0, 40)}..."`);
    const startTime = Date.now();
    try {
      const res = await fetch("http://localhost:3004/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, voice: this.currentVoice })
      });
      if (!res.ok) {
        console.error(`[TTS Soprano] HTTP error: ${res.status}`);
        return;
      }
      const blob = await res.blob();
      console.log(`[TTS Soprano] Got ${blob.size} bytes in ${Date.now() - startTime}ms`);
      if (blob.size === 0) {
        console.error("[TTS Soprano] Empty response");
        return;
      }
      if (!this.audioContext) {
        this.audioContext = new (window.AudioContext || window.webkitAudioContext);
      }
      if (this.audioContext.state === "suspended") {
        try {
          await this.audioContext.resume();
        } catch (e) {}
      }
      const arrayBuffer = await blob.arrayBuffer();
      let audioBuffer;
      try {
        audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
      } catch (e) {
        console.error("[TTS Soprano] Failed to decode audio data:", e);
        return;
      }
      return new Promise((resolve) => {
        let resolved = false;
        const finish = () => {
          if (resolved)
            return;
          resolved = true;
          console.log(`[TTS Soprano] ✓ Done in ${Date.now() - startTime}ms`);
          resolve();
        };
        try {
          const source = this.audioContext.createBufferSource();
          source.buffer = audioBuffer;
          this.currentSource = source;
          if (options.rate !== 1) {
            source.playbackRate.value = options.rate;
          }
          const gainNode = this.audioContext.createGain();
          gainNode.gain.value = options.volume;
          source.connect(gainNode);
          gainNode.connect(this.audioContext.destination);
          source.onended = () => {
            this.currentSource = null;
            finish();
          };
          source.start(0);
          console.log("[TTS Soprano] Playback started via Web Audio API");
        } catch (e) {
          console.error("[TTS Soprano] Audio play failed:", e.message);
          this.currentSource = null;
          finish();
        }
        setTimeout(() => {
          if (!resolved) {
            console.warn("[TTS Soprano] Timeout");
            finish();
          }
        }, 30000);
      });
    } catch (e) {
      console.error("[TTS Soprano] Error:", e);
    }
  }
  cancel() {
    if (this.currentSource) {
      try {
        this.currentSource.stop();
      } catch (e) {}
      this.currentSource = null;
    }
  }
}

class LuxEngine {
  audioContext = null;
  currentSource = null;
  serverReady = false;
  checkingServer = false;
  async loadVoices() {
    console.log("[TTS Lux] Ready (voice cloning supported)");
  }
  async checkServer() {
    if (this.serverReady)
      return true;
    if (this.checkingServer) {
      await new Promise((r) => setTimeout(r, 1000));
      return this.serverReady;
    }
    this.checkingServer = true;
    try {
      const res = await fetch("http://localhost:3005/health", {
        method: "GET",
        signal: AbortSignal.timeout(5000)
      });
      if (res.ok) {
        const data = await res.json();
        this.serverReady = data.model_loaded === true;
        if (this.serverReady) {
          console.log("[TTS Lux] Server ready!");
        }
      }
    } catch (e) {
      console.warn("[TTS Lux] Server not ready yet, retrying...");
    }
    this.checkingServer = false;
    return this.serverReady;
  }
  async speak(text, options) {
    console.log(`[TTS Lux] Speaking: "${text.substring(0, 40)}..."`);
    const startTime = Date.now();
    let retries = 0;
    while (!await this.checkServer() && retries < 12) {
      console.log(`[TTS Lux] Waiting for server... (attempt ${retries + 1}/12)`);
      await new Promise((r) => setTimeout(r, 5000));
      retries++;
    }
    if (!this.serverReady) {
      console.error("[TTS Lux] Server failed to load model");
      return;
    }
    try {
      const res = await fetch("http://localhost:3005/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
          speed: options.rate
        })
      });
      if (!res.ok) {
        console.error(`[TTS Lux] HTTP error: ${res.status}`);
        return;
      }
      const blob = await res.blob();
      console.log(`[TTS Lux] Got ${blob.size} bytes in ${Date.now() - startTime}ms`);
      if (blob.size === 0) {
        console.error("[TTS Lux] Empty response");
        return;
      }
      if (!this.audioContext) {
        this.audioContext = new (window.AudioContext || window.webkitAudioContext);
      }
      if (this.audioContext.state === "suspended") {
        try {
          await this.audioContext.resume();
        } catch (e) {}
      }
      const arrayBuffer = await blob.arrayBuffer();
      let audioBuffer;
      try {
        audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
      } catch (e) {
        console.error("[TTS Lux] Failed to decode audio data:", e);
        return;
      }
      return new Promise((resolve) => {
        let resolved = false;
        const finish = () => {
          if (resolved)
            return;
          resolved = true;
          console.log(`[TTS Lux] ✓ Done in ${Date.now() - startTime}ms`);
          resolve();
        };
        try {
          const source = this.audioContext.createBufferSource();
          source.buffer = audioBuffer;
          this.currentSource = source;
          if (options.rate !== 1) {
            source.playbackRate.value = options.rate;
          }
          const gainNode = this.audioContext.createGain();
          gainNode.gain.value = options.volume;
          source.connect(gainNode);
          gainNode.connect(this.audioContext.destination);
          source.onended = () => {
            this.currentSource = null;
            finish();
          };
          source.start(0);
          console.log("[TTS Lux] Playback started via Web Audio API");
        } catch (e) {
          console.error("[TTS Lux] Audio play failed:", e.message);
          this.currentSource = null;
          finish();
        }
        setTimeout(() => {
          if (!resolved) {
            console.warn("[TTS Lux] Timeout");
            finish();
          }
        }, 30000);
      });
    } catch (e) {
      console.error("[TTS Lux] Error:", e);
    }
  }
  cancel() {
    if (this.currentSource) {
      try {
        this.currentSource.stop();
      } catch (e) {}
      this.currentSource = null;
    }
  }
}

class TTSService {
  engine = "server";
  serverEngine = new TTSServerEngine;
  browserEngine = new TTSBrowserEngine;
  sopranoEngine = new SopranoEngine;
  luxEngine = new LuxEngine;
  options = { volume: 1, rate: 1, pitch: 1 };
  setEngine(engine) {
    this.engine = engine;
    console.log(`[TTS] Engine set to: ${engine}`);
    if (engine === "server") {
      this.serverEngine.loadVoices();
    }
    if (engine === "soprano") {
      this.sopranoEngine.loadVoices();
    }
    if (engine === "lux") {
      this.luxEngine.loadVoices();
    }
  }
  async initPiperWasm() {}
  setOptions(options) {
    this.options = { ...this.options, ...options };
  }
  getVoices() {
    if (this.engine === "server")
      return this.serverEngine.getVoices();
    if (this.engine === "browser")
      return this.browserEngine.loadVoices();
    return [];
  }
  setVoice(voice) {
    if (this.engine === "server")
      this.serverEngine.setVoice(voice);
    if (this.engine === "browser")
      this.browserEngine.setVoice(voice);
  }
  async speak(text) {
    if (this.engine === "server") {
      await this.serverEngine.speak(text, this.options);
    } else if (this.engine === "soprano") {
      await this.sopranoEngine.speak(text, this.options);
    } else if (this.engine === "lux") {
      await this.luxEngine.speak(text, this.options);
    } else {
      await this.browserEngine.speak(text, this.options);
    }
  }
  cancel() {
    this.serverEngine.cancel();
    this.browserEngine.cancel();
    this.sopranoEngine.cancel();
    this.luxEngine.cancel();
  }
}
var ttsService = new TTSService;

// src/services/streaming.ts
class ScreenCaptureService {
  async getSources() {
    try {
      const sources = await navigator.mediaDevices.getSources?.();
      return sources?.filter((s) => s.type === "screen" || s.type === "window").map((s) => ({
        id: s.id,
        label: s.name || s.id,
        type: "screen"
      })) || [];
    } catch (e) {
      console.error("[Screen] getSources failed:", e);
      return [];
    }
  }
  async capture(sourceId) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          mandatory: {
            chromeMediaSource: "desktop",
            chromeMediaSourceId: sourceId
          }
        }
      });
      return stream;
    } catch (e) {
      console.error("[Screen] capture failed:", e);
      return null;
    }
  }
}

class WebcamCaptureService {
  async getDevices() {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      return devices.filter((d) => d.kind === "videoinput").map((d) => ({
        id: d.deviceId,
        label: d.label || `Camera ${d.deviceId.slice(0, 8)}`,
        type: "webcam"
      }));
    } catch (e) {
      console.error("[Webcam] getDevices failed:", e);
      return [];
    }
  }
  async capture(deviceId) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { deviceId: { exact: deviceId } }
      });
      return stream;
    } catch (e) {
      console.error("[Webcam] capture failed:", e);
      return null;
    }
  }
}

class AudioCaptureService {
  async getSources() {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      return devices.filter((d) => d.kind === "audioinput").map((d) => ({
        id: d.deviceId,
        label: d.label || `Microphone ${d.deviceId.slice(0, 8)}`
      }));
    } catch (e) {
      console.error("[Audio] getSources failed:", e);
      return [];
    }
  }
  async capture(deviceId) {
    try {
      const constraints = { audio: true };
      if (deviceId) {
        constraints.audio = { deviceId: { exact: deviceId } };
      }
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      return stream;
    } catch (e) {
      console.error("[Audio] capture failed:", e);
      return null;
    }
  }
}

class StreamingService {
  canvas = null;
  ctx = null;
  sources = new Map;
  animationId = null;
  ws = null;
  ffmpegRunning = false;
  settings = {
    outputWidth: 1920,
    outputHeight: 1080,
    fps: 30,
    bitrate: 6000,
    twitchKey: "",
    kickKey: ""
  };
  async init(width, height) {
    this.canvas = new OffscreenCanvas(width, height);
    this.ctx = this.canvas.getContext("2d");
    console.log("[Stream] Canvas initialized:", width, "x", height);
  }
  addSource(source) {
    this.sources.set(source.id, source);
  }
  removeSource(id) {
    const source = this.sources.get(id);
    if (source?.stream) {
      source.stream.getTracks().forEach((t) => t.stop());
    }
    this.sources.delete(id);
  }
  updateSourcePosition(id, x, y, width, height) {
    const source = this.sources.get(id);
    if (source) {
      source.x = x;
      source.y = y;
      source.width = width;
      source.height = height;
    }
  }
  videoCache = new Map;
  startRenderLoop() {
    if (this.animationId)
      return;
    const render = () => {
      if (!this.ctx || !this.canvas)
        return;
      this.ctx.fillStyle = "#000000";
      this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
      for (const source of this.sources.values()) {
        if (!source.stream || !source.visible)
          continue;
        let video = this.videoCache.get(source.id);
        if (!video) {
          video = document.createElement("video");
          video.srcObject = source.stream;
          video.autoplay = true;
          video.playsInline = true;
          video.muted = true;
          this.videoCache.set(source.id, video);
        }
        if (video.readyState >= 2) {
          this.ctx.drawImage(video, source.x, source.y, source.width, source.height);
        }
      }
      this.animationId = requestAnimationFrame(render);
    };
    render();
  }
  stopRenderLoop() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }
  async startStream(twitchKey, kickKey) {
    if (this.ffmpegRunning)
      return;
    this.settings.twitchKey = twitchKey;
    this.settings.kickKey = kickKey;
    this.ws = new WebSocket("ws://localhost:3006");
    this.ws.onopen = () => {
      console.log("[Stream] Connected to FFmpeg engine");
      this.ws?.send(JSON.stringify({
        action: "start",
        twitchKey,
        kickKey
      }));
    };
    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.status === "started") {
          console.log("[Stream] FFmpeg started");
          this.ffmpegRunning = true;
          this.startFrameCapture();
        } else if (data.status === "error") {
          console.error("[Stream] FFmpeg error:", data.message);
          this.stopStream();
        }
      } catch (e) {
        console.error("[Stream] Message parse error:", e);
      }
    };
    this.ws.onerror = (e) => {
      console.error("[Stream] WebSocket error:", e);
    };
    this.ws.onclose = () => {
      console.log("[Stream] WebSocket closed");
      this.ffmpegRunning = false;
    };
  }
  startFrameCapture() {
    const capture = async () => {
      if (!this.ffmpegRunning || !this.canvas || !this.ws || this.ws.readyState !== WebSocket.OPEN)
        return;
      const blob = await this.canvas.convertToBlob({ type: "image/jpeg", quality: 0.8 });
      const buffer = await blob.arrayBuffer();
      this.ws?.send(buffer);
      setTimeout(capture, 1000 / this.settings.fps);
    };
    capture();
  }
  stopStream() {
    this.ffmpegRunning = false;
    if (this.ws) {
      this.ws.send(JSON.stringify({ action: "stop" }));
      this.ws.close();
      this.ws = null;
    }
    this.stopRenderLoop();
  }
  getStatus() {
    return {
      isStreaming: this.ffmpegRunning,
      isPaused: false,
      duration: 0,
      viewers: 0,
      droppedFrames: 0
    };
  }
}
var screenCapture = new ScreenCaptureService;
var webcamCapture = new WebcamCaptureService;
var audioCapture = new AudioCaptureService;
var streamingService = new StreamingService;

// src/views/main/index.ts
console.log("[Omniversify] View starting...");
var mainEl = document.getElementById("main");
var chatPanel = document.getElementById("chat-panel");
var streamPanel = document.getElementById("stream-panel");
var chatEl = document.getElementById("chat");
var twIn = document.getElementById("tw");
var kwIn = document.getElementById("kw");
var ttsEn = document.getElementById("tts-en");
var ttsEng = document.getElementById("tts-eng");
var ttsTest = document.getElementById("tts-test");
var showLists = document.getElementById("show-lists");
var listsPanel = document.getElementById("lists-panel");
var blEn = document.getElementById("bl-en");
var alEn = document.getElementById("al-en");
var blIn = document.getElementById("bl-in");
var alIn = document.getElementById("al-in");
var blAdd = document.getElementById("bl-add");
var alAdd = document.getElementById("al-add");
mainEl.style.display = "flex";
chatPanel.style.display = "flex";
streamPanel.style.display = "none";
var initialSettings = settingsService.get();
twIn.value = initialSettings.twitchUsername || "";
kwIn.value = initialSettings.kickUsername || "";
ttsEn.checked = initialSettings.ttsEnabled;
ttsEng.value = initialSettings.ttsEngine;
blEn.checked = initialSettings.blocklistEnabled;
alEn.checked = initialSettings.allowlistEnabled;
var resumeAudioContext = () => {
  const ac = window.audioContext || new AudioContext;
  if (ac.state === "suspended") {
    ac.resume().then(() => console.log("[Audio] Context resumed"));
  }
  document.removeEventListener("click", resumeAudioContext);
  document.removeEventListener("keydown", resumeAudioContext);
};
document.addEventListener("click", resumeAudioContext);
document.addEventListener("keydown", resumeAudioContext);
console.log("[Audio] Waiting for user interaction to enable audio");
var loadVoices = () => {
  const v = ttsService.getVoices();
  console.log("[TTS] Available voices:", v.length);
};
if (typeof speechSynthesis !== "undefined") {
  speechSynthesis.onvoiceschanged = loadVoices;
  loadVoices();
}
var ttsQueue = [];
var ttsProcessing = false;
var ttsProcessed = 0;
var ttsFailed = 0;
var ttsStuckCount = 0;
var MAX_QUEUE = 20;
var createTTSStatus = () => {
  const status = document.createElement("div");
  status.id = "tts-status";
  status.style.cssText = "position:fixed;bottom:10px;right:10px;background:rgba(0,0,0,0.8);color:#22c55e;padding:8px 12px;border-radius:6px;font-size:11px;z-index:1001;display:none;";
  status.innerHTML = "TTS: Idle | Queue: 0 | Processed: 0";
  document.body.appendChild(status);
  return status;
};
var ttsStatusEl = createTTSStatus();
var updateTTSStatus = () => {
  const settings = settingsService.get();
  if (settings.ttsEnabled) {
    ttsStatusEl.style.display = "block";
    const queueText = ttsQueue.length > 0 ? `Queue: ${ttsQueue.length}` : "Queue: idle";
    const engine = settings.ttsEngine.toUpperCase();
    ttsStatusEl.innerHTML = `${engine} ${ttsProcessing ? "\uD83D\uDD0A" : "⏸️"} ${queueText} | ✅${ttsProcessed} ❌${ttsFailed}`;
    if (ttsStuckCount > 0)
      ttsStatusEl.innerHTML += ` | STUCK: ${ttsStuckCount}`;
  } else {
    ttsStatusEl.style.display = "none";
  }
};
var lastProgressTime = Date.now();
var watchdogInterval = null;
var startWatchdog = () => {
  if (watchdogInterval)
    return;
  watchdogInterval = window.setInterval(() => {
    const elapsed = Date.now() - lastProgressTime;
    const settings = settingsService.get();
    const isLuxOrSoprano = settings.ttsEngine === "lux" || settings.ttsEngine === "soprano";
    const timeout = isLuxOrSoprano ? 120000 : 60000;
    if (ttsProcessing && elapsed > timeout) {
      ttsStuckCount++;
      console.warn(`[TTS] ⚠️ Watchdog: TTS appears stuck! (${elapsed / 1000}s elapsed)`);
      ttsService.cancel();
      ttsProcessing = false;
      updateTTSStatus();
      processQueue();
    }
  }, 15000);
};
var stopWatchdog = () => {
  if (watchdogInterval) {
    clearInterval(watchdogInterval);
    watchdogInterval = null;
  }
};
setInterval(updateTTSStatus, 300);
var processQueue = async () => {
  if (ttsProcessing)
    return;
  ttsProcessing = true;
  lastProgressTime = Date.now();
  startWatchdog();
  updateTTSStatus();
  while (ttsQueue.length > 0) {
    const text = ttsQueue.shift();
    console.log(`[TTS] Processing (${ttsQueue.length} remaining):`, text.substring(0, 40) + (text.length > 40 ? "..." : ""));
    updateTTSStatus();
    try {
      await ttsService.speak(text);
      ttsProcessed++;
      console.log(`[TTS] ✓ Completed (${ttsProcessed} total)`);
    } catch (e) {
      ttsFailed++;
      console.warn(`[TTS] ✗ Failed (${ttsFailed} total): ${e}`);
    }
    lastProgressTime = Date.now();
    updateTTSStatus();
    await new Promise((r) => setTimeout(r, 150));
  }
  ttsProcessing = false;
  stopWatchdog();
  updateTTSStatus();
};
var speak = (text) => {
  if (!settingsService.get().ttsEnabled) {
    console.log("[TTS] Disabled, skipping:", text.substring(0, 30));
    return;
  }
  if (ttsQueue.length >= MAX_QUEUE) {
    console.warn(`[TTS] ⚠️ Queue full (${MAX_QUEUE}), dropping message`);
    return;
  }
  ttsQueue.push(text);
  console.log(`[TTS] ➕ Queued (size: ${ttsQueue.length}):`, text.substring(0, 40));
  processQueue();
};
window.addEventListener("keydown", (e) => {
  if (e.ctrlKey && e.key === "t") {
    e.preventDefault();
    console.log("[TTS DEBUG] Manual test triggered");
    speak("This is a manual TTS test triggered by keyboard shortcut.");
  }
  if (e.ctrlKey && e.shiftKey && e.key === "C") {
    e.preventDefault();
    ttsQueue = [];
    ttsService.cancel();
    console.log("[TTS DEBUG] Queue cleared");
    updateTTSStatus();
  }
  if (e.ctrlKey && e.shiftKey && e.key === "R") {
    e.preventDefault();
    ttsProcessed = 0;
    ttsFailed = 0;
    console.log("[TTS DEBUG] Stats reset");
    updateTTSStatus();
  }
});
window.__ttsDebug = {
  getStatus: () => ({
    enabled: settingsService.get().ttsEnabled,
    engine: settingsService.get().ttsEngine,
    queueSize: ttsQueue.length,
    processing: ttsProcessing,
    processed: ttsProcessed,
    failed: ttsFailed
  }),
  testTTS: (text) => speak(text || "Debug test"),
  clearQueue: () => {
    ttsQueue = [];
    ttsService.cancel();
    updateTTSStatus();
  },
  resetStats: () => {
    ttsProcessed = 0;
    ttsFailed = 0;
    updateTTSStatus();
  }
};
window.omniDebug = {
  simulateChat: (data) => {
    console.log("[DEBUG] Simulating chat:", data);
    const msg = {
      id: "debug-" + Math.random().toString(36).substring(2, 9),
      platform: data.platform || "twitch",
      username: data.username || "DebugUser",
      message: data.message || "This is a simulated debug message.",
      timestamp: Date.now(),
      color: "#6366f1"
    };
    addChat(msg);
  },
  testTTS: (text) => window.__ttsDebug.testTTS(text),
  clearQueue: () => window.__ttsDebug.clearQueue(),
  getStatus: () => window.__ttsDebug.getStatus()
};
console.log("[TTS] Debug API available: window.omniDebug & window.__ttsDebug");
document.querySelectorAll(".tab").forEach((t) => {
  const button = t;
  button.onclick = () => {
    document.querySelectorAll(".tab").forEach((x) => x.classList.remove("active"));
    button.classList.add("active");
    const tab = button.dataset.tab;
    chatPanel.style.display = tab === "chat" ? "flex" : "none";
    streamPanel.style.display = tab === "stream" ? "flex" : "none";
    streamPanel.classList.toggle("active", tab === "stream");
  };
});
var parseEmotes = (text, emotes) => {
  if (!emotes)
    return text;
  const parts = emotes.split("/");
  const reps = [];
  for (const part of parts) {
    const [id, pos] = part.split(":");
    if (!id || !pos)
      continue;
    for (const r of pos.split(",")) {
      const [s, e] = r.split("-").map(Number);
      if (!isNaN(s) && !isNaN(e))
        reps.push({ s, e, id });
    }
  }
  reps.sort((a, b) => b.s - a.s);
  let res = text;
  for (const r of reps) {
    const img = `<img src="https://static-cdn.jtvnw.net/emoticons/v2/${r.id}/default/dark/3.0" style="vertical-align:middle;height:28px;">`;
    res = res.slice(0, r.s) + img + res.slice(r.e + 1);
  }
  return res;
};
var getCleanText = (msg) => {
  let text = msg.message;
  text = text.replace(/\[emote:\d+:[^\]]+\]/g, "");
  if (msg.platform === "twitch" && msg.emotes) {
    const parts = msg.emotes.split("/");
    const reps = [];
    for (const part of parts) {
      const [, pos] = part.split(":");
      if (!pos)
        continue;
      for (const r of pos.split(",")) {
        const [s, e] = r.split("-").map(Number);
        if (!isNaN(s) && !isNaN(e))
          reps.push({ s, e });
      }
    }
    reps.sort((a, b) => b.s - a.s);
    let cleanText = msg.message;
    for (const r of reps) {
      cleanText = cleanText.slice(0, r.s) + cleanText.slice(r.e + 1);
    }
    text = cleanText;
  }
  text = text.replace(/([\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF])/g, "");
  return text.trim();
};
var addChat = (msg) => {
  const d = document.createElement("div");
  d.className = "msg";
  const c = msg.color || (msg.platform === "twitch" ? "#9146ff" : "#53fc18");
  const txt = msg.platform === "twitch" && msg.emotes ? parseEmotes(msg.message, msg.emotes) : msg.message;
  const badge = document.createElement("span");
  badge.className = `plat ${msg.platform}`;
  badge.textContent = msg.platform;
  const user = document.createElement("span");
  user.className = "user";
  user.style.color = c;
  user.textContent = msg.username + ":";
  user.onclick = (e) => showUserMenu(e, msg.username, msg.platform);
  const content = document.createElement("span");
  content.innerHTML = txt;
  d.appendChild(badge);
  d.appendChild(user);
  d.appendChild(content);
  chatEl.appendChild(d);
  chatEl.scrollTop = chatEl.scrollHeight;
  const settings = settingsService.get();
  if (settings.ttsEnabled) {
    let shouldSpeak = false;
    if (!settings.blocklistEnabled && !settings.allowlistEnabled)
      shouldSpeak = true;
    else if (settings.allowlistEnabled && settings.allowlist.find((u) => u.username === msg.username && u.platform === msg.platform))
      shouldSpeak = true;
    else if (settings.blocklistEnabled && !settings.blocklist.find((u) => u.username === msg.username && u.platform === msg.platform))
      shouldSpeak = true;
    if (shouldSpeak) {
      const cleanText = getCleanText(msg);
      if (cleanText)
        speak(cleanText);
    }
  }
};
var showUserMenu = (e, username, platform) => {
  e.stopPropagation();
  const existing = document.getElementById("user-menu");
  if (existing)
    existing.remove();
  const menu = document.createElement("div");
  menu.id = "user-menu";
  menu.style.cssText = `position:fixed;left:${e.clientX}px;top:${e.clientY}px;background:#1a1a24;border:1px solid #334155;border-radius:8px;padding:12px;z-index:1000;min-width:180px;box-shadow:0 4px 12px rgba(0,0,0,0.5);`;
  menu.innerHTML = `<div style="font-weight:600;margin-bottom:10px;font-size:15px;">${username}<span style="font-size:11px;color:#94a3b8;margin-left:6px;">(${platform})</span></div>` + `<button id="btn-block" style="width:100%;padding:8px;margin-bottom:6px;background:#ef4444;border:none;border-radius:6px;color:white;cursor:pointer;font-size:13px;">Block User</button>` + `<button id="btn-allow" style="width:100%;padding:8px;background:#22c55e;border:none;border-radius:6px;color:white;cursor:pointer;font-size:13px;">Allow User</button>`;
  document.body.appendChild(menu);
  menu.querySelector("#btn-block").onclick = () => {
    addToList(username, platform, "block");
    menu.remove();
  };
  menu.querySelector("#btn-allow").onclick = () => {
    addToList(username, platform, "allow");
    menu.remove();
  };
  setTimeout(() => {
    const close = () => {
      menu.remove();
      document.removeEventListener("click", close);
    };
    document.addEventListener("click", close);
  }, 100);
};
var addToList = (user, platform, list) => {
  const set = settingsService.get();
  if (list === "block") {
    if (!set.blocklist.find((u) => u.username === user && u.platform === platform)) {
      settingsService.set({ blocklist: [...set.blocklist, { username: user, platform }] });
    }
  } else {
    if (!set.allowlist.find((u) => u.username === user && u.platform === platform)) {
      settingsService.set({ allowlist: [...set.allowlist, { username: user, platform }] });
    }
  }
  updateListsUI();
};
var updateListsUI = () => {
  const settings = settingsService.get();
  const blItems = document.getElementById("bl-items");
  const alItems = document.getElementById("al-items");
  document.getElementById("bcnt").textContent = `(${settings.blocklist.length})`;
  document.getElementById("acnt").textContent = `(${settings.allowlist.length})`;
  blItems.innerHTML = settings.blocklist.map((u) => `<div>${u.username} (${u.platform}) <button data-u="${u.username}" data-p="${u.platform}" class="rem-bl" style="background:none;border:none;color:#ef4444;cursor:pointer;">x</button></div>`).join("") || '<div style="color:#94a3b8">Empty</div>';
  alItems.innerHTML = settings.allowlist.map((u) => `<div>${u.username} (${u.platform}) <button data-u="${u.username}" data-p="${u.platform}" class="rem-al" style="background:none;border:none;color:#ef4444;cursor:pointer;">x</button></div>`).join("") || '<div style="color:#94a3b8">Empty</div>';
  blItems.querySelectorAll(".rem-bl").forEach((b) => b.onclick = () => {
    const s = settingsService.get();
    const u = b.dataset.u;
    const p = b.dataset.p;
    settingsService.set({ blocklist: s.blocklist.filter((x) => !(x.username === u && x.platform === p)) });
    updateListsUI();
  });
  alItems.querySelectorAll(".rem-al").forEach((b) => b.onclick = () => {
    const s = settingsService.get();
    const u = b.dataset.u;
    const p = b.dataset.p;
    settingsService.set({ allowlist: s.allowlist.filter((x) => !(x.username === u && x.platform === p)) });
    updateListsUI();
  });
};
twIn.onchange = () => {
  settingsService.set({ twitchUsername: twIn.value });
  twitchService.connect(twIn.value, addChat);
};
kwIn.onchange = () => {
  settingsService.set({ kickUsername: kwIn.value });
  kickService.connect(kwIn.value, addChat);
};
ttsEn.onchange = () => settingsService.set({ ttsEnabled: ttsEn.checked });
ttsEng.onchange = () => {
  settingsService.set({ ttsEngine: ttsEng.value });
  ttsService.setEngine(ttsEng.value);
};
ttsTest.onclick = () => speak("This is a test of the Omniversify Studio speech system.");
showLists.onclick = () => {
  listsPanel.style.display = listsPanel.style.display === "none" ? "block" : "none";
};
blEn.onchange = () => {
  if (blEn.checked) {
    alEn.checked = false;
    settingsService.set({ allowlistEnabled: false });
  }
  settingsService.set({ blocklistEnabled: blEn.checked });
};
alEn.onchange = () => {
  if (alEn.checked) {
    blEn.checked = false;
    settingsService.set({ blocklistEnabled: false });
  }
  settingsService.set({ allowlistEnabled: alEn.checked });
};
blAdd.onclick = () => {
  const u = blIn.value.trim();
  if (u) {
    addToList(u, document.getElementById("bl-pl").value, "block");
    blIn.value = "";
  }
};
alAdd.onclick = () => {
  const u = alIn.value.trim();
  if (u) {
    addToList(u, document.getElementById("al-pl").value, "allow");
    alIn.value = "";
  }
};
if (twIn.value)
  twitchService.connect(twIn.value, addChat);
if (kwIn.value)
  kickService.connect(kwIn.value, addChat);
updateListsUI();
var startStreamBtn = document.getElementById("start-stream");
startStreamBtn.onclick = () => {
  if (streamingService.getStatus().isStreaming) {
    streamingService.stopStream();
    startStreamBtn.textContent = "Go Live";
    startStreamBtn.classList.remove("live");
  } else {
    streamingService.init(960, 540);
    streamingService.startStream("dummy_key", "dummy_key");
    startStreamBtn.textContent = "End Stream";
    startStreamBtn.classList.add("live");
  }
};
console.log("[Omniversify] Ready");
