import { ref, onMounted } from 'vue';

interface TwitchStreamStatus {
    isLive: boolean;
    channel: string;
    title: string | null;
    game_name: string | null;
    viewer_count: number;
    started_at: string | null;
}

export const useStreamStatus = () => {
    const twitchStatus = ref<TwitchStreamStatus | null>(null);
    const isLoading = ref(false);
    const error = ref<string | null>(null);

    const checkTwitchStatus = async (channel: string) => {
        isLoading.value = true;
        error.value = null;
        
        try {
            const res = await fetch(`/api/twitch?channel=${encodeURIComponent(channel)}`);
            if (!res.ok) {
                throw new Error('Failed to fetch Twitch status');
            }
            twitchStatus.value = await res.json();
        } catch (e: any) {
            error.value = e.message;
            console.error('[StreamStatus] Twitch check failed:', e);
        } finally {
            isLoading.value = false;
        }
    };

    const startPolling = (channel: string, intervalMs = 30000) => {
        checkTwitchStatus(channel);
        const interval = setInterval(() => {
            checkTwitchStatus(channel);
        }, intervalMs);
        
        return () => clearInterval(interval);
    };

    return {
        twitchStatus,
        isLoading,
        error,
        checkTwitchStatus,
        startPolling,
    };
};
