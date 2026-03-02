import { ref, onMounted, watch } from 'vue';
import { useSettings } from './useSettings';
import { createTTSFactory } from './tts';

export const useTTS = () => {
    const settings = useSettings();
    let initialized = false;

    const factory = createTTSFactory({
        ttsEnabled: settings.ttsEnabled,
        ttsEngine: settings.ttsEngine,
        selectedVoice: settings.selectedVoice,
        browserVoice: settings.browserVoice,
        ttsVolume: settings.ttsVolume,
        ttsRate: settings.ttsRate,
        ttsPitch: settings.ttsPitch,
    });

    watch(() => settings.ttsEnabled.value, (enabled) => {
        if (!initialized) return;
        if (enabled && !factory.isEngineReady.value) {
            factory.init();
        } else if (!enabled) {
            factory.stop();
        }
    });

    watch(() => settings.ttsVolume.value, (volume) => {
        factory.setVolume(volume);
    });

    const speak = async (text: string, params?: { username: string; platform: 'twitch' | 'kick' }) => {
        if (!text || !settings.ttsEnabled.value) {
            return;
        }

        if (params?.username) {
            const username = params.username.toLowerCase();
            const platform = params.platform;

            if (settings.blocklistEnabled.value) {
                const isBlocked = settings.blocklist.value.some(
                    entry => entry.username.toLowerCase() === username && entry.platform === platform
                );
                if (isBlocked) {
                    console.log('[TTS] Blocked by blocklist:', username);
                    return;
                }
            }

            if (settings.allowlistEnabled.value) {
                const isAllowed = settings.allowlist.value.some(
                    entry => entry.username.toLowerCase() === username && entry.platform === platform
                );
                if (!isAllowed) {
                    console.log('[TTS] Not in allowlist:', username);
                    return;
                }
            }
        }

        await factory.speak(text);
    };

    const stop = () => {
        factory.stop();
    };

    onMounted(() => {
        initialized = true;
        if (settings.ttsEnabled.value) {
            factory.init();
        }
    });

    return {
        isSupported: factory.isSupported,
        isLoading: factory.isLoading,
        isEngineReady: factory.isEngineReady,
        engineError: factory.engineError,
        voices: factory.voices,
        currentEngineName: factory.currentEngineName,
        speak,
        stop,
        switchEngine: factory.switchEngine,
    };
};
