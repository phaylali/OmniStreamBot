import { ref } from 'vue';
import type { TTSEngineInterface, TTSVoice } from '../types';

export const createServerPiperEngine = (
    getVolume: () => number,
    getVoice: () => string
): TTSEngineInterface => {
    const isReady = ref(true);
    const isLoading = ref(false);
    const error = ref<string | null>(null);
    const voices = ref<Record<string, TTSVoice>>({});
    const localVoices = ref<Record<string, TTSVoice>>({});

    let currentAudio: HTMLAudioElement | null = null;

    const init = async () => {
        if (typeof window === 'undefined') return;

        try {
            isLoading.value = true;
            const response = await fetch('http://localhost:3002/voices');
            if (response.ok) {
                const voiceList = await response.json();
                const voiceMap: Record<string, TTSVoice> = {};
                voiceList.forEach((v: any) => {
                    voiceMap[v.id] = v;
                });
                voices.value = voiceMap;
                isReady.value = true;
            } else {
                throw new Error('Failed to fetch voices');
            }
        } catch (e) {
            console.error('[TTS ServerPiper] Init failed:', e);
            error.value = 'Failed to connect to Python TTS server.';
            isReady.value = false;
        } finally {
            isLoading.value = false;
        }
    };

    const speak = async (text: string) => {
        return new Promise<void>(async (resolve) => {
            try {
                const voiceId = getVoice() || 'en_US-amy-low';

                const response = await fetch('http://localhost:3002/tts', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ text, voice: voiceId }),
                });

                if (!response.ok) {
                    throw new Error('Server TTS failed');
                }

                const blob = await response.blob();
                const url = URL.createObjectURL(blob);

                currentAudio = new Audio(url);
                currentAudio.volume = getVolume();

                await currentAudio.play();

                currentAudio.onended = () => {
                    if (currentAudio) {
                        URL.revokeObjectURL(currentAudio.src);
                        currentAudio = null;
                    }
                    resolve();
                };

                currentAudio.onerror = () => {
                    if (currentAudio) {
                        URL.revokeObjectURL(currentAudio.src);
                        currentAudio = null;
                    }
                    resolve();
                };
            } catch (e: any) {
                console.error('[TTS ServerPiper] Speak error:', e);
                error.value = 'Server TTS unavailable. Make sure Python TTS server is running.';
                resolve();
            }
        });
    };

    const stop = () => {
        if (currentAudio) {
            currentAudio.pause();
            currentAudio = null;
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
