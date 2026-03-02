import { defineEventHandler, readBody, createError, sendStream } from 'h3';
import { Readable } from 'node:stream';
import edgeTTS from 'node-edge-tts';

export default defineEventHandler(async (event) => {
    const body = await readBody(event);
    const { text, voice } = body;

    if (!text) {
        throw createError({
            statusCode: 400,
            message: 'Text is required',
        });
    }

    try {
        const audioBuffer = await edgeTTS.textToSpeech(text, voice || 'en-US-AriaNeural');
        
        event.node.res.setHeader('Content-Type', 'audio/mp3');
        event.node.res.setHeader('Content-Length', audioBuffer.length);
        
        return sendStream(event, Readable.from(audioBuffer));
    } catch (error: any) {
        throw createError({
            statusCode: 500,
            message: `TTS generation failed: ${error.message}`,
        });
    }
});
