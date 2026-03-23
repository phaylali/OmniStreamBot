export default defineEventHandler(async (event) => {
    const query = getQuery(event);
    const channel = query.channel as string;

    if (!channel) {
        throw createError({ statusCode: 400, message: 'Channel is required' });
    }

    const TWITCH_CLIENT_ID = process.env.TWITCH_CLIENT_ID || ' YOUR_CLIENT_ID';
    const TWITCH_TOKEN = process.env.TWITCH_TOKEN || 'YOUR_TOKEN';

    try {
        const response = await fetch(
            `https://api.twitch.tv/helix/streams?user_login=${encodeURIComponent(channel)}`,
            {
                headers: {
                    'Client-ID': TWITCH_CLIENT_ID,
                    'Authorization': `Bearer ${TWITCH_TOKEN}`
                }
            }
        );

        if (!response.ok) {
            throw createError({
                statusCode: response.status,
                message: 'Failed to fetch from Twitch API'
            });
        }

        const data = await response.json();
        const stream = data.data?.[0];

        return {
            isLive: !!stream,
            channel: channel,
            title: stream?.title || null,
            game_name: stream?.game_name || null,
            viewer_count: stream?.viewer_count || 0,
            started_at: stream?.started_at || null
        };
    } catch (error: any) {
        console.error('[Twitch API] Error:', error);
        throw createError({
            statusCode: error.statusCode || 500,
            message: error.message || 'Failed to check Twitch stream status'
        });
    }
});
