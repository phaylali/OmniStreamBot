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
  ttsEngine: "browser" | "server" | "kokoro";
  selectedVoice: string;
  ttsVolume: number;
  ttsRate: number;
  ttsPitch: number;
  blocklist: { username: string; platform: string }[];
  allowlist: { username: string; platform: string }[];
  blocklistEnabled: boolean;
  allowlistEnabled: boolean;
}

export interface StreamSource {
  id: string;
  type: "screen" | "webcam";
  label: string;
  stream: MediaStream | null;
  x: number;
  y: number;
  width: number;
  height: number;
  visible: boolean;
}