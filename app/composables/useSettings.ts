import { ref, watch } from 'vue';

export interface ListEntry {
    username: string;
    platform: 'twitch' | 'kick';
}

export const useSettings = () => {
    const twitchUsername = ref('');
    const kickUsername = ref('');
    const ttsEnabled = ref(true);
    const selectedVoice = ref('af_sarah');
    const ttsVolume = ref(1.0);

    const blocklist = ref<ListEntry[]>([]);
    const allowlist = ref<ListEntry[]>([]);
    const blocklistEnabled = ref(false);
    const allowlistEnabled = ref(false);

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
                if (parsed.blocklist) blocklist.value = parsed.blocklist;
                if (parsed.allowlist) allowlist.value = parsed.allowlist;
                if (parsed.blocklistEnabled !== undefined) blocklistEnabled.value = parsed.blocklistEnabled;
                if (parsed.allowlistEnabled !== undefined) allowlistEnabled.value = parsed.allowlistEnabled;
            } catch (e) {
                console.error('Failed to parse settings from localStorage', e);
            }
        }

        // Auto-save on changes
        watch([twitchUsername, kickUsername, ttsEnabled, selectedVoice, ttsVolume, blocklist, allowlist, blocklistEnabled, allowlistEnabled], () => {
            localStorage.setItem('omnistreambot-settings', JSON.stringify({
                twitchUsername: twitchUsername.value,
                kickUsername: kickUsername.value,
                ttsEnabled: ttsEnabled.value,
                selectedVoice: selectedVoice.value,
                ttsVolume: ttsVolume.value,
                blocklist: blocklist.value,
                allowlist: allowlist.value,
                blocklistEnabled: blocklistEnabled.value,
                allowlistEnabled: allowlistEnabled.value,
            }));
        }, { deep: true });
    }

    return {
        twitchUsername,
        kickUsername,
        ttsEnabled,
        selectedVoice,
        ttsVolume,
        blocklist,
        allowlist,
        blocklistEnabled,
        allowlistEnabled,
    };
};
