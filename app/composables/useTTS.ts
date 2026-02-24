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
    const voices = ref<Record<string, any>>({});
    let kokoro: KokoroTTS | null = null;
    let currentAudio: HTMLAudioElement | null = null;
    const messageQueue: string[] = [];
    let isProcessingQueue = false;

    const processQueue = async () => {
        if (isProcessingQueue || messageQueue.length === 0) return;
        
        isProcessingQueue = true;
        
        while (messageQueue.length > 0) {
            const text = messageQueue.shift();
            if (!text || !settings.ttsEnabled.value) continue;
            
            if (!isEngineReady.value || !kokoro) {
                console.log('[TTS] Engine not ready, skipping message');
                continue;
            }

            try {
                const audioResult = await kokoro.generate(text, {
                    voice: settings.selectedVoice.value || 'af_sarah',
                });

                if (!audioResult) continue;

                const blob = audioResult.toBlob();
                const url = URL.createObjectURL(blob);
                
                currentAudio = new Audio(url);
                currentAudio.volume = settings.ttsVolume.value || 1;
                
                await currentAudio.play();
                
                await new Promise<void>((resolve) => {
                    currentAudio!.onended = () => {
                        if (currentAudio) {
                            URL.revokeObjectURL(currentAudio.src);
                            currentAudio = null;
                        }
                        resolve();
                    };
                });
            } catch (e: any) {
                console.error('[TTS] Error playing:', e);
            }
        }
        
        isProcessingQueue = false;
    };

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
            voices.value = kokoro.voices;
            console.log('[TTS] Kokoro engine ready, voices:', Object.keys(voices.value));
            
            if (messageQueue.length > 0) {
                console.log('[TTS] Processing queued messages...');
                processQueue();
            }
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

    const speak = async (text: string, params?: { username: string; platform: 'twitch' | 'kick' }) => {
        if (!isBrowser.value || !text || !settings.ttsEnabled.value) {
            console.log('[TTS] Not speaking:', { 
                browser: isBrowser.value, 
                hasText: !!text, 
                enabled: settings.ttsEnabled.value 
            });
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

        if (!isEngineReady.value || !kokoro) {
            console.log('[TTS] Engine not ready yet, queuing message...');
            messageQueue.push(text);
            return;
        }

        console.log('[TTS] Queuing:', text);
        
        messageQueue.push(text);
        
        processQueue();
    };

    const stop = () => {
        if (currentAudio) {
            currentAudio.pause();
            currentAudio = null;
        }
        messageQueue.length = 0;
        isProcessingQueue = false;
    };

    return {
        isSupported,
        isLoading,
        isEngineReady,
        engineError,
        voices,
        speak,
        stop,
    };
};
