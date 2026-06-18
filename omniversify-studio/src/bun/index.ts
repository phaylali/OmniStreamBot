import { BrowserWindow } from "electrobun/bun";

const mainWindow = new BrowserWindow({
  title: "OmniversifyStudio",
  url: "views://main/index.html",
  frame: {
    width: 1280,
    height: 800,
    x: 100,
    y: 100
  }
});

// --- Debug Bridge for AI/CLI Testing ---
const DEBUG_PORT = 9999;
Bun.serve({
    port: DEBUG_PORT,
    async fetch(req) {
        const url = new URL(req.url);
        
        try {
            // Helper to run JS and handle errors
            const runJS = async (code: string) => {
                const js = `
                    (function() {
                        if (window.omniDebug) {
                            return JSON.stringify(${code});
                        }
                        return '{"error":"DEBUG_NOT_READY"}';
                    })()
                `;
                // @ts-ignore
                await mainWindow.webview.executeJavascript(js);
                return { status: "Command sent to UI" };
            };

            // 1. Simulate Chat Message
            if (url.pathname === '/api/chat/simulate' && req.method === 'POST') {
                const body = await req.json();
                await runJS(`window.omniDebug.simulateChat(${JSON.stringify(body)})`);
                return new Response(JSON.stringify({ status: "Chat Simulated" }), { headers: { "Content-Type": "application/json" } });
            }
            
            // 2. Test TTS Message
            if (url.pathname === '/api/tts/test' && req.method === 'POST') {
                const body = await req.json();
                await runJS(`window.omniDebug.testTTS(${JSON.stringify(body.text || 'API test')})`);
                return new Response(JSON.stringify({ status: "TTS Test Triggered" }), { headers: { "Content-Type": "application/json" } });
            }
            
            // 3. Clear Queue
            if (url.pathname === '/api/tts/clear' && req.method === 'POST') {
                await runJS(`window.omniDebug.clearQueue()`);
                return new Response(JSON.stringify({ status: "Queue Cleared" }), { headers: { "Content-Type": "application/json" } });
            }

            // 4. Get Status
            if (url.pathname === '/api/tts/status' && req.method === 'GET') {
                const status = await runJS(`window.omniDebug.getStatus()`);
                return new Response(JSON.stringify(status), { headers: { "Content-Type": "application/json" } });
            }

            // 5. Get Logs
            if (url.pathname === '/api/logs' && req.method === 'GET') {
                const logs = await runJS(`(document.getElementById('log-content')?.innerText || '')`);
                return new Response(JSON.stringify({ logs }), { headers: { "Content-Type": "application/json" } });
            }

            // 6. Health Check
            if (url.pathname === '/health') {
                return new Response("OK");
            }

            return new Response(JSON.stringify({ message: "Debug Bridge API Active" }), { 
                headers: { "Content-Type": "application/json" },
                status: 200 
            });

        } catch (e: any) {
            return new Response(JSON.stringify({ error: e.message }), { 
                status: 500, 
                headers: { "Content-Type": "application/json" } 
            });
        }
    }
});

console.log("[OmniversifyStudio] Main window created at views://main/index.html");
console.log(`[DEBUG] RPC server active on port ${DEBUG_PORT} - use /simulate-chat for testing`);