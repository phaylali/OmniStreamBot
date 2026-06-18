import type { ChatMessage } from "../lib/types";

export class TwitchService {
  private ws: WebSocket | null = null;
  private onMessageCb: ((msg: ChatMessage) => void) | null = null;
  private isConnected = false;
  private channel = "";

  connect(channel: string, onMessage: (msg: ChatMessage) => void) {
    this.disconnect();
    if (!channel.trim()) return;

    this.channel = channel.trim().toLowerCase();
    this.onMessageCb = onMessage;

    this.ws = new WebSocket("wss://irc-ws.chat.twitch.tv:443");

    this.ws.onopen = () => {
      console.log("[Twitch] Connected to IRC");
      this.ws?.send("CAP REQ :twitch.tv/tags twitch.tv/commands");
      this.ws?.send("PASS SCHMOOPIIE");
      this.ws?.send(`NICK justinfan${Math.floor(Math.random() * 100000)}`);
      this.ws?.send(`JOIN #${this.channel}`);
      this.isConnected = true;
    };

    this.ws.onmessage = (event) => {
      const messages = event.data.split("\r\n");
      for (const raw of messages) {
        if (!raw) continue;
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

  private parseMessage(raw: string) {
    if (!raw.includes("PRIVMSG") || !this.onMessageCb) return;

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
          if (key === "color" && value) color = value;
          if (key === "display-name" && value) displayName = value;
          if (key === "emotes" && value) emotes = value;
        }
      }

      const messageMatch = raw.match(/PRIVMSG #[^ ]+ :(.+)$/);
      if (messageMatch?.[1]) {
        messageContent = messageMatch[1].trim();
      }

      if (displayName === "Unknown") {
        const nameMatch = raw.match(/:([^!]+)!/);
        if (nameMatch?.[1]) displayName = nameMatch[1];
      }

      this.onMessageCb({
        id: Math.random().toString(36).substring(2, 9),
        platform: "twitch",
        username: displayName,
        message: messageContent,
        color,
        timestamp: Date.now(),
        emotes,
      });
    } catch (e) {
      console.error("[Twitch] Parse error:", e);
    }
  }

  get connected() {
    return this.isConnected;
  }
}

export const twitchService = new TwitchService();