export interface StreamSource {
  type: "screen" | "webcam";
  id: string;
  label: string;
  stream: MediaStream | null;
  x: number;
  y: number;
  width: number;
  height: number;
  visible: boolean;
}

export interface StreamSettings {
  outputWidth: number;
  outputHeight: number;
  fps: number;
  bitrate: number;
  twitchKey: string;
  kickKey: string;
}

export interface StreamStatus {
  isStreaming: boolean;
  isPaused: boolean;
  duration: number;
  viewers: number;
  droppedFrames: number;
}

export class ScreenCaptureService {
  async getSources() {
    try {
      // @ts-ignore - Electron/navigator.mediaDevices stub
      const sources = await navigator.mediaDevices.getSources?.();
      return sources
        ?.filter((s: any) => s.type === "screen" || s.type === "window")
        .map((s: any) => ({
          id: s.id,
          label: s.name || s.id,
          type: "screen" as const,
        })) || [];
    } catch (e) {
      console.error("[Screen] getSources failed:", e);
      return [];
    }
  }

  async capture(sourceId: string): Promise<MediaStream | null> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          // @ts-ignore - Electron-specific constraint
          mandatory: {
            chromeMediaSource: "desktop",
            chromeMediaSourceId: sourceId,
          },
        },
      });
      return stream;
    } catch (e) {
      console.error("[Screen] capture failed:", e);
      return null;
    }
  }
}

export class WebcamCaptureService {
  async getDevices() {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      return devices
        .filter((d) => d.kind === "videoinput")
        .map((d) => ({
          id: d.deviceId,
          label: d.label || `Camera ${d.deviceId.slice(0, 8)}`,
          type: "webcam" as const,
        }));
    } catch (e) {
      console.error("[Webcam] getDevices failed:", e);
      return [];
    }
  }

  async capture(deviceId: string): Promise<MediaStream | null> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { deviceId: { exact: deviceId } },
      });
      return stream;
    } catch (e) {
      console.error("[Webcam] capture failed:", e);
      return null;
    }
  }
}

export class AudioCaptureService {
  async getSources() {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      return devices
        .filter((d) => d.kind === "audioinput")
        .map((d) => ({
          id: d.deviceId,
          label: d.label || `Microphone ${d.deviceId.slice(0, 8)}`,
        }));
    } catch (e) {
      console.error("[Audio] getSources failed:", e);
      return [];
    }
  }

  async capture(deviceId?: string): Promise<MediaStream | null> {
    try {
      const constraints: any = { audio: true };
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

export class StreamingService {
  private canvas: OffscreenCanvas | null = null;
  private ctx: OffscreenCanvasRenderingContext2D | null = null;
  private sources: Map<string, StreamSource> = new Map();
  private animationId: number | null = null;
  private ws: WebSocket | null = null;
  private ffmpegRunning = false;
  private settings: StreamSettings = {
    outputWidth: 1920,
    outputHeight: 1080,
    fps: 30,
    bitrate: 6000,
    twitchKey: "",
    kickKey: "",
  };

  async init(width: number, height: number) {
    this.canvas = new OffscreenCanvas(width, height);
    this.ctx = this.canvas.getContext("2d");
    console.log("[Stream] Canvas initialized:", width, "x", height);
  }

  addSource(source: StreamSource) {
    this.sources.set(source.id, source);
  }

  removeSource(id: string) {
    const source = this.sources.get(id);
    if (source?.stream) {
      source.stream.getTracks().forEach((t) => t.stop());
    }
    this.sources.delete(id);
  }

  updateSourcePosition(id: string, x: number, y: number, width: number, height: number) {
    const source = this.sources.get(id);
    if (source) {
      source.x = x;
      source.y = y;
      source.width = width;
      source.height = height;
    }
  }

  private videoCache: Map<string, HTMLVideoElement> = new Map();

  startRenderLoop() {
    if (this.animationId) return;

    const render = () => {
      if (!this.ctx || !this.canvas) return;

      // Clear canvas
      this.ctx.fillStyle = "#000000";
      this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

      // Draw each source
      for (const source of this.sources.values()) {
        if (!source.stream || !source.visible) continue;

        let video = this.videoCache.get(source.id);
        if (!video) {
          video = document.createElement("video");
          video.srcObject = source.stream;
          video.autoplay = true;
          video.playsInline = true;
          video.muted = true; // Avoid feedback
          this.videoCache.set(source.id, video);
        }
        
        if (video.readyState >= 2) {
          this.ctx.drawImage(
            video,
            source.x,
            source.y,
            source.width,
            source.height
          );
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

  async startStream(twitchKey: string, kickKey: string) {
    if (this.ffmpegRunning) return;

    this.settings.twitchKey = twitchKey;
    this.settings.kickKey = kickKey;

    this.ws = new WebSocket("ws://localhost:3006");

    this.ws.onopen = () => {
      console.log("[Stream] Connected to FFmpeg engine");
      this.ws?.send(
        JSON.stringify({
          action: "start",
          twitchKey,
          kickKey,
        })
      );
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

  private startFrameCapture() {
    const capture = async () => {
      if (!this.ffmpegRunning || !this.canvas || !this.ws || this.ws.readyState !== WebSocket.OPEN) return;

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

  getStatus(): StreamStatus {
    return {
      isStreaming: this.ffmpegRunning,
      isPaused: false,
      duration: 0,
      viewers: 0,
      droppedFrames: 0,
    };
  }
}

export const screenCapture = new ScreenCaptureService();
export const webcamCapture = new WebcamCaptureService();
export const audioCapture = new AudioCaptureService();
export const streamingService = new StreamingService();