import { ref, watch } from 'vue';

export const useSettings = () => {
    const twitchUsername = ref('');
    const kickUsername = ref('');
    const ttsEnabled = ref(true);
    const selectedVoice = ref('af_sarah');
    const ttsVolume = ref(1.0);

    // Load from localStorage on client-side setup
    if (import.meta.client) {
        const saved = localStorage.getItem('omnistreambot-settings');
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                if (parsed.twitchUsername) twitchUsername.value = parsed.twitchUsername;
                if (parsed.kickUsername) kickUsername.value = parsed.kickUsername;
                if (parsed.ttsEnabled !== undefined) ttsEnabled.value = parsed.ttsEnabled;
                if (parsed.selectedVoice) selectedVoice.value = parsed.selectedVoice;
                if (parsed.ttsVolume !== undefined) ttsVolume.value = parsed.ttsVolume;
            } catch (e) {
                console.error('Failed to parse settings from localStorage', e);
            }
        }

        // Auto-save on changes
        watch([twitchUsername, kickUsername, ttsEnabled, selectedVoice, ttsVolume], () => {
            localStorage.setItem('omnistreambot-settings', JSON.stringify({
                twitchUsername: twitchUsername.value,
                kickUsername: kickUsername.value,
                ttsEnabled: ttsEnabled.value,
                selectedVoice: selectedVoice.value,
                ttsVolume: ttsVolume.value,
            }));
        }, { deep: true });
    }

    return {
        twitchUsername,
        kickUsername,
        ttsEnabled,
        selectedVoice,
        ttsVolume,
    };
};
