import { ref } from 'vue';
import type { TTSEngineInterface, TTSVoice } from '../types';

export const createBrowserEngine = (
    getVolume: () => number,
    getVoice: () => string,
    getRate: () => number,
    getPitch: () => number
): TTSEngineInterface => {
    const isReady = ref(false);
    const isLoading = ref(false);
    const error = ref<string | null>(null);
    const voices = ref<Record<string, TTSVoice>>({});

    let synth: SpeechSynthesis | null = null;
    let currentUtterance: SpeechSynthesisUtterance | null = null;

    const loadVoices = (): Promise<SpeechSynthesisVoice[]> => {
        return new Promise((resolve) => {
            if (!synth) return resolve([]);

            let voiceList = synth.getVoices();
            if (voiceList.length > 0) {
                resolve(voiceList);
                return;
            }

            const onVoicesChanged = () => {
                voiceList = synth?.getVoices() || [];
                resolve(voiceList);
                synth?.removeEventListener('voiceschanged', onVoicesChanged);
            };

            synth.addEventListener('voiceschanged', onVoicesChanged);

            setTimeout(() => {
                synth?.removeEventListener('voiceschanged', onVoicesChanged);
                resolve(synth?.getVoices() || []);
            }, 3000);
        });
    };

    const init = async () => {
        if (typeof window === 'undefined') return;

        isLoading.value = true;
        error.value = null;

        try {
            if (!('speechSynthesis' in window)) {
                throw new Error('Speech Synthesis not supported');
            }

            synth = window.speechSynthesis;

            const voiceList = await loadVoices();

            const voiceMap: Record<string, TTSVoice> = {};
            voiceList.forEach((voice) => {
                const id = voice.voiceURI;
                voiceMap[id] = {
                    id,
                    name: voice.name,
                    lang: voice.lang,
                    localService: voice.localService,
                };
            });

            voices.value = voiceMap;
            isReady.value = true;

            console.log('[TTS Browser] Engine ready, voices:', Object.keys(voiceMap).length);
        } catch (e: any) {
            console.error('[TTS Browser] Init failed:', e);
            error.value = e.message || 'Failed to initialize browser TTS';
            isReady.value = false;
        }

        isLoading.value = false;
    };

    const speak = async (text: string) => {
        if (!synth || !isReady.value) {
            console.log('[TTS Browser] Not ready');
            return;
        }

        return new Promise<void>((resolve) => {
            const utterance = new SpeechSynthesisUtterance(text);

            const selectedVoiceId = getVoice();
            if (selectedVoiceId && voices.value[selectedVoiceId] && synth) {
                const voice = synth.getVoices().find(v => v.voiceURI === selectedVoiceId);
                if (voice) utterance.voice = voice;
            } else if (synth && synth.getVoices().length > 0) {
                const voice = synth.getVoices()[0];
                if (voice) utterance.voice = voice;
            }

            utterance.volume = getVolume();
            utterance.rate = getRate();
            utterance.pitch = getPitch();

            currentUtterance = utterance;

            utterance.onend = () => {
                currentUtterance = null;
                resolve();
            };
            utterance.onerror = (e) => {
                console.error('[TTS Browser] Error:', e);
                resolve();
            };

            synth.speak(utterance);
        });
    };

    const stop = () => {
        if (synth && synth.speaking) {
            synth.cancel();
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
        setVolume: (v: number) => { if (currentUtterance) currentUtterance.volume = v; },
    };
};
