export interface ChatMessage {
  id: string;
  platform: "twitch" | "kick";
  username: string;
  message: string;
  color?: string;
  timestamp: number;
  emotes?: string;
}

export interface Settings {
  twitchUsername: string;
  kickUsername: string;
  ttsEnabled: boolean;
  ttsEngine: "browser" | "server";
  selectedVoice: string;
  ttsVolume: number;
  ttsRate: number;
  ttsPitch: number;
  blocklist: { username: string; platform: string }[];
  allowlist: { username: string; platform: string }[];
  blocklistEnabled: boolean;
  allowlistEnabled: boolean;
}

const defaultSettings: Settings = {
  twitchUsername: "",
  kickUsername: "",
  ttsEnabled: false,
  ttsEngine: "server",
  selectedVoice: "en_US-amy-low",
  ttsVolume: 1.0,
  ttsRate: 1.0,
  ttsPitch: 1.0,
  blocklist: [],
  allowlist: [],
  blocklistEnabled: false,
  allowlistEnabled: false,
};

class SettingsService {
  private settings: Settings = { ...defaultSettings };
  private listeners: Set<(settings: Settings) => void> = new Set();

  constructor() {
    this.load();
  }

  private load() {
    try {
      const stored = globalThis.localStorage?.getItem("omniversify-settings");
      if (stored) {
        this.settings = { ...defaultSettings, ...JSON.parse(stored) };
      }
    } catch (e) {
      console.error("[Settings] Failed to load:", e);
    }
  }

  private save() {
    try {
      globalThis.localStorage?.setItem("omniversify-settings", JSON.stringify(this.settings));
    } catch (e) {
      console.error("[Settings] Failed to save:", e);
    }
    this.notify();
  }

  private notify() {
    this.listeners.forEach((cb) => cb(this.settings));
  }

  get() {
    return { ...this.settings };
  }

  set(partial: Partial<Settings>) {
    this.settings = { ...this.settings, ...partial };
    this.save();
  }

  subscribe(cb: (settings: Settings) => void) {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }
}

export const settingsService = new SettingsService();