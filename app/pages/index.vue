<template>
  <div class="flex h-screen w-screen bg-gray-900 text-gray-100 overflow-hidden dark">
    
    <!-- LEFT 20%: Chat Header & Messages -->
    <aside class="w-[20%] h-full flex flex-col border-r border-gray-700 bg-gray-900 overflow-y-auto shadow-2xl relative z-10">
      <header class="p-3 border-b border-gray-700 bg-gray-800 shrink-0 flex items-center justify-between">
        <h1 class="text-md font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-green-400">
          Chat
        </h1>
        <div class="flex items-center gap-2 text-xs font-medium">
          <span :class="twitch.isConnected.value ? 'text-green-400' : 'text-red-400'"><span class="w-1.5 h-1.5 inline-block rounded-full bg-current mr-1"></span> TW</span>
          <span :class="kick.isConnected.value ? 'text-green-400' : 'text-red-400'"><span class="w-1.5 h-1.5 inline-block rounded-full bg-current mr-1"></span> K</span>
        </div>
      </header>

      <div 
        ref="chatContainer"
        class="flex-1 p-3 overflow-y-auto flex flex-col gap-2 relative scroll-smooth text-sm"
      >
        <div v-if="messages.length === 0" class="text-gray-400 italic text-xs text-center mt-10">Messages appear here...</div>

        <div 
          v-for="msg in messages" 
          :key="msg.id"
          class="flex flex-col animate-fade-in p-1.5 rounded hover:bg-gray-800 transition-colors"
        >
          <div class="flex items-center gap-1.5 mb-1">
            <span 
              class="text-[10px] font-bold uppercase tracking-wider px-1 py-0.5 rounded"
              :class="msg.platform === 'twitch' ? 'bg-purple-600/20 text-purple-400' : 'bg-green-600/20 text-green-400'"
            >
              {{ msg.platform }}
            </span>
            <span 
              class="font-bold cursor-pointer hover:underline text-xs" 
              :style="{ color: msg.color }"
              @click="showUserPopup($event, msg.username, msg.platform)"
            >
              {{ msg.username }}
            </span>
          </div>
          <div class="text-gray-100 text-xs leading-relaxed whitespace-pre-wrap break-words flex flex-wrap items-center gap-x-1 min-h-[20px]">
            <template v-for="(part, idx) in emotes.getMessageParts(msg)" :key="idx">
              <span v-if="part.type === 'text'">{{ part.content }}</span>
              <img 
                v-else 
                :src="part.url" 
                :alt="part.content" 
                :title="part.content" 
                class="h-5 w-auto inline-block object-contain"
              />
            </template>
          </div>
        </div>
      </div>
    </aside>

    <!-- MIDDLE 60%: Stream Studio -->
    <main class="w-[60%] h-full flex flex-col bg-black">
      <StreamStudio 
        v-if="mounted" 
        :twitch-key="settings.streamTwitchKey.value"
        :kick-key="settings.streamKickKey.value"
      />

      <!-- User Action Popup -->
      <div 
        v-if="activeUserPopup" 
        class="fixed z-50 bg-gray-800 border border-gray-700 rounded-lg shadow-2xl p-3 min-w-[160px] animate-fade-in"
        :style="{ left: activeUserPopup.x + 'px', top: (activeUserPopup.y + 10) + 'px' }"
        @click.stop
      >
        <div class="flex items-center justify-between mb-3 border-b border-gray-700 pb-2">
          <span class="text-xs font-bold truncate pr-2" :class="activeUserPopup.platform === 'twitch' ? 'text-purple-400' : 'text-green-400'">
            {{ activeUserPopup.username }}
          </span>
          <button @click="closeUserPopup" class="text-gray-500 hover:text-gray-300">&times;</button>
        </div>
        <div class="flex flex-col gap-2">
          <button 
            @click="addToList('blocklist', activeUserPopup.username, activeUserPopup.platform)"
            class="w-full text-left px-2 py-1.5 text-xs bg-red-600/20 hover:bg-red-600/40 text-red-400 rounded transition-colors flex items-center gap-2"
          >
            <span class="w-2 h-2 rounded-full bg-red-500"></span> Block User
          </button>
          <button 
            @click="addToList('allowlist', activeUserPopup.username, activeUserPopup.platform)"
            class="w-full text-left px-2 py-1.5 text-xs bg-green-600/20 hover:bg-green-600/40 text-green-400 rounded transition-colors flex items-center gap-2"
          >
            <span class="w-2 h-2 rounded-full bg-green-500"></span> Allow User
          </button>
        </div>
      </div>

      <!-- System Info Bar -->
      <footer class="p-2 border-t border-gray-700 bg-gray-800/80 shrink-0 flex items-center justify-between text-xs">
        <div class="flex items-center gap-4">
          <span class="text-gray-400">
            <span class="text-blue-400 font-medium">CPU:</span> {{ sys.cpuCores.value || 1 }} cores
          </span>
          <span class="text-gray-400">
            <span class="text-purple-400 font-medium">RAM:</span> {{ sys.deviceMemory.value ? sys.deviceMemory.value + ' GB' : '?' }}
          </span>
          <span class="text-gray-400 hidden md:inline">
            <span class="text-green-400 font-medium">GPU:</span> {{ sys.gpuRenderer.value || '?' }}
          </span>
        </div>
        <div class="flex items-center gap-4">
          <span class="text-gray-400">
            <span class="text-yellow-400 font-medium">Net:</span> {{ sys.networkType.value || '?' }} ({{ sys.networkSpeed.value ? sys.networkSpeed.value + ' Mbps' : '?' }})
          </span>
        </div>
      </footer>
    </main>

      <!-- RIGHT 20%: Settings -->
    <aside class="w-[20%] h-full bg-gray-800 p-4 flex flex-col overflow-y-auto shadow-xl z-10">
      <h2 class="text-md font-semibold mb-4 flex items-center gap-2">
        <span class="text-gray-400">⚙️</span> Settings
      </h2>
      
      <div class="space-y-5 flex-1">
        <!-- Streaming Engine Keys -->
        <div class="space-y-3 pb-3 border-b border-gray-700">
          <h3 class="text-xs font-bold text-gray-400 uppercase tracking-wider">Stream Output</h3>
          <div class="space-y-1">
             <label class="block text-xs font-medium text-gray-300">Twitch Stream Key</label>
             <input v-model="settings.streamTwitchKey.value" type="password" class="w-full bg-gray-700 border border-gray-600 rounded p-1.5 text-white text-xs focus:outline-none focus:border-purple-500" placeholder="live_..." />
          </div>
          <div class="space-y-1">
             <label class="block text-xs font-medium text-gray-300">Kick Stream Key</label>
             <input v-model="settings.streamKickKey.value" type="password" class="w-full bg-gray-700 border border-gray-600 rounded p-1.5 text-white text-xs focus:outline-none focus:border-green-500" placeholder="sk_..." />
          </div>
        </div>

        <!-- Chat Logins -->
        <div class="space-y-3 pb-3 border-b border-gray-700">
          <h3 class="text-xs font-bold text-gray-400 uppercase tracking-wider">Chat Ingest</h3>
          <div class="space-y-1">
            <div class="flex justify-between items-center">
               <label class="block text-xs font-medium text-gray-300">Twitch Username</label>
               <button @click="twitch.connect()" v-if="settings.twitchUsername.value && !twitch.isConnected.value" class="text-[10px] text-purple-400 hover:text-purple-300">Connect</button>
               <button @click="twitch.disconnect()" v-else-if="twitch.isConnected.value" class="text-[10px] text-gray-400 hover:text-red-400">Disconnect</button>
            </div>
            <input v-model="settings.twitchUsername.value" type="text" class="w-full bg-gray-700 border border-gray-600 rounded p-1.5 text-white text-xs" />
          </div>
          <div class="space-y-1">
            <div class="flex justify-between items-center">
               <label class="block text-xs font-medium text-gray-300">Kick Username</label>
               <button @click="kick.connect()" v-if="settings.kickUsername.value && !kick.isConnected.value" class="text-[10px] text-green-400 hover:text-green-300">Connect</button>
               <button @click="kick.disconnect()" v-else-if="kick.isConnected.value" class="text-[10px] text-gray-400 hover:text-red-400">Disconnect</button>
            </div>
            <input v-model="settings.kickUsername.value" type="text" class="w-full bg-gray-700 border border-gray-600 rounded p-1.5 text-white text-xs" />
          </div>
        </div>

        <div class="space-y-4 pt-4 border-t border-gray-700">
          <label class="flex items-center gap-2 cursor-pointer">
            <input v-model="settings.ttsEnabled.value" type="checkbox" class="w-4 h-4 text-purple-600 bg-gray-700 border-gray-600 rounded focus:ring-purple-500 focus:ring-2">
            <span class="text-sm font-medium text-gray-300">Enable Text-to-Speech</span>
          </label>

          <div v-if="settings.ttsEnabled.value" class="space-y-4">
            <!-- Engine Selector -->
            <div class="space-y-2">
              <label class="block text-sm font-medium text-gray-300">TTS Engine</label>
              <select 
                v-model="settings.ttsEngine.value" 
                class="w-full bg-gray-700 border border-gray-600 rounded p-2 text-white focus:outline-none focus:border-purple-500 transition-colors"
                @change="tts.switchEngine(settings.ttsEngine.value)"
              >
                <option value="browser">Browser (Local, No Download)</option>
                <option value="serverPiper">Server Piper (Local, Dynamic Voices)</option>
                <option value="kokoro">Kokoro (Browser, Neural)</option>
              </select>
              <p class="text-xs text-gray-500">
                {{ 
                  settings.ttsEngine.value === 'browser' ? 'Uses system voices - no download needed' : 
                  settings.ttsEngine.value === 'serverPiper' ? 'Runs locally via Python - syncs with models/piper/ folder' :
                  'Downloads ~93MB neural model on first use' 
                }}
              </p>
            </div>

            <!-- Kokoro Voice Selection -->
            <div v-if="settings.ttsEngine.value === 'kokoro'" class="space-y-2">
              <label class="block text-sm font-medium text-gray-300">Voice</label>
              <select v-model="settings.selectedVoice.value" class="w-full bg-gray-700 border border-gray-600 rounded p-2 text-white focus:outline-none focus:border-purple-500 transition-colors">
                <option v-for="(voice, key) in tts.voices.value" :key="key" :value="key">
                  {{ voice.name }}
                </option>
              </select>
            </div>

            <!-- Browser Voice Selection -->
            <div v-if="settings.ttsEngine.value === 'browser'" class="space-y-2">
              <label class="block text-sm font-medium text-gray-300">Voice</label>
              <select v-model="settings.browserVoice.value" class="w-full bg-gray-700 border border-gray-600 rounded p-2 text-white focus:outline-none focus:border-purple-500 transition-colors">
                <option v-for="(voice, key) in tts.voices.value" :key="key" :value="key">
                  {{ voice.name }} ({{ voice.lang || 'unknown' }})
                </option>
              </select>
            </div>

            <!-- Server Piper Voice Selection -->
            <div v-if="settings.ttsEngine.value === 'serverPiper'" class="space-y-2">
              <label class="block text-sm font-medium text-gray-300">Voice</label>
              <select v-model="settings.selectedVoice.value" class="w-full bg-gray-700 border border-gray-600 rounded p-2 text-white focus:outline-none focus:border-purple-500 transition-colors">
                <option v-for="(voice, key) in tts.voices.value" :key="key" :value="key">
                  {{ voice.name }}
                </option>
              </select>
              <p v-if="Object.keys(tts.voices.value).length === 0" class="text-xs text-red-400">No models found in models/piper/</p>
            </div>

            <!-- Rate & Pitch for Browser -->
            <div v-if="settings.ttsEngine.value === 'browser'" class="space-y-2">
              <label class="block text-sm font-medium text-gray-300">Speed ({{ Math.round(settings.ttsRate.value * 100) }}%)</label>
              <input v-model.number="settings.ttsRate.value" type="range" min="0.5" max="2" step="0.1" class="w-full accent-purple-500" />
            </div>

            <div v-if="settings.ttsEngine.value === 'browser'" class="space-y-2">
              <label class="block text-sm font-medium text-gray-300">Pitch ({{ Math.round(settings.ttsPitch.value * 100) }}%)</label>
              <input v-model.number="settings.ttsPitch.value" type="range" min="0.5" max="2" step="0.1" class="w-full accent-purple-500" />
            </div>

            <div class="space-y-2">
              <label class="block text-sm font-medium text-gray-300">Volume ({{ Math.round((settings.ttsVolume.value || 1) * 100) }}%)</label>
              <input v-model.number="settings.ttsVolume.value" type="range" min="0" max="1" step="0.05" class="w-full accent-purple-500" />
            </div>

            <div v-if="tts.isLoading.value" class="text-center text-sm text-yellow-400">
              {{ 
                settings.ttsEngine.value === 'browser' ? 'Loading voices...' : 
                settings.ttsEngine.value === 'serverPiper' ? 'Loading voices from server...' :
                'Loading Kokoro model (~93MB)...'
              }}
            </div>

            <div v-if="tts.engineError.value" class="text-center text-sm text-red-400">
              {{ tts.engineError.value }}
            </div>

            <button 
              @click="testTTS" 
              :disabled="tts.isLoading.value"
              class="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-medium py-2 px-4 rounded transition-colors text-sm flex items-center justify-center gap-2"
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path><path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path></svg>
              {{ tts.isLoading.value ? 'Loading...' : 'Initiate & Test' }}
            </button>

            <!-- Local Models Info -->
            <div class="pt-4 border-t border-gray-700">
              <h3 class="text-sm font-medium text-gray-300 mb-2">Local Models</h3>
              <p class="text-xs text-gray-500 mb-3">
                Place Piper models in <code class="bg-gray-700 px-1 rounded">models/piper/</code>.
              </p>
              <div class="space-y-2 text-xs">
                <div class="flex items-center justify-between bg-gray-700/50 p-2 rounded">
                  <span class="text-gray-300">Piper (.onnx)</span>
                  <span class="text-gray-500">models/piper/</span>
                </div>
              </div>
              <p class="text-xs text-gray-500 mt-2">
                If no local models found, app will download from internet.
              </p>
            </div>
          </div>
        </div>

        <div class="space-y-4 pt-4 border-t border-gray-700">
          <div class="space-y-2">
            <label class="block text-sm font-medium text-gray-300">Add to List</label>
            <div class="flex gap-2">
              <input v-model="newUsername" type="text" class="flex-1 bg-gray-700 border border-gray-600 rounded p-2 text-white text-sm focus:outline-none focus:border-purple-500" placeholder="username" />
              <select v-model="newPlatform" class="bg-gray-700 border border-gray-600 rounded p-2 text-white text-sm focus:outline-none focus:border-purple-500">
                <option value="twitch">Twitch</option>
                <option value="kick">Kick</option>
              </select>
              <button @click="addToList('blocklist')" class="bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded text-sm transition-colors">Block</button>
              <button @click="addToList('allowlist')" class="bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded text-sm transition-colors">Allow</button>
            </div>
          </div>

          <div class="bg-gray-700/50 rounded-lg p-3">
            <div class="flex items-center justify-between mb-2">
              <span class="text-sm font-medium text-gray-300">Blocklist</span>
              <label class="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" v-model="settings.blocklistEnabled.value" @change="handleListToggle('blocklist')" class="sr-only peer">
                <div class="w-9 h-5 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-red-500"></div>
              </label>
            </div>
            <div class="flex flex-wrap gap-1.5 min-h-[24px]">
              <span v-if="settings.blocklist.value.length === 0" class="text-xs text-gray-500 italic">No users blocked</span>
              <span v-for="(entry, index) in settings.blocklist.value" :key="'block-'+index" class="inline-flex items-center gap-1 bg-red-900/40 text-red-300 text-xs px-2 py-1 rounded-full border border-red-700/50">
                <span class="w-2 h-2 rounded-full" :class="entry.platform === 'twitch' ? 'bg-purple-500' : 'bg-green-500'"></span>
                {{ entry.username }}
                <button @click="removeFromList('blocklist', index)" class="ml-1 hover:text-red-200">&times;</button>
              </span>
            </div>
          </div>

          <div class="bg-gray-700/50 rounded-lg p-3">
            <div class="flex items-center justify-between mb-2">
              <span class="text-sm font-medium text-gray-300">Allowlist</span>
              <label class="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" v-model="settings.allowlistEnabled.value" @change="handleListToggle('allowlist')" class="sr-only peer">
                <div class="w-9 h-5 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-green-500"></div>
              </label>
            </div>
            <div class="flex flex-wrap gap-1.5 min-h-[24px]">
              <span v-if="settings.allowlist.value.length === 0" class="text-xs text-gray-500 italic">No users allowed</span>
              <span v-for="(entry, index) in settings.allowlist.value" :key="'allow-'+index" class="inline-flex items-center gap-1 bg-green-900/40 text-green-300 text-xs px-2 py-1 rounded-full border border-green-700/50">
                <span class="w-2 h-2 rounded-full" :class="entry.platform === 'twitch' ? 'bg-purple-500' : 'bg-green-500'"></span>
                {{ entry.username }}
                <button @click="removeFromList('allowlist', index)" class="ml-1 hover:text-green-200">&times;</button>
              </span>
            </div>
          </div>
        </div>
      </div>
    </aside>
    <div class="main-container">
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick } from 'vue';
import { useSettings } from '~/composables/useSettings';
import { useTTS } from '~/composables/useTTS';
import { useTwitchChat, type ChatMessage } from '~/composables/useTwitchChat';
import { useKickChat } from '~/composables/useKickChat';
import { useSystemInfo } from '~/composables/useSystemInfo';
import { useEmotes } from '~/composables/useEmotes';

import StreamStudio from '~/components/StreamStudio.vue';

const settings = useSettings();
const tts = useTTS();
const sys = useSystemInfo();
const emotes = useEmotes();
const messages = ref<ChatMessage[]>([]);
const chatContainer = ref<HTMLElement | null>(null);
const newUsername = ref('');
const newPlatform = ref<'twitch' | 'kick'>('twitch');
const overlayCopied = ref(false);
const ipCopied = ref(false);
const localIP = ref('');
const mounted = ref(false);

const activeUserPopup = ref<{
  username: string;
  platform: 'twitch' | 'kick';
  x: number;
  y: number;
} | null>(null);

const showUserPopup = (event: MouseEvent, username: string, platform: 'twitch' | 'kick') => {
  event.stopPropagation();
  activeUserPopup.value = {
    username,
    platform,
    x: event.clientX,
    y: event.clientY
  };
};

const closeUserPopup = () => {
  activeUserPopup.value = null;
};

const getLocalIP = async () => {
  try {
    const pc = new RTCPeerConnection({ iceServers: [] });
    await pc.createDataChannel('');
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    
    if (!offer.sdp) return;
    const lines = offer.sdp.split('\n');
    for (const line of lines) {
      if (line.startsWith('a=candidate:')) {
        const parts = line.split(' ');
        const ip = parts[4];
        if (ip && !ip.startsWith('127.') && ip.includes('.')) {
          localIP.value = ip;
          break;
        }
      }
    }
    pc.close();
  } catch (e) {
    console.error('Failed to get local IP:', e);
    localIP.value = 'localhost';
  }
};

const copyIPAddress = async () => {
  if (!localIP.value) {
    await getLocalIP();
  }
  const url = `http://${localIP.value}:3000/overlay?header=false`;
  try {
    await navigator.clipboard.writeText(url);
    ipCopied.value = true;
    setTimeout(() => {
      ipCopied.value = false;
    }, 2000);
  } catch (err) {
    console.error('Failed to copy:', err);
  }
};

const maxMessages = 200;

const addToList = (list: 'blocklist' | 'allowlist', usernameInput?: string, platformInput?: 'twitch' | 'kick') => {
  const username = (usernameInput || newUsername.value).trim().toLowerCase();
  if (!username) return;
  
  const platform = platformInput || newPlatform.value;
  const entry = { username, platform };
  const targetList = list === 'blocklist' ? settings.blocklist : settings.allowlist;
  
  const exists = targetList.value.some(
    e => e.username.toLowerCase() === username && e.platform === platform
  );
  
  if (!exists) {
    targetList.value.push(entry);
  }
  
  if (!usernameInput) {
    newUsername.value = '';
  } else {
    closeUserPopup();
  }
};

const removeFromList = (list: 'blocklist' | 'allowlist', index: number) => {
  if (list === 'blocklist') {
    settings.blocklist.value.splice(index, 1);
  } else {
    settings.allowlist.value.splice(index, 1);
  }
};

const handleListToggle = (enabledList: 'blocklist' | 'allowlist') => {
  if (enabledList === 'blocklist' && settings.blocklistEnabled.value) {
    settings.allowlistEnabled.value = false;
  } else if (enabledList === 'allowlist' && settings.allowlistEnabled.value) {
    settings.blocklistEnabled.value = false;
  }
};

const testTTS = async () => {
  if (!tts.isEngineReady.value) {
    await tts.switchEngine(settings.ttsEngine.value);
  }
  const testMsg: ChatMessage = {
    id: 'test',
    platform: 'twitch',
    username: 'System',
    message: 'Test message from OmniStreamBot!',
    timestamp: Date.now()
  };
  await tts.speak(testMsg);
};

const copyOverlayLink = async () => {
  const ip = localIP.value || 'localhost';
  const url = `http://${ip}:3000/overlay?header=false`;
  try {
    await navigator.clipboard.writeText(url);
    overlayCopied.value = true;
    setTimeout(() => {
      overlayCopied.value = false;
    }, 2000);
  } catch (err) {
    console.error('Failed to copy:', err);
  }
};

const handleMessage = (msg: ChatMessage) => {
  messages.value.push(msg);
  
  // Prune old messages
  if (messages.value.length > maxMessages) {
    messages.value.shift();
  }

  // Scroll to bottom
  nextTick(() => {
    if (chatContainer.value) {
      chatContainer.value.scrollTop = chatContainer.value.scrollHeight;
    }
  });

  // Trigger TTS (non-blocking)
  tts.speak(msg);
};

const twitch = useTwitchChat(handleMessage);
const kick = useKickChat(handleMessage);

onMounted(() => {
  mounted.value = true;
  // Enforce dark mode on body element just in case
  document.documentElement.classList.add('dark');

  // Auto connect if usernames exist
  if (settings.twitchUsername.value) twitch.connect();
  if (settings.kickUsername.value) kick.connect();

  window.addEventListener('click', closeUserPopup);
});

onUnmounted(() => {
  window.removeEventListener('click', closeUserPopup);
});
</script>

<style>
@keyframes fade-in {
  from { opacity: 0; transform: translateY(4px); }
  to { opacity: 1; transform: translateY(0); }
}
.animate-fade-in {
  animation: fade-in 0.2s ease-out forwards;
}
</style>
