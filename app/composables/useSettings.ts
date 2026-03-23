import { ref, watch } from 'vue';

export type TTSEngine = 'browser' | 'kokoro' | 'serverPiper';

export interface ListEntry {
    username: string;
    platform: 'twitch' | 'kick';
}

const twitchUsername = ref('');
const kickUsername = ref('');
const streamTwitchKey = ref('');
const streamKickKey = ref('');
const ttsEnabled = ref(true);
const selectedVoice = ref('af_sarah');
const ttsVolume = ref(1.0);

// TTS Engine settings
const ttsEngine = ref<TTSEngine>('browser');
const browserVoice = ref('');
const ttsRate = ref(1.0);
const ttsPitch = ref(1.0);

const blocklist = ref<ListEntry[]>([]);
const allowlist = ref<ListEntry[]>([]);
const blocklistEnabled = ref(false);
const allowlistEnabled = ref(false);

let initialized = false;

export const useSettings = () => {
    // Load from localStorage on client-side setup
    if (import.meta.client && !initialized) {
        initialized = true;
        const saved = localStorage.getItem('omnistreambot-settings');
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                if (parsed.twitchUsername) twitchUsername.value = parsed.twitchUsername;
                if (parsed.kickUsername) kickUsername.value = parsed.kickUsername;
                if (parsed.streamTwitchKey) streamTwitchKey.value = parsed.streamTwitchKey;
                if (parsed.streamKickKey) streamKickKey.value = parsed.streamKickKey;
                if (parsed.ttsEnabled !== undefined) ttsEnabled.value = parsed.ttsEnabled;
                if (parsed.selectedVoice) selectedVoice.value = parsed.selectedVoice;
                if (parsed.ttsVolume !== undefined) ttsVolume.value = parsed.ttsVolume;
                if (parsed.ttsEngine) ttsEngine.value = parsed.ttsEngine;
                if (parsed.browserVoice) browserVoice.value = parsed.browserVoice;
                if (parsed.ttsRate !== undefined) ttsRate.value = parsed.ttsRate;
                if (parsed.ttsPitch !== undefined) ttsPitch.value = parsed.ttsPitch;
                if (parsed.blocklist) blocklist.value = parsed.blocklist;
                if (parsed.allowlist) allowlist.value = parsed.allowlist;
                if (parsed.blocklistEnabled !== undefined) blocklistEnabled.value = parsed.blocklistEnabled;
                if (parsed.allowlistEnabled !== undefined) allowlistEnabled.value = parsed.allowlistEnabled;
            } catch (e) {
                console.error('Failed to parse settings from localStorage', e);
            }
        }

        // Auto-save on changes
        watch([twitchUsername, kickUsername, streamTwitchKey, streamKickKey, ttsEnabled, selectedVoice, ttsVolume, ttsEngine, browserVoice, ttsRate, ttsPitch, blocklist, allowlist, blocklistEnabled, allowlistEnabled], () => {
            localStorage.setItem('omnistreambot-settings', JSON.stringify({
                twitchUsername: twitchUsername.value,
                kickUsername: kickUsername.value,
                streamTwitchKey: streamTwitchKey.value,
                streamKickKey: streamKickKey.value,
                ttsEnabled: ttsEnabled.value,
                selectedVoice: selectedVoice.value,
                ttsVolume: ttsVolume.value,
                ttsEngine: ttsEngine.value,
                browserVoice: browserVoice.value,
                ttsRate: ttsRate.value,
                ttsPitch: ttsPitch.value,
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
        streamTwitchKey,
        streamKickKey,
        ttsEnabled,
        selectedVoice,
        ttsVolume,
        ttsEngine,
        browserVoice,
        ttsRate,
        ttsPitch,
        blocklist,
        allowlist,
        blocklistEnabled,
        allowlistEnabled,
    };
};
