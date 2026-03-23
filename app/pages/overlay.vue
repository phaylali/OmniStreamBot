<template>
  <div class="h-screen w-screen text-gray-100 overflow-hidden dark">
    <div class="w-full h-full flex flex-col overflow-y-auto bg-black">
      <div 
        v-if="showHeader"
        class="p-2 shrink-0 flex items-center justify-between bg-gray-900/80"
      >
        <h1 class="text-sm font-bold text-white/80">
          Chat
        </h1>
        <div class="flex items-center gap-2 text-xs font-medium">
          <span :class="twitch.isConnected ? 'text-green-400' : 'text-red-400'">Twitch</span>
          <span :class="kick.isConnected ? 'text-green-400' : 'text-red-400'">Kick</span>
        </div>
      </div>
      <div 
        ref="chatContainer"
        class="flex-1 p-2 overflow-y-auto flex flex-col gap-1 scroll-smooth"
      >
        <div v-if="messages.length === 0" class="text-gray-400 italic text-xs text-center mt-4">Connecting...</div>

        <div 
          v-for="msg in messages" 
          :key="msg.id"
          class="flex flex-col p-1 rounded bg-black/50"
        >
          <div class="flex items-center gap-1">
            <span 
              class="text-[10px] font-bold uppercase tracking-wider px-1 rounded"
              :class="msg.platform === 'twitch' ? 'bg-purple-600/50 text-purple-300' : 'bg-green-600/50 text-green-300'"
            >
              {{ msg.platform }}
            </span>
            <span class="font-bold text-sm" :style="{ color: msg.color }">{{ msg.username }}</span>
          </div>
          <div class="text-[13px] text-white/90 whitespace-pre-wrap break-words flex flex-wrap items-center gap-x-1 min-h-[20px]">
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
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, nextTick, onUnmounted } from 'vue';
import { useSettings } from '~/composables/useSettings';
import { useTwitchChat, type ChatMessage } from '~/composables/useTwitchChat';
import { useKickChat } from '~/composables/useKickChat';
import { useEmotes } from '~/composables/useEmotes';

const settings = useSettings();
const emotes = useEmotes();
const messages = ref<ChatMessage[]>([]);
const chatContainer = ref<HTMLElement | null>(null);

const showHeader = ref(false);

const maxMessages = 100;

const handleMessage = (msg: ChatMessage) => {
  messages.value.push(msg);
  
  if (messages.value.length > maxMessages) {
    messages.value.shift();
  }

  nextTick(() => {
    if (chatContainer.value) {
      chatContainer.value.scrollTop = chatContainer.value.scrollHeight;
    }
  });
};

const twitch = useTwitchChat(handleMessage);
const kick = useKickChat(handleMessage);

onMounted(() => {
  document.documentElement.classList.add('dark');
  document.body.style.margin = '0';
  document.body.style.backgroundColor = '#000000';

  if (settings.twitchUsername.value) twitch.connect();
  if (settings.kickUsername.value) kick.connect();

  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('header') !== 'false') {
    showHeader.value = true;
  }
});

onUnmounted(() => {
  twitch.disconnect();
  kick.disconnect();
});
</script>

<style>
* {
  scrollbar-width: thin;
  scrollbar-color: rgba(255, 255, 255, 0.3) transparent;
}
html, body {
  background-color: #000000 !important;
  margin: 0;
  padding: 0;
}
</style>
