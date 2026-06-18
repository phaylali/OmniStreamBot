import type { ChatMessage } from "../lib/types";

export class KickService {
  private ws: WebSocket | null = null;
  private onMessageCb: ((msg: ChatMessage) => void) | null = null;
  private isConnected = false;
  private chatroomId: number | null = null;

  async connect(channel: string, onMessage: (msg: ChatMessage) => void) {
    this.disconnect();
    if (!channel.trim()) return;

    const channelLower = channel.trim().toLowerCase();
    this.onMessageCb = onMessage;

    try {
      // Fetch chatroom ID via local bridge (port 3003)
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

      // Connect to Pusher WebSocket
      this.ws = new WebSocket(
        "wss://ws-us2.pusher.com/app/32cbd69e4b950bf97679?protocol=7&client=js&version=7.6.0&flash=false"
      );

      this.ws.onopen = () => {
        console.log("[Kick] Pusher connected");
        this.ws?.send(
          JSON.stringify({
            event: "pusher:subscribe",
            data: { auth: "", channel: `chatrooms.${this.chatroomId}.v2` },
          })
        );
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
              timestamp: Date.now(),
            });
          }

          if (msg.event === "pusher:ping") {
            this.ws?.send(JSON.stringify({ event: "pusher:pong" }));
          }
        } catch (e) {
          // Ignore non-JSON messages
        }
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
          this.ws.send(
            JSON.stringify({
              event: "pusher:unsubscribe",
              data: { channel: `chatrooms.${this.chatroomId}.v2` },
            })
          );
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

export const kickService = new KickService();