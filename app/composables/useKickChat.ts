import { ref, watch, onUnmounted } from 'vue';
import { useSettings } from './useSettings';
import type { ChatMessage } from './useTwitchChat';

export const useKickChat = (onMessage: (msg: ChatMessage) => void) => {
    const settings = useSettings();
    const socket = ref<WebSocket | null>(null);
    const isConnected = ref(false);
    const chatroomId = ref<number | null>(null);

    const connect = async () => {
        disconnect();

        const channel = settings.kickUsername.value.trim().toLowerCase();
        if (!channel) return;

        console.log('[Kick] Connecting to channel:', channel);

        try {
            // Fetch Chatroom ID via our server API (which uses allorigins proxy)
            const res = await fetch(`/api/kick/${channel}`);

            if (res.status === 403) {
                console.error('[Kick] Access blocked by Cloudflare. Please visit https://kick.com in your browser and solve the captcha to unblock.');
                alert('Kick connection blocked by Cloudflare. Please visit kick.com in your browser, solve the captcha, and try again.');
                return;
            }

            if (!res.ok) {
                console.error('[Kick] Failed to get chatroom ID, status:', res.status);
                return;
            }

            const data = await res.json();
            chatroomId.value = data.chatroomId;
            console.log('[Kick] Got chatroom ID:', chatroomId.value);

            if (!chatroomId.value) return;

            // 2. Connect to Pusher WebSocket
            // Kick's public pusher app key: 32cbd69e4b950bf97679
            const ws = new WebSocket('wss://ws-us2.pusher.com/app/32cbd69e4b950bf97679?protocol=7&client=js&version=7.6.0&flash=false');

            ws.onopen = () => {
                console.log('[Kick] WebSocket connected');
                // Subscribe to the chatroom
                ws.send(JSON.stringify({
                    event: 'pusher:subscribe',
                    data: {
                        auth: '',
                        channel: `chatrooms.${chatroomId.value}.v2`
                    }
                }));
                isConnected.value = true;
            };

            ws.onmessage = (event) => {
                try {
                    const msg = JSON.parse(event.data);

                    if (msg.event === 'App\\Events\\ChatMessageEvent') {
                        const chatData = JSON.parse(msg.data);

                        onMessage({
                            id: chatData.id || Math.random().toString(36).substring(2, 9),
                            platform: 'kick',
                            username: chatData.sender?.username || 'Unknown',
                            message: chatData.content || '',
                            color: chatData.sender?.identity?.color || '#53fc18', // Default kick green
                            timestamp: Date.now()
                        });
                    }

                    // Respond to pusher pings
                    if (msg.event === 'pusher:ping') {
                        ws.send(JSON.stringify({ event: 'pusher:pong' }));
                    }
                } catch (e) {
                    // ignore parsing errors for non-json
                }
            };

            ws.onclose = () => {
                console.log('[Kick] WebSocket closed');
                isConnected.value = false;
            };

            ws.onerror = (err) => {
                console.error('[Kick] WebSocket error:', err);
            };

            socket.value = ws;

        } catch (e) {
            console.error('Error connecting to Kick chat:', e);
        }
    };

    const disconnect = () => {
        if (socket.value) {
            if (chatroomId.value) {
                try {
                    socket.value.send(JSON.stringify({
                        event: 'pusher:unsubscribe',
                        data: { channel: `chatrooms.${chatroomId.value}.v2` }
                    }));
                } catch (e) { }
            }
            socket.value.close();
            socket.value = null;
        }
        isConnected.value = false;
    };

    // Reconnect if the username changes
    watch(() => settings.kickUsername.value, (newUsername) => {
        if (newUsername) {
            connect();
        } else {
            disconnect();
        }
    });

    onUnmounted(() => {
        disconnect();
    });

    return {
        connect,
        disconnect,
        isConnected,
    };
};
