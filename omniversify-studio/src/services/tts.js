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
export {
  ttsService,
  TTSService
};
