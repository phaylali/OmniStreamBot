export default defineEventHandler(async (event) => {
    const channel = getRouterParam(event, 'channel');

    if (!channel) {
        throw createError({ statusCode: 400, message: 'Channel is required' });
    }

    try {
        console.log(`[Kick API] Redirecting to local Python bridge for ${channel}`);
        // Fetch from our specialized Python bridge that handles Cloudflare
        const response = await fetch(`http://localhost:3003/chatroom/${channel}`);

        if (response.status === 403) {
            throw createError({
                statusCode: 403,
                message: 'Kick connection blocked by Cloudflare. Please solve the captcha in your browser at kick.com first.'
            });
        }

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }));
            throw createError({
                statusCode: response.status,
                message: errorData.detail || 'Failed to fetch from Kick bridge'
            });
        }

        const data = await response.json();
        return {
            chatroomId: data.chatroomId
        };
    } catch (error: any) {
        console.error('[Kick API] Local bridge failed:', error);
        throw createError({
            statusCode: error.statusCode || 500,
            message: error.message || 'Failed to connect to Kick bridge service'
        });
    }
});
