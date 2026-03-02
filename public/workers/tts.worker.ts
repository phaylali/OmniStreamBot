let kokoro = null;
let isInitialized = false;

self.onmessage = async (event) => {
    const { type, data } = event.data;

    switch (type) {
        case 'init':
            try {
                const { KokoroTTS } = await import('kokoro-js');
                kokoro = await KokoroTTS.from_pretrained('onnx-community/Kokoro-82M-ONNX', {
                    dtype: 'q8',
                    device: 'wasm',
                });
                isInitialized = true;
                self.postMessage({ type: 'init-success', voices: kokoro.voices });
            } catch (e) {
                self.postMessage({ type: 'init-error', error: e.message });
            }
            break;

        case 'generate':
            if (!isInitialized || !kokoro) {
                self.postMessage({ type: 'generate-error', error: 'Not initialized' });
                return;
            }

            try {
                const audioResult = await kokoro.generate(data.text, {
                    voice: data.voice || 'af_sarah',
                });
                
                const blob = audioResult.toBlob();
                self.postMessage({ 
                    type: 'generate-success', 
                    blob: blob,
                    id: data.id 
                }, [blob]);
            } catch (e) {
                self.postMessage({ type: 'generate-error', error: e.message, id: data.id });
            }
            break;

        case 'stop':
            kokoro = null;
            isInitialized = false;
            self.postMessage({ type: 'stopped' });
            break;
    }
};
