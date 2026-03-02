import type { ChatMessage } from './useTwitchChat';

export interface MessagePart {
    type: 'text' | 'emote';
    content: string;
    url?: string;
}

export const useEmotes = () => {
    /**
     * Parses a Twitch message using its IRC emotes tag.
     * Emotes tag format: id:start-end,start-end/id2:start-end
     */
    const parseTwitchEmotes = (text: string, emotesTag?: string): MessagePart[] => {
        if (!emotesTag) return [{ type: 'text', content: text }];

        const emotePositions: { id: string; start: number; end: number }[] = [];
        const emotes = emotesTag.split('/');

        for (const emote of emotes) {
            const [id, positions] = emote.split(':');
            if (!id || !positions) continue;

            const ranges = positions.split(',');
            for (const range of ranges) {
                const parts = range.split('-');
                if (parts.length !== 2) continue;
                const start = Number(parts[0]);
                const end = Number(parts[1]);
                if (!isNaN(start) && !isNaN(end)) {
                    emotePositions.push({ id, start, end });
                }
            }
        }

        // Sort by start position
        emotePositions.sort((a, b) => a.start - b.start);

        const parts: MessagePart[] = [];
        let lastIndex = 0;

        for (const pos of emotePositions) {
            // Add text before the emote
            if (pos.start > lastIndex) {
                parts.push({
                    type: 'text',
                    content: text.slice(lastIndex, pos.start)
                });
            }

            // Add the emote
            const emoteText = text.slice(pos.start, pos.end + 1);
            parts.push({
                type: 'emote',
                content: emoteText,
                url: `https://static-cdn.jtvnw.net/emoticons/v2/${pos.id}/default/dark/1.0`
            });

            lastIndex = pos.end + 1;
        }

        // Add remaining text
        if (lastIndex < text.length) {
            parts.push({
                type: 'text',
                content: text.slice(lastIndex)
            });
        }

        return parts;
    };

    /**
     * Parses a Kick message for [emote:id:name] patterns.
     */
    const parseKickEmotes = (text: string): MessagePart[] => {
        const regex = /\[emote:(\d+):([^\]]+)\]/g;
        const parts: MessagePart[] = [];
        let lastIndex = 0;
        let match;

        while ((match = regex.exec(text)) !== null) {
            const fullMatch = match[0];
            const id = match[1];
            const name = match[2];
            const index = match.index;

            if (!id || !name) continue;

            // Add text before the emote
            if (index > lastIndex) {
                parts.push({
                    type: 'text',
                    content: text.slice(lastIndex, index)
                });
            }

            // Add the emote
            parts.push({
                type: 'emote',
                content: name,
                url: `https://files.kick.com/emotes/${id}/full`
            });

            lastIndex = index + fullMatch.length;
        }

        // Add remaining text
        if (lastIndex < text.length) {
            parts.push({
                type: 'text',
                content: text.slice(lastIndex)
            });
        }

        return parts.length > 0 ? parts : [{ type: 'text', content: text }];
    };

    /**
     * Unified function to get message parts.
     */
    const getMessageParts = (msg: ChatMessage): MessagePart[] => {
        if (msg.platform === 'twitch') {
            return parseTwitchEmotes(msg.message, msg.emotes);
        } else {
            return parseKickEmotes(msg.message);
        }
    };

    /**
     * Returns a version of the message text without emotes for TTS.
     */
    const getCleanText = (msg: ChatMessage): string => {
        const parts = getMessageParts(msg);
        return parts
            .filter(p => p.type === 'text')
            .map(p => p.content.trim())
            .filter(Boolean)
            .join(' ');
    };

    return {
        parseTwitchEmotes,
        parseKickEmotes,
        getMessageParts,
        getCleanText
    };
};
