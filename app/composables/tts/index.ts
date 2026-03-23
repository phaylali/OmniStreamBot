import { ref, watch } from 'vue';
import { createBrowserEngine } from './engines/browser';
import { createKokoroEngine } from './engines/kokoro';
import { createServerPiperEngine } from './engines/serverPiper';
import type { TTSEngineInterface, TTSVoice, TTSEngine } from './types';

let browserEngine: TTSEngineInterface | null = null;
let kokoroEngine: TTSEngineInterface | null = null;
let serverPiperEngine: TTSEngineInterface | null = null;
let currentEngine: TTSEngineInterface | null = null;

const messageQueue: string[] = [];
let isProcessingQueue = false;

export interface TTSSettings {
    ttsEnabled: { value: boolean };
    ttsEngine: { value: TTSEngine };
    selectedVoice: { value: string };
    browserVoice: { value: string };
    ttsVolume: { value: number };
    ttsRate: { value: number };
    ttsPitch: { value: number };
}

export interface TTSFactory {
    isSupported: { value: boolean };
    isLoading: { value: boolean };
    isEngineReady: { value: boolean };
    engineError: { value: string | null };
    voices: { value: Record<string, TTSVoice> };
    currentEngineName: { value: TTSEngine };
    speak: (text: string) => Promise<void>;
    stop: () => void;
    setVolume: (volume: number) => void;
    init: () => Promise<void>;
    switchEngine: (engine: TTSEngine) => Promise<void>;
}

export const createTTSFactory = (settings: TTSSettings): TTSFactory => {
    const isSupported = ref(false);
    const isLoading = ref(false);
    const isEngineReady = ref(false);
    const engineError = ref<string | null>(null);
    const voices = ref<Record<string, TTSVoice>>({});
    const currentEngineName = ref<TTSEngine>(settings.ttsEngine.value);

    const getVolume = () => settings.ttsVolume.value;
    const getKokoroVoice = () => settings.selectedVoice.value;
    const getBrowserVoice = () => settings.browserVoice.value;
    const getPiperVoice = () => settings.selectedVoice.value;
    const getRate = () => settings.ttsRate.value;
    const getPitch = () => settings.ttsPitch.value;

    const initBrowser = async () => {
        if (!browserEngine) {
            browserEngine = createBrowserEngine(getVolume, getBrowserVoice, getRate, getPitch);
        }
        await browserEngine.init();
    };

    const initKokoro = async () => {
        if (!kokoroEngine) {
            kokoroEngine = createKokoroEngine(getVolume, getKokoroVoice);
        }
        await kokoroEngine.init();
    };

    const initServerPiper = async () => {
        if (!serverPiperEngine) {
            serverPiperEngine = createServerPiperEngine(getVolume, getPiperVoice);
        }
        await serverPiperEngine.init();
    };

    const processQueue = async () => {
        if (isProcessingQueue || messageQueue.length === 0 || !settings.ttsEnabled.value) {
            return;
        }

        isProcessingQueue = true;

        while (messageQueue.length > 0 && settings.ttsEnabled.value) {
            const text = messageQueue.shift();
            if (!text) continue;

            if (currentEngine && currentEngine.isReady) {
                try {
                    await currentEngine.speak(text);
                } catch (e) {
                    console.error('[TTS] Speak error, attempting fallback:', e);
                    await attemptFallback();
                }
            } else if (currentEngineName.value !== 'browser') {
                console.log('[TTS] Current engine not ready, attempting fallback');
                await attemptFallback();
            }
        }

        isProcessingQueue = false;
    };

    const attemptFallback = async (): Promise<boolean> => {
        if (currentEngineName.value !== 'browser') {
            console.log('[TTS] Falling back to browser engine');
            currentEngineName.value = 'browser';
            settings.ttsEngine.value = 'browser';

            if (!browserEngine) {
                await initBrowser();
            }
            currentEngine = browserEngine;

            if (currentEngine?.isReady) {
                isEngineReady.value = true;
                voices.value = currentEngine.voices;
                engineError.value = null;
                return true;
            }
        }

        return false;
    };

    const switchEngine = async (engine: TTSEngine) => {
        if (currentEngine) {
            currentEngine.stop();
        }
        messageQueue.length = 0;
        isProcessingQueue = false;

        currentEngineName.value = engine;
        settings.ttsEngine.value = engine;

        if (engine === 'browser') {
            if (!browserEngine) {
                await initBrowser();
            }
            currentEngine = browserEngine;
        } else if (engine === 'kokoro') {
            if (!kokoroEngine) {
                await initKokoro();
            }
            currentEngine = kokoroEngine;
        } else if (engine === 'serverPiper') {
            if (!serverPiperEngine) {
                await initServerPiper();
            }
            currentEngine = serverPiperEngine;
        }

        if (currentEngine) {
            isEngineReady.value = currentEngine.isReady;
            voices.value = currentEngine.voices;
            engineError.value = currentEngine.error;

            // Auto-select first voice for this engine
            const voiceKeys = Object.keys(currentEngine.voices);
            if (voiceKeys.length > 0 && voiceKeys[0]) {
                if (engine === 'browser') {
                    settings.browserVoice.value = voiceKeys[0] as string;
                } else {
                    settings.selectedVoice.value = voiceKeys[0] as string;
                }
            }
        }
    };

    const init = async () => {
        if (typeof window === 'undefined') return;

        isLoading.value = true;
        isSupported.value = true;

        try {
            const engine = settings.ttsEngine.value;

            if (engine === 'browser') {
                await initBrowser();
                currentEngine = browserEngine;
            } else if (engine === 'kokoro') {
                await initKokoro();
                currentEngine = kokoroEngine;
            } else if (engine === 'serverPiper') {
                await initServerPiper();
                currentEngine = serverPiperEngine;
            }

            if (currentEngine) {
                isEngineReady.value = currentEngine.isReady;
                voices.value = currentEngine.voices;
                engineError.value = currentEngine.error;
            }
        } catch (e: any) {
            console.error('[TTS] Init error:', e);
            engineError.value = e.message || 'Failed to initialize TTS';

            const fallbackSuccess = await attemptFallback();
            if (!fallbackSuccess) {
                isSupported.value = false;
            }
        }

        isLoading.value = false;
    };

    const speak = async (text: string) => {
        if (!settings.ttsEnabled.value || !text) {
            return;
        }

        messageQueue.push(text);

        if (!isEngineReady.value || !currentEngine) {
            console.log('[TTS] Engine not ready, initializing...');
            await init();
            if (!isEngineReady.value) {
                return;
            }
        }

        processQueue();
    };

    const stop = () => {
        if (currentEngine) {
            currentEngine.stop();
        }
        messageQueue.length = 0;
        isProcessingQueue = false;
    };

    watch(() => settings.ttsEngine.value, async (newEngine) => {
        if (newEngine !== currentEngineName.value) {
            await switchEngine(newEngine);
        }
    });

    return {
        isSupported,
        isLoading,
        isEngineReady,
        engineError,
        voices,
        currentEngineName,
        speak,
        stop,
        setVolume: (volume: number) => {
            if (currentEngine && currentEngine.setVolume) {
                currentEngine.setVolume(volume);
            }
        },
        init,
        switchEngine,
    };
};
