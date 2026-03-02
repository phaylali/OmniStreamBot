export type TTSEngine = 'browser' | 'kokoro' | 'serverPiper';

export interface TTSVoice {
    id: string;
    name: string;
    lang?: string;
    localService?: boolean;
}

export interface TTSEngineInterface {
    isReady: boolean;
    isLoading: boolean;
    error: string | null;
    voices: Record<string, TTSVoice>;
    init(): Promise<void>;
    speak(text: string): Promise<void>;
    stop(): void;
    setVolume?: (volume: number) => void;
}

export interface TTSMessage {
    id: string;
    text: string;
    timestamp: number;
}

export interface TTSWorkerMessage {
    type: 'generate' | 'init' | 'stop';
    text?: string;
    voice?: string;
}
