export default defineEventHandler(async (event) => {
    const channel = getRouterParam(event, 'channel');

    if (!channel) {
        throw createError({ statusCode: 400, message: 'Channel is required' });
    }

    const proxies = [
        `https://api.allorigins.win/get?url=${encodeURIComponent(`https://kick.com/api/v1/channels/${channel}`)}`,
        `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(`https://kick.com/api/v1/channels/${channel}`)}`,
    ];

    let lastError: any = null;

    for (const proxyUrl of proxies) {
        try {
            const response = await fetch(proxyUrl, {
                headers: {
                    'Accept': 'application/json',
                }
            });

            if (!response.ok) {
                continue;
            }

            const wrapper = await response.json();
            
            if (!wrapper.contents) {
                continue;
            }
            
            const data = JSON.parse(wrapper.contents);
            
            if (!data.chatroom?.id) {
                throw createError({ statusCode: 404, message: 'Channel not found or has no chatroom' });
            }
            
            return {
                chatroomId: data.chatroom.id
            };
        } catch (error: any) {
            lastError = error;
            console.log('[Kick API] Proxy failed, trying next...');
            continue;
        }
    }

    console.error('[Kick API] All proxies failed:', lastError);
    throw createError({ statusCode: 500, message: lastError?.message || 'Failed to fetch channel info from all proxies' });
});
