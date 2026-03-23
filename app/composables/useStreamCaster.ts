import { ref } from 'vue';

export const useStreamCaster = () => {
    const isStreaming = ref(false);
    const isRecording = ref(false);
    const mediaRecorder = ref<MediaRecorder | null>(null);
    const ws = ref<WebSocket | null>(null);

    const startStream = async (canvas: HTMLCanvasElement, mixedAudioStream: MediaStream | null, twitchKey: string, kickKey: string) => {
        if (isStreaming.value) return;

        // Connect to local C++ ingestion server
        ws.value = new WebSocket('ws://localhost:3006');

        ws.value.onopen = () => {
            console.log('[StreamCaster] Connected to local ingest server.');
            // Send start command
            setTimeout(() => {
                ws.value?.send(JSON.stringify({
                    action: 'start',
                    twitchKey,
                    kickKey
                }));
            }, 500); // Give FFmpeg time to start
        };

        ws.value.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                if (data.status === 'started') {
                    console.log('[StreamCaster] Server confirmed stream start. Starting frame capture...');
                    isStreaming.value = true;
                    
                    // Capture frames from canvas and send as JPEG
                    const captureFrame = () => {
                        if (!isStreaming.value || !canvas || !ws.value || ws.value.readyState !== WebSocket.OPEN) return;
                        
                        const ctx = canvas.getContext('2d');
                        if (ctx) {
                            canvas.toBlob((blob) => {
                                if (blob && ws.value?.readyState === WebSocket.OPEN) {
                                    // Send frame as binary
                                    blob.arrayBuffer().then(buffer => {
                                        ws.value?.send(buffer);
                                    });
                                }
                            }, 'image/jpeg', 0.8);
                        }
                        
                        // Capture next frame at ~15 FPS
                        setTimeout(captureFrame, 66);
                    };
                    
                    // Start capturing frames
                    captureFrame();
                    
                } else if (data.status === 'error') {
                    console.error('[StreamCaster] Server error:', data.message);
                    stopStream();
                }
            } catch (err) {
                console.error('[StreamCaster] Failed to parse message:', err);
            }
        };

        ws.value.onerror = (e) => {
            console.error('[StreamCaster] WS Error:', e);
            stopStream();
        };

        ws.value.onclose = () => {
            console.log('[StreamCaster] WS Closed');
            stopStream();
        };
    };

    const stopStream = () => {
        if (mediaRecorder.value && mediaRecorder.value.state !== 'inactive') {
            mediaRecorder.value.stop();
        }
        
        if (ws.value) {
            if (ws.value.readyState === WebSocket.OPEN) {
                ws.value.send(JSON.stringify({ action: 'stop' }));
            }
            ws.value.close();
            ws.value = null;
        }

        isStreaming.value = false;
        isRecording.value = false;
    };

    return {
        isStreaming,
        isRecording,
        startStream,
        stopStream
    };
};
