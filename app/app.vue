<template>
  <div class="flex h-screen w-screen bg-gray-900 text-gray-100 overflow-hidden dark">
    <!-- Chat Area (80%) -->
    <main class="w-[80%] h-full flex flex-col border-r border-gray-700 bg-gray-900 overflow-y-auto">
      <header class="p-4 border-b border-gray-700 bg-gray-800 shrink-0 flex items-center justify-between">
        <h1 class="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-green-400">
          OmniStreamBot Unified Chat
        </h1>
        <div class="flex items-center gap-4 text-sm font-medium">
          <span :class="twitch.isConnected.value ? 'text-green-400' : 'text-red-400'"><span class="w-2 h-2 inline-block rounded-full bg-current mr-1"></span> Twitch</span>
          <span :class="kick.isConnected.value ? 'text-green-400' : 'text-red-400'"><span class="w-2 h-2 inline-block rounded-full bg-current mr-1"></span> Kick</span>
        </div>
      </header>
      <div 
        ref="chatContainer"
        class="flex-1 p-4 overflow-y-auto flex flex-col gap-2 relative scroll-smooth"
      >
        <div v-if="messages.length === 0" class="text-gray-400 italic text-sm text-center mt-10">Chat messages will appear here...</div>

        <div 
          v-for="msg in messages" 
          :key="msg.id"
          class="flex flex-col animate-fade-in p-2 rounded hover:bg-gray-800 transition-colors"
        >
          <div class="flex items-center gap-2 mb-1">
            <span 
              class="text-xs font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
              :class="msg.platform === 'twitch' ? 'bg-purple-600/20 text-purple-400' : 'bg-green-600/20 text-green-400'"
            >
              {{ msg.platform }}
            </span>
            <span class="font-bold cursor-pointer" :style="{ color: msg.color }">{{ msg.username }}</span>
            <span class="text-xs text-gray-500">{{ new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) }}</span>
          </div>
          <p class="text-gray-100 text-sm leading-relaxed whitespace-pre-wrap break-words">{{ msg.message }}</p>
        </div>
      </div>
    </main>

    <!-- Sidebar Area (20%) -->
    <aside class="w-[20%] h-full bg-gray-800 p-6 flex flex-col overflow-y-auto shadow-xl">
      <h2 class="text-lg font-semibold mb-6 flex items-center gap-2">
        <span class="text-gray-400">⚙️</span> Settings
      </h2>
      
      <div class="space-y-6 flex-1">
        <!-- Settings sections will be added here -->
        <div class="space-y-2">
          <div class="flex justify-between items-center">
             <label class="block text-sm font-medium text-gray-300">Twitch Username</label>
             <button @click="twitch.connect()" v-if="settings.twitchUsername.value && !twitch.isConnected.value" class="text-xs text-purple-400 hover:text-purple-300">Connect</button>
             <button @click="twitch.disconnect()" v-else-if="twitch.isConnected.value" class="text-xs text-gray-400 hover:text-red-400">Disconnect</button>
          </div>
          <input v-model="settings.twitchUsername.value" type="text" class="w-full bg-gray-700 border border-gray-600 rounded p-2 text-white focus:outline-none focus:border-purple-500 transition-colors" placeholder="e.g. xqc" />
        </div>

        <div class="space-y-2">
          <div class="flex justify-between items-center">
             <label class="block text-sm font-medium text-gray-300">Kick Username</label>
             <button @click="kick.connect()" v-if="settings.kickUsername.value && !kick.isConnected.value" class="text-xs text-green-400 hover:text-green-300">Connect</button>
             <button @click="kick.disconnect()" v-else-if="kick.isConnected.value" class="text-xs text-gray-400 hover:text-red-400">Disconnect</button>
          </div>
          <input v-model="settings.kickUsername.value" type="text" class="w-full bg-gray-700 border border-gray-600 rounded p-2 text-white focus:outline-none focus:border-green-500 transition-colors" placeholder="e.g. adinross" />
        </div>

        <div class="space-y-4 pt-4 border-t border-gray-700">
          <label class="flex items-center gap-2 cursor-pointer">
            <input v-model="settings.ttsEnabled.value" type="checkbox" class="w-4 h-4 text-purple-600 bg-gray-700 border-gray-600 rounded focus:ring-purple-500 focus:ring-2">
            <span class="text-sm font-medium text-gray-300">Enable Text-to-Speech</span>
          </label>

          <div v-if="settings.ttsEnabled.value" class="space-y-4">
            <div class="space-y-2">
              <label class="block text-sm font-medium text-gray-300">Voice</label>
              <select v-model="settings.selectedVoice.value" class="w-full bg-gray-700 border border-gray-600 rounded p-2 text-white focus:outline-none focus:border-purple-500 transition-colors">
                <option v-for="(voice, key) in tts.voices.value" :key="key" :value="key">
                  {{ voice.name }}
                </option>
              </select>
              <p class="text-xs text-gray-500">Reload tab after changing voice for it to take effect</p>
            </div>

            <div class="space-y-2">
              <label class="block text-sm font-medium text-gray-300">Volume ({{ Math.round((settings.ttsVolume.value || 1) * 100) }}%)</label>
              <input v-model.number="settings.ttsVolume.value" type="range" min="0" max="1" step="0.05" class="w-full accent-purple-500" />
            </div>

            <button @click="tts.speak('Test message from OmniStreamBot!')" class="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded transition-colors text-sm flex items-center justify-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path><path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path></svg>
              Initiate & Test
            </button>
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
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, nextTick } from 'vue';
import { useSettings } from '~/composables/useSettings';
import { useTTS } from '~/composables/useTTS';
import { useTwitchChat, type ChatMessage } from '~/composables/useTwitchChat';
import { useKickChat } from '~/composables/useKickChat';

const settings = useSettings();
const tts = useTTS();
const messages = ref<ChatMessage[]>([]);
const chatContainer = ref<HTMLElement | null>(null);
const newUsername = ref('');
const newPlatform = ref<'twitch' | 'kick'>('twitch');

const maxMessages = 200;

const addToList = (list: 'blocklist' | 'allowlist') => {
  const username = newUsername.value.trim().toLowerCase();
  if (!username) return;
  
  const entry = { username, platform: newPlatform.value };
  const targetList = list === 'blocklist' ? settings.blocklist : settings.allowlist;
  
  const exists = targetList.value.some(
    e => e.username.toLowerCase() === username && e.platform === newPlatform.value
  );
  
  if (!exists) {
    targetList.value.push(entry);
  }
  
  newUsername.value = '';
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
  tts.speak(`${msg.username} says: ${msg.message}`, { username: msg.username, platform: msg.platform });
};

const twitch = useTwitchChat(handleMessage);
const kick = useKickChat(handleMessage);

onMounted(() => {
  // Enforce dark mode on body element just in case
  document.documentElement.classList.add('dark');

  // Auto connect if usernames exist
  if (settings.twitchUsername.value) twitch.connect();
  if (settings.kickUsername.value) kick.connect();
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
