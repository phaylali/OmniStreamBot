import { defineEventHandler, readBody, createError, sendStream } from 'h3';
import { Readable } from 'node:stream';
import googleTTS from 'google-translate-api-x';

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
        const audioBuffer = await googleTTS(text, voice || 'en', {
            slow: false,
            cache: true,
        });
        
        event.node.res.setHeader('Content-Type', 'audio/mpeg');
        event.node.res.setHeader('Content-Length', audioBuffer.length);
        
        return sendStream(event, Readable.from(audioBuffer));
    } catch (error: any) {
        throw createError({
            statusCode: 500,
            message: `TTS generation failed: ${error.message}`,
        });
    }
});
