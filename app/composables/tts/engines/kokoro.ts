import { ref } from 'vue';
import type { TTSEngineInterface, TTSVoice } from '../types';
import { KokoroTTS } from 'kokoro-js';

let kokoroInstance: KokoroTTS | null = null;

export const createKokoroEngine = (
    getVolume: () => number,
    getVoice: () => string
): TTSEngineInterface => {
    const isReady = ref(false);
    const isLoading = ref(false);
    const error = ref<string | null>(null);
    const voices = ref<Record<string, TTSVoice>>({});

    let currentAudio: HTMLAudioElement | null = null;
    let singleLock: Promise<void> = Promise.resolve();

    const init = async () => {
        if (typeof window === 'undefined') return;

        isLoading.value = true;
        error.value = null;

        try {
            console.log('[TTS Kokoro] Loading model...');

            // Try to load from local models folder first
            const localPath = '/models/kokoro/';

            try {
                kokoroInstance = await KokoroTTS.from_pretrained(localPath, {
                    dtype: 'q8',
                    device: 'wasm',
                });
                console.log('[TTS Kokoro] Loaded from local models folder');
            } catch (localError) {
                console.log('[TTS Kokoro] Local models not found, downloading from HuggingFace...');
                // Fall back to downloading from HuggingFace
                kokoroInstance = await KokoroTTS.from_pretrained('onnx-community/Kokoro-82M-ONNX', {
                    dtype: 'q8',
                    device: 'wasm',
                });
                console.log('[TTS Kokoro] Downloaded from HuggingFace');
            }

            const voiceMap: Record<string, TTSVoice> = {};
            if (kokoroInstance.voices) {
                Object.entries(kokoroInstance.voices).forEach(([key, voice]: [string, any]) => {
                    voiceMap[key] = {
                        id: key,
                        name: voice.name || key,
                        lang: voice.lang,
                    };
                });
            }

            voices.value = voiceMap;
            isReady.value = true;

            console.log('[TTS Kokoro] Engine ready, voices:', Object.keys(voiceMap).length);
        } catch (e: any) {
            console.error('[TTS Kokoro] Init failed:', e);
            error.value = e.message || 'Failed to load Kokoro TTS engine';
            isReady.value = false;
        }

        isLoading.value = false;
    };

    const speak = async (text: string) => {
        if (!kokoroInstance || !isReady.value) {
            console.log('[TTS Kokoro] Not ready');
            return;
        }

        const previousLock = singleLock;
        let resolveLock: () => void;
        singleLock = new Promise<void>((res) => { resolveLock = res; });

        return new Promise<void>(async (resolve) => {
            await previousLock;

            try {
                const audioResult = await kokoroInstance!.generate(text, {
                    voice: getVoice() || 'af_sarah',
                });

                if (!audioResult) {
                    resolve();
                    return;
                }

                const blob = audioResult.toBlob();
                const url = URL.createObjectURL(blob);

                currentAudio = new Audio(url);
                currentAudio.volume = getVolume();

                currentAudio.onended = () => {
                    if (currentAudio) {
                        URL.revokeObjectURL(currentAudio.src);
                        currentAudio.remove(); // Remove from DOM
                        currentAudio = null;
                    }
                    resolve();
                    resolveLock();
                };

                currentAudio.onerror = () => {
                    if (currentAudio) {
                        URL.revokeObjectURL(currentAudio.src);
                        currentAudio.remove(); // Remove from DOM
                        currentAudio = null;
                    }
                    resolve();
                    resolveLock();
                };

                // Append to DOM to prevent aggressive GC/optimization
                currentAudio.style.display = 'none';
                document.body.appendChild(currentAudio);

                await currentAudio.play();
            } catch (e: any) {
                console.error('[TTS Kokoro] Speak error:', e);
                resolve();
                resolveLock();
            }
        });
    };

    const stop = () => {
        if (currentAudio) {
            currentAudio.pause();
            currentAudio = null;
        }
        if (kokoroInstance) {
            kokoroInstance = null;
        }
    };

    return {
        get isReady() { return isReady.value; },
        get isLoading() { return isLoading.value; },
        get error() { return error.value; },
        get voices() { return voices.value; },
        init,
        speak,
        stop,
        setVolume: (v: number) => { if (currentAudio) currentAudio.volume = v; },
    };
};
