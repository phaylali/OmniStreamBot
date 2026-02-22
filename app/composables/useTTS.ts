import { ref, onMounted } from 'vue';
import { useSettings } from './useSettings';
import { KokoroTTS } from 'kokoro-js';

export const useTTS = () => {
    const settings = useSettings();
    const isSupported = ref(false);
    const isBrowser = ref(false);
    const isLoading = ref(false);
    const isEngineReady = ref(false);
    const engineError = ref<string | null>(null);
    let kokoro: KokoroTTS | null = null;
    let currentAudio: HTMLAudioElement | null = null;

    const initEngine = async () => {
        if (typeof window === 'undefined') return;
        
        isBrowser.value = true;
        isLoading.value = true;
        engineError.value = null;

        try {
            console.log('[TTS] Loading Kokoro model...');
            kokoro = await KokoroTTS.from_pretrained('onnx-community/Kokoro-82M-ONNX', {
                dtype: 'q8',
                device: 'wasm',
            });
            isEngineReady.value = true;
            isSupported.value = true;
            console.log('[TTS] Kokoro engine ready');
        } catch (e: any) {
            console.error('[TTS] Kokoro init failed:', e);
            engineError.value = e.message || 'Failed to load TTS engine';
            isSupported.value = false;
        }
        
        isLoading.value = false;
    };

    onMounted(() => {
        initEngine();
    });

    const speak = async (text: string) => {
        if (!isBrowser.value || !text || !settings.ttsEnabled.value) {
            console.log('[TTS] Not speaking:', { 
                browser: isBrowser.value, 
                hasText: !!text, 
                enabled: settings.ttsEnabled.value 
            });
            return;
        }

        if (!isEngineReady.value || !kokoro) {
            console.log('[TTS] Engine not ready yet, please wait...');
            return;
        }

        console.log('[TTS] Speaking:', text);

        try {
            if (currentAudio) {
                currentAudio.pause();
                currentAudio = null;
            }

            const audioResult = await kokoro.generate(text, {
                voice: 'af_sarah',
            });

            if (!audioResult) {
                console.error('[TTS] No audio generated');
                return;
            }

            const blob = audioResult.toBlob();
            const url = URL.createObjectURL(blob);
            
            currentAudio = new Audio(url);
            currentAudio.volume = settings.ttsVolume.value || 1;
            
            await currentAudio.play();
            
            currentAudio.onended = () => {
                if (currentAudio) {
                    URL.revokeObjectURL(currentAudio.src);
                    currentAudio = null;
                }
            };
        } catch (e: any) {
            console.error('[TTS] Error:', e);
        }
    };

    const stop = () => {
        if (currentAudio) {
            currentAudio.pause();
            currentAudio = null;
        }
    };

    return {
        isSupported,
        isLoading,
        isEngineReady,
        engineError,
        speak,
        stop,
    };
};
