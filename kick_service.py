from fastapi import FastAPI, HTTPException
from kickapi.kickapi import KickAPI
import uvicorn
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("kick-bridge")

app = FastAPI(title="Kick Bridge Service")
kick = KickAPI()

@app.get("/chatroom/{username}")
async def get_chatroom(username: str):
    logger.info(f"Fetching chatroom for channel: {username}")
    try:
        # We use the internal session of KickAPI because it handles Cloudflare via cloudscraper
        url = f"https://kick.com/api/v1/channels/{username}"
        response = kick.session.get(url, headers=kick.headers)
        
        if response.status_code == 403:
            logger.error(f"Cloudflare block (403) for {username}")
            raise HTTPException(status_code=403, detail="Blocked by Cloudflare")
            
        if response.status_code != 200:
            logger.error(f"Failed to fetch channel {username}: {response.status_code}")
            raise HTTPException(status_code=response.status_code, detail=f"Kick API error: {response.status_code}")
        
        data = response.json()
        chatroom_id = data.get("chatroom", {}).get("id")
        
        if not chatroom_id:
            logger.warning(f"No chatroom found for {username}")
            raise HTTPException(status_code=404, detail="Chatroom not found")
            
        return {"chatroomId": chatroom_id}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Unexpected error fetching chatroom for {username}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=3003)
