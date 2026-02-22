import { ref, watch, onUnmounted } from 'vue';
import { useSettings } from './useSettings';

export interface ChatMessage {
    id: string;
    platform: 'twitch' | 'kick';
    username: string;
    message: string;
    color?: string;
    timestamp: number;
}

export const useTwitchChat = (onMessage: (msg: ChatMessage) => void) => {
    const settings = useSettings();
    const socket = ref<WebSocket | null>(null);
    const isConnected = ref(false);

    // Parse Twitch IRC Messages
    const parseMessage = (raw: string) => {
        // @badge-info=...;color=#FF0000;display-name=User... :user!user@user.tmi.twitch.tv PRIVMSG #channel :Message here
        if (!raw.includes('PRIVMSG')) return;

        try {
            let color = '#a855f7'; // default twitch purple-ish
            let displayName = 'Unknown';
            let messageContent = '';

            // Extract tags
            const tagsMatch = raw.match(/^@([^ ]+) /);
            if (tagsMatch && tagsMatch[1]) {
                const tags = tagsMatch[1].split(';');
                for (const tag of tags) {
                    const [key, value] = tag.split('=');
                    if (key === 'color' && value) color = value;
                    if (key === 'display-name' && value) displayName = value;
                }
            }

            // Extract message content
            const messageMatch = raw.match(/PRIVMSG #[^ ]+ :(.+)$/);
            if (messageMatch && messageMatch[1]) {
                messageContent = messageMatch[1].trim();
            }

            // Fallback name extraction if no display-name tag
            if (displayName === 'Unknown') {
                const nameMatch = raw.match(/:([^!]+)!/);
                if (nameMatch && nameMatch[1]) {
                    displayName = nameMatch[1];
                }
            }

            onMessage({
                id: Math.random().toString(36).substring(2, 9),
                platform: 'twitch',
                username: displayName,
                message: messageContent,
                color,
                timestamp: Date.now()
            });
        } catch (e) {
            console.error('Error parsing twitch message', e);
        }
    };

    const connect = () => {
        if (socket.value) {
            socket.value.close();
        }

        const channel = settings.twitchUsername.value.trim().toLowerCase();
        if (!channel) return;

        const ws = new WebSocket('wss://irc-ws.chat.twitch.tv:443');

        ws.onopen = () => {
            // Anonymous login
            ws.send('CAP REQ :twitch.tv/tags twitch.tv/commands');
            ws.send('PASS SCHMOOPIIE');
            ws.send(`NICK justinfan${Math.floor(Math.random() * 100000)}`);
            ws.send(`JOIN #${channel}`);
            isConnected.value = true;
        };

        ws.onmessage = (event) => {
            const msgs = event.data.split('\r\n');
            for (const msg of msgs) {
                if (!msg) continue;
                if (msg.startsWith('PING')) {
                    ws.send('PONG :tmi.twitch.tv');
                } else {
                    parseMessage(msg);
                }
            }
        };

        ws.onclose = () => {
            isConnected.value = false;
            // Reconnect logic could be added here
        };

        socket.value = ws;
    };

    const disconnect = () => {
        if (socket.value) {
            socket.value.close();
            socket.value = null;
        }
        isConnected.value = false;
    };

    // Reconnect if the username changes
    watch(() => settings.twitchUsername.value, (newUsername) => {
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
