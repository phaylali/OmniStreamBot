import { settingsService } from "../../services/settings";
import { twitchService } from "../../services/twitch";
import { kickService } from "../../services/kick";
import { ttsService } from "../../services/tts";
import { streamingService } from "../../services/streaming";
import type { ChatMessage } from "../../lib/types";

console.log('[Omniversify] View starting...');

// DOM elements
const mainEl = document.getElementById('main') as HTMLElement;
const chatPanel = document.getElementById('chat-panel') as HTMLElement;
const streamPanel = document.getElementById('stream-panel') as HTMLElement;
const chatEl = document.getElementById('chat') as HTMLElement;

// Controls
const twIn = document.getElementById('tw') as HTMLInputElement;
const kwIn = document.getElementById('kw') as HTMLInputElement;
const ttsEn = document.getElementById('tts-en') as HTMLInputElement;
const ttsEng = document.getElementById('tts-eng') as HTMLSelectElement;
const ttsTest = document.getElementById('tts-test') as HTMLButtonElement;
const showLists = document.getElementById('show-lists') as HTMLButtonElement;
const listsPanel = document.getElementById('lists-panel') as HTMLElement;

// Block/Allow Lists
const blEn = document.getElementById('bl-en') as HTMLInputElement;
const alEn = document.getElementById('al-en') as HTMLInputElement;
const blIn = document.getElementById('bl-in') as HTMLInputElement;
const alIn = document.getElementById('al-in') as HTMLInputElement;
const blAdd = document.getElementById('bl-add') as HTMLButtonElement;
const alAdd = document.getElementById('al-add') as HTMLButtonElement;

// Initialization
mainEl.style.display = 'flex';
chatPanel.style.display = 'flex';
streamPanel.style.display = 'none';

// Load initial settings
const initialSettings = settingsService.get();
twIn.value = initialSettings.twitchUsername || '';
kwIn.value = initialSettings.kickUsername || '';
ttsEn.checked = initialSettings.ttsEnabled;
ttsEng.value = initialSettings.ttsEngine;
blEn.checked = initialSettings.blocklistEnabled;
alEn.checked = initialSettings.allowlistEnabled;

// Resume audio context on first user interaction (required for WebKitGTK)
const resumeAudioContext = () => {
    const ac = (window as any).audioContext || new AudioContext();
    if (ac.state === 'suspended') {
        ac.resume().then(() => console.log('[Audio] Context resumed'));
    }
    document.removeEventListener('click', resumeAudioContext);
    document.removeEventListener('keydown', resumeAudioContext);
};
document.addEventListener('click', resumeAudioContext);
document.addEventListener('keydown', resumeAudioContext);
console.log('[Audio] Waiting for user interaction to enable audio');

// Removed Piper WASM init logic

// Fix: reliable voice loading (WebKit specific)
const loadVoices = () => {
    const v = ttsService.getVoices();
    console.log('[TTS] Available voices:', v.length);
};
if (typeof speechSynthesis !== 'undefined') {
    speechSynthesis.onvoiceschanged = loadVoices;
    loadVoices();
}

// Throttled TTS Queue with Debug UI
let ttsQueue: string[] = [];
let ttsProcessing = false;
let ttsProcessed = 0;
let ttsFailed = 0;
let ttsStuckCount = 0;
const MAX_QUEUE = 20;
const TTS_WATCHDOG_MS = 120000; // 120s for LuxTTS CPU generation

// Create TTS status indicator
const createTTSStatus = () => {
    const status = document.createElement('div');
    status.id = 'tts-status';
    status.style.cssText = 'position:fixed;bottom:10px;right:10px;background:rgba(0,0,0,0.8);color:#22c55e;padding:8px 12px;border-radius:6px;font-size:11px;z-index:1001;display:none;';
    status.innerHTML = 'TTS: Idle | Queue: 0 | Processed: 0';
    document.body.appendChild(status);
    return status;
};
const ttsStatusEl = createTTSStatus();

const updateTTSStatus = () => {
    const settings = settingsService.get();
    if (settings.ttsEnabled) {
        ttsStatusEl.style.display = 'block';
        const queueText = ttsQueue.length > 0 ? `Queue: ${ttsQueue.length}` : 'Queue: idle';
        const engine = settings.ttsEngine.toUpperCase();
        ttsStatusEl.innerHTML = `${engine} ${ttsProcessing ? '🔊' : '⏸️'} ${queueText} | ✅${ttsProcessed} ❌${ttsFailed}`;
        if (ttsStuckCount > 0) ttsStatusEl.innerHTML += ` | STUCK: ${ttsStuckCount}`;
    } else {
        ttsStatusEl.style.display = 'none';
    }
};

// Auto-recovery watchdog - detects stuck TTS
let lastProgressTime = Date.now();
let watchdogInterval: number | null = null;

const startWatchdog = () => {
    if (watchdogInterval) return;
    watchdogInterval = window.setInterval(() => {
        const elapsed = Date.now() - lastProgressTime;
        const settings = settingsService.get();
        const isLuxOrSoprano = settings.ttsEngine === 'lux' || settings.ttsEngine === 'soprano';
        const timeout = isLuxOrSoprano ? 120000 : 60000; // Longer timeout for Lux/Soprano on CPU
        
        if (ttsProcessing && elapsed > timeout) {
            ttsStuckCount++;
            console.warn(`[TTS] ⚠️ Watchdog: TTS appears stuck! (${elapsed/1000}s elapsed)`);
            ttsService.cancel(); // Cancel current speech
            ttsProcessing = false;
            updateTTSStatus();
            processQueue(); // Resume queue
        }
    }, 15000); // Check every 15s
};

const stopWatchdog = () => {
    if (watchdogInterval) {
        clearInterval(watchdogInterval);
        watchdogInterval = null;
    }
};

setInterval(updateTTSStatus, 300);

const processQueue = async () => {
    if (ttsProcessing) return;
    ttsProcessing = true;
    lastProgressTime = Date.now();
    startWatchdog();
    updateTTSStatus();

    while (ttsQueue.length > 0) {
        const text = ttsQueue.shift()!;
        console.log(`[TTS] Processing (${ttsQueue.length} remaining):`, text.substring(0, 40) + (text.length > 40 ? '...' : ''));
        updateTTSStatus();
        
        try {
            await ttsService.speak(text);
            ttsProcessed++;
            console.log(`[TTS] ✓ Completed (${ttsProcessed} total)`);
        } catch (e) {
            ttsFailed++;
            console.warn(`[TTS] ✗ Failed (${ttsFailed} total): ${e}`);
        }
        
        lastProgressTime = Date.now();
        updateTTSStatus();
        
        // Brief pause between messages
        await new Promise(r => setTimeout(r, 150));
    }

    ttsProcessing = false;
    stopWatchdog();
    updateTTSStatus();
};

const speak = (text: string) => {
    if (!settingsService.get().ttsEnabled) {
        console.log('[TTS] Disabled, skipping:', text.substring(0, 30));
        return;
    }
    if (ttsQueue.length >= MAX_QUEUE) {
        console.warn(`[TTS] ⚠️ Queue full (${MAX_QUEUE}), dropping message`);
        return;
    }
    ttsQueue.push(text);
    console.log(`[TTS] ➕ Queued (size: ${ttsQueue.length}):`, text.substring(0, 40));
    processQueue();
};

// Debug commands accessible via keyboard
window.addEventListener('keydown', (e) => {
    // Ctrl+T - Force TTS test
    if (e.ctrlKey && e.key === 't') {
        e.preventDefault();
        console.log('[TTS DEBUG] Manual test triggered');
        speak('This is a manual TTS test triggered by keyboard shortcut.');
    }
    // Ctrl+Shift+C - Clear TTS queue
    if (e.ctrlKey && e.shiftKey && e.key === 'C') {
        e.preventDefault();
        ttsQueue = [];
        ttsService.cancel();
        console.log('[TTS DEBUG] Queue cleared');
        updateTTSStatus();
    }
    // Ctrl+Shift+R - Reset TTS stats
    if (e.ctrlKey && e.shiftKey && e.key === 'R') {
        e.preventDefault();
        ttsProcessed = 0;
        ttsFailed = 0;
        console.log('[TTS DEBUG] Stats reset');
        updateTTSStatus();
    }
});

// Make debug functions available globally for both keyboard and CLI Bridge
(window as any).__ttsDebug = {
    getStatus: () => ({
        enabled: settingsService.get().ttsEnabled,
        engine: settingsService.get().ttsEngine,
        queueSize: ttsQueue.length,
        processing: ttsProcessing,
        processed: ttsProcessed,
        failed: ttsFailed
    }),
    testTTS: (text: string) => speak(text || 'Debug test'),
    clearQueue: () => { ttsQueue = []; ttsService.cancel(); updateTTSStatus(); },
    resetStats: () => { ttsProcessed = 0; ttsFailed = 0; updateTTSStatus(); }
};

// RPC Bridge Interface for Bun CLI
(window as any).omniDebug = {
    simulateChat: (data: {platform?: string, username?: string, message?: string}) => {
        console.log('[DEBUG] Simulating chat:', data);
        const msg: ChatMessage = {
            id: 'debug-' + Math.random().toString(36).substring(2, 9),
            platform: (data.platform as any) || 'twitch',
            username: data.username || 'DebugUser',
            message: data.message || 'This is a simulated debug message.',
            timestamp: Date.now(),
            color: '#6366f1'
        };
        addChat(msg);
    },
    testTTS: (text: string) => (window as any).__ttsDebug.testTTS(text),
    clearQueue: () => (window as any).__ttsDebug.clearQueue(),
    getStatus: () => (window as any).__ttsDebug.getStatus()
};

console.log('[TTS] Debug API available: window.omniDebug & window.__ttsDebug');


// Tabs
document.querySelectorAll('.tab').forEach(t => {
    const button = t as HTMLButtonElement;
    button.onclick = () => {
        document.querySelectorAll('.tab').forEach(x => x.classList.remove('active'));
        button.classList.add('active');
        const tab = button.dataset.tab as 'chat' | 'stream';
        chatPanel.style.display = tab === 'chat' ? 'flex' : 'none';
        streamPanel.style.display = tab === 'stream' ? 'flex' : 'none';
        streamPanel.classList.toggle('active', tab === 'stream');
    };
});

// Emote parser
const parseEmotes = (text: string, emotes: string) => {
    if (!emotes) return text;
    const parts = emotes.split('/');
    const reps: {s: number, e: number, id: string}[] = [];
    for (const part of parts) {
        const [id, pos] = part.split(':');
        if (!id || !pos) continue;
        for (const r of pos.split(',')) {
            const [s, e] = r.split('-').map(Number);
            if (!isNaN(s) && !isNaN(e)) reps.push({s, e, id});
        }
    }
    reps.sort((a, b) => b.s - a.s);
    let res = text;
    for (const r of reps) {
        const img = `<img src="https://static-cdn.jtvnw.net/emoticons/v2/${r.id}/default/dark/3.0" style="vertical-align:middle;height:28px;">`;
        res = res.slice(0, r.s) + img + res.slice(r.e + 1);
    }
    return res;
};

const getCleanText = (msg: ChatMessage) => {
    let text = msg.message;
    
    // 1. Strip Kick emotes: [emote:123:name]
    text = text.replace(/\[emote:\d+:[^\]]+\]/g, '');
    
    // 2. Strip Twitch emotes using their indices
    if (msg.platform === 'twitch' && msg.emotes) {
        const parts = msg.emotes.split('/');
        const reps: {s: number, e: number}[] = [];
        for (const part of parts) {
            const [, pos] = part.split(':');
            if (!pos) continue;
            for (const r of pos.split(',')) {
                const [s, e] = r.split('-').map(Number);
                if (!isNaN(s) && !isNaN(e)) reps.push({s, e});
            }
        }
        reps.sort((a, b) => b.s - a.s);
        let cleanText = msg.message;
        for (const r of reps) {
            cleanText = cleanText.slice(0, r.s) + cleanText.slice(r.e + 1);
        }
        text = cleanText;
    }
    
    // 3. Strip standard Unicode emojis
    // This regex covers most emoji ranges
    text = text.replace(/([\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF])/g, '');
    
    return text.trim();
};

// Chat rendering
const addChat = (msg: ChatMessage) => {
    const d = document.createElement('div');
    d.className = 'msg';
    const c = msg.color || (msg.platform === 'twitch' ? '#9146ff' : '#53fc18');
    const txt = msg.platform === 'twitch' && msg.emotes ? parseEmotes(msg.message, msg.emotes) : msg.message;
    
    // Platform badge
    const badge = document.createElement('span');
    badge.className = `plat ${msg.platform}`;
    badge.textContent = msg.platform;
    
    // User
    const user = document.createElement('span');
    user.className = 'user';
    user.style.color = c;
    user.textContent = msg.username + ':';
    user.onclick = (e) => showUserMenu(e, msg.username, msg.platform);
    
    // Text
    const content = document.createElement('span');
    content.innerHTML = txt;
    
    d.appendChild(badge);
    d.appendChild(user);
    d.appendChild(content);
    
    chatEl.appendChild(d);
    chatEl.scrollTop = chatEl.scrollHeight;

    // TTS Logic
    const settings = settingsService.get();
    if (settings.ttsEnabled) {
        let shouldSpeak = false;
        if (!settings.blocklistEnabled && !settings.allowlistEnabled) shouldSpeak = true;
        else if (settings.allowlistEnabled && settings.allowlist.find(u => u.username === msg.username && u.platform === msg.platform)) shouldSpeak = true;
        else if (settings.blocklistEnabled && !settings.blocklist.find(u => u.username === msg.username && u.platform === msg.platform)) shouldSpeak = true;
        
        if (shouldSpeak) {
            const cleanText = getCleanText(msg);
            if (cleanText) speak(cleanText);
        }
    }
};

// User Menu
const showUserMenu = (e: MouseEvent, username: string, platform: string) => {
    e.stopPropagation();
    const existing = document.getElementById('user-menu');
    if (existing) existing.remove();

    const menu = document.createElement('div');
    menu.id = 'user-menu';
    menu.style.cssText = `position:fixed;left:${e.clientX}px;top:${e.clientY}px;background:#1a1a24;border:1px solid #334155;border-radius:8px;padding:12px;z-index:1000;min-width:180px;box-shadow:0 4px 12px rgba(0,0,0,0.5);`;
    menu.innerHTML = `<div style="font-weight:600;margin-bottom:10px;font-size:15px;">${username}<span style="font-size:11px;color:#94a3b8;margin-left:6px;">(${platform})</span></div>` +
        `<button id="btn-block" style="width:100%;padding:8px;margin-bottom:6px;background:#ef4444;border:none;border-radius:6px;color:white;cursor:pointer;font-size:13px;">Block User</button>` +
        `<button id="btn-allow" style="width:100%;padding:8px;background:#22c55e;border:none;border-radius:6px;color:white;cursor:pointer;font-size:13px;">Allow User</button>`;
    document.body.appendChild(menu);

    (menu.querySelector('#btn-block') as HTMLElement).onclick = () => {
        addToList(username, platform, 'block');
        menu.remove();
    };
    (menu.querySelector('#btn-allow') as HTMLElement).onclick = () => {
        addToList(username, platform, 'allow');
        menu.remove();
    };

    setTimeout(() => {
        const close = () => {
            menu.remove();
            document.removeEventListener('click', close);
        };
        document.addEventListener('click', close);
    }, 100);
};

const addToList = (user: string, platform: string, list: 'block' | 'allow') => {
    const set = settingsService.get();
    if (list === 'block') {
        if (!set.blocklist.find(u => u.username === user && u.platform === platform)) {
            settingsService.set({ blocklist: [...set.blocklist, { username: user, platform }] });
        }
    } else {
        if (!set.allowlist.find(u => u.username === user && u.platform === platform)) {
            settingsService.set({ allowlist: [...set.allowlist, { username: user, platform }] });
        }
    }
    updateListsUI();
};

const updateListsUI = () => {
    const settings = settingsService.get();
    const blItems = document.getElementById('bl-items') as HTMLElement;
    const alItems = document.getElementById('al-items') as HTMLElement;
    
    (document.getElementById('bcnt') as HTMLElement).textContent = `(${settings.blocklist.length})`;
    (document.getElementById('acnt') as HTMLElement).textContent = `(${settings.allowlist.length})`;
    
    blItems.innerHTML = settings.blocklist.map(u => `<div>${u.username} (${u.platform}) <button data-u="${u.username}" data-p="${u.platform}" class="rem-bl" style="background:none;border:none;color:#ef4444;cursor:pointer;">x</button></div>`).join('') || '<div style="color:#94a3b8">Empty</div>';
    alItems.innerHTML = settings.allowlist.map(u => `<div>${u.username} (${u.platform}) <button data-u="${u.username}" data-p="${u.platform}" class="rem-al" style="background:none;border:none;color:#ef4444;cursor:pointer;">x</button></div>`).join('') || '<div style="color:#94a3b8">Empty</div>';
    
    blItems.querySelectorAll('.rem-bl').forEach(b => (b as HTMLElement).onclick = () => {
        const s = settingsService.get();
        const u = (b as HTMLElement).dataset.u;
        const p = (b as HTMLElement).dataset.p;
        settingsService.set({ blocklist: s.blocklist.filter(x => !(x.username === u && x.platform === p)) });
        updateListsUI();
    });
    alItems.querySelectorAll('.rem-al').forEach(b => (b as HTMLElement).onclick = () => {
        const s = settingsService.get();
        const u = (b as HTMLElement).dataset.u;
        const p = (b as HTMLElement).dataset.p;
        settingsService.set({ allowlist: s.allowlist.filter(x => !(x.username === u && x.platform === p)) });
        updateListsUI();
    });
};

// Event Handlers
twIn.onchange = () => {
    settingsService.set({ twitchUsername: twIn.value });
    twitchService.connect(twIn.value, addChat);
};
kwIn.onchange = () => {
    settingsService.set({ kickUsername: kwIn.value });
    kickService.connect(kwIn.value, addChat);
};
ttsEn.onchange = () => settingsService.set({ ttsEnabled: ttsEn.checked });
ttsEng.onchange = () => {
    settingsService.set({ ttsEngine: ttsEng.value as any });
    ttsService.setEngine(ttsEng.value as any);
};
ttsTest.onclick = () => speak('This is a test of the Omniversify Studio speech system.');

showLists.onclick = () => {
    listsPanel.style.display = listsPanel.style.display === 'none' ? 'block' : 'none';
};

blEn.onchange = () => {
    if (blEn.checked) {
        alEn.checked = false;
        settingsService.set({ allowlistEnabled: false });
    }
    settingsService.set({ blocklistEnabled: blEn.checked });
};
alEn.onchange = () => {
    if (alEn.checked) {
        blEn.checked = false;
        settingsService.set({ blocklistEnabled: false });
    }
    settingsService.set({ allowlistEnabled: alEn.checked });
};

blAdd.onclick = () => {
    const u = blIn.value.trim();
    if (u) {
        addToList(u, (document.getElementById('bl-pl') as HTMLSelectElement).value, 'block');
        blIn.value = '';
    }
};
alAdd.onclick = () => {
    const u = alIn.value.trim();
    if (u) {
        addToList(u, (document.getElementById('al-pl') as HTMLSelectElement).value, 'allow');
        alIn.value = '';
    }
};

// Initialize connections if data exists
if (twIn.value) twitchService.connect(twIn.value, addChat);
if (kwIn.value) kickService.connect(kwIn.value, addChat);
updateListsUI();

// Streaming integration
const startStreamBtn = document.getElementById('start-stream') as HTMLButtonElement;
startStreamBtn.onclick = () => {
    if (streamingService.getStatus().isStreaming) {
        streamingService.stopStream();
        startStreamBtn.textContent = 'Go Live';
        startStreamBtn.classList.remove('live');
    } else {
        streamingService.init(960, 540);
        streamingService.startStream('dummy_key', 'dummy_key');
        startStreamBtn.textContent = 'End Stream';
        startStreamBtn.classList.add('live');
    }
};

console.log('[Omniversify] Ready');