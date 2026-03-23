<template>
  <div class="flex flex-col h-full bg-gray-950 p-4 border-r border-gray-700">
    <div class="flex items-center justify-between mb-4">
      <h2 class="text-lg font-bold text-white flex items-center gap-2">
        <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 text-red-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 7l-7 5 7 5V7z"></path><rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect></svg>
        Stream Studio
      </h2>
      <div v-if="caster.isStreaming.value" class="animate-pulse flex items-center gap-2 text-sm font-bold text-red-500">
        <span class="w-2.5 h-2.5 bg-red-500 rounded-full"></span> LIVE
      </div>
    </div>

    <!-- Preview Box (Canvas) -->
    <div class="flex-1 relative bg-black rounded-lg border border-gray-800 overflow-hidden shadow-2xl" style="min-height: 400px;">
      <canvas 
        ref="compositeCanvas" 
        style="width: 100%; height: 100%; display: block;"
        width="1920" 
        height="1080"
      ></canvas>

      <!-- Video elements are used securely in the background to pipe streams to the canvas -->
      <video ref="screenVideo" autoplay muted playsinline style="position: absolute; left: -9999px; top: -9999px;"></video>
      <video ref="webcamVideo" autoplay muted playsinline style="position: absolute; left: -9999px; top: -9999px;"></video>

      <div v-if="!isScreenShared && !isWebcamActive" class="absolute inset-0 flex flex-col items-center justify-center text-gray-500 gap-4">
        <svg xmlns="http://www.w3.org/2000/svg" class="w-16 h-16 opacity-50" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1"><polygon points="23 7 16 12 23 17 23 7"></polygon><rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect></svg>
        <p>No video sources active.</p>
        <p class="text-xs">Select screen or webcam below.</p>
      </div>
    </div>

    <!-- Controls -->
    <div class="mt-4 p-4 bg-gray-900 rounded-lg border border-gray-800 flex flex-col gap-4">
      <div class="flex items-center gap-4 justify-between">
        
        <!-- Input Sources -->
        <div class="flex gap-2">
          <button 
            @click="toggleScreen" 
            class="flex items-center gap-2 px-4 py-2 rounded text-sm font-medium transition-colors"
            :class="isScreenShared ? 'bg-blue-600/20 text-blue-400 border border-blue-500/50' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect><line x1="8" y1="21" x2="16" y2="21"></line><line x1="12" y1="17" x2="12" y2="21"></line></svg>
            {{ isScreenShared ? 'Stop Screen' : 'Share Screen' }}
          </button>
          
          <button 
            @click="toggleWebcam" 
            class="flex items-center gap-2 px-4 py-2 rounded text-sm font-medium transition-colors"
            :class="isWebcamActive ? 'bg-purple-600/20 text-purple-400 border border-purple-500/50' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 7l-7 5 7 5V7z"></path><rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect></svg>
            {{ isWebcamActive ? 'Stop Webcam' : 'Enable Webcam' }}
          </button>
        </div>

        <!-- Stream Action -->
        <button 
          @click="toggleStream"
          class="flex items-center gap-2 px-6 py-2.5 rounded font-bold shadow-lg transition-all"
          :class="caster.isStreaming.value ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-green-600 hover:bg-green-700 text-white disabled:opacity-50 disabled:cursor-not-allowed'"
          :disabled="!hasSources"
        >
          <template v-if="caster.isStreaming.value">
            <span class="w-2 h-2 bg-white rounded-full"></span> Stop Streaming
          </template>
          <template v-else>
            <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="2"></circle><path d="M16.24 7.76a6 6 0 0 1 0 8.49m-8.48-.01a6 6 0 0 1 0-8.49m11.31-2.82a10 10 0 0 1 0 14.14m-14.14 0a10 10 0 0 1 0-14.14"></path></svg>
            Start Streaming
          </template>
        </button>
      </div>

      <div class="text-xs text-gray-500 flex items-center justify-between">
        <div>Resolution: 1920x1080 @ 60FPS</div>
        <div>Backend: C++ Ingest Server (Port 3005)</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useStreamCaster } from '~/composables/useStreamCaster';

const props = defineProps<{
  twitchKey?: string;
  kickKey?: string;
}>();

const caster = useStreamCaster();

const compositeCanvas = ref<HTMLCanvasElement | null>(null);
const screenVideo = ref<HTMLVideoElement | null>(null);
const webcamVideo = ref<HTMLVideoElement | null>(null);

const isScreenShared = ref(false);
const isWebcamActive = ref(false);
const userAudioStream = ref<MediaStream | null>(null);

const hasSources = computed(() => isScreenShared.value || isWebcamActive.value);

let renderFrameId: number;
let audioContext: AudioContext | null = null;
let canvasAudioDestination: MediaStreamAudioDestinationNode | null = null;
let screenAudioSource: MediaStreamAudioSourceNode | null = null;
let micAudioSource: MediaStreamAudioSourceNode | null = null;

const toggleScreen = async () => {
  if (isScreenShared.value) {
    if (screenVideo.value?.srcObject) {
      const stream = screenVideo.value.srcObject as MediaStream;
      stream.getTracks().forEach(t => t.stop());
    }
    screenVideo.value!.srcObject = null;
    isScreenShared.value = false;
  } else {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { width: 1920, height: 1080, frameRate: 60 },
        audio: true
      });
      screenVideo.value!.srcObject = stream;
      isScreenShared.value = true;
      console.log('[StreamStudio] Screen shared, video element readyState:', screenVideo.value.readyState);
      
      // Force play the video
      screenVideo.value.play().catch(e => console.error('[StreamStudio] Play error:', e));
      
      // Auto stop on browser UI interaction
      stream.getVideoTracks()[0].onended = () => {
        toggleScreen();
      };
      
      mixAudioSources();
    } catch (e) {
      console.error('Failed to share screen', e);
    }
  }
};

const toggleWebcam = async () => {
  if (isWebcamActive.value) {
    if (webcamVideo.value?.srcObject) {
      const stream = webcamVideo.value.srcObject as MediaStream;
      stream.getTracks().forEach(t => t.stop());
    }
    webcamVideo.value!.srcObject = null;
    isWebcamActive.value = false;
    
    // Stop mic explicitly as well
    if (userAudioStream.value && !isScreenShared.value) {
        userAudioStream.value.getTracks().forEach(t => t.stop());
        userAudioStream.value = null;
    }
  } else {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 1280, height: 720 },
        audio: true // we get mic from webcam
      });
      webcamVideo.value!.srcObject = stream;
      userAudioStream.value = stream;
      isWebcamActive.value = true;
      
      // Force play the video
      webcamVideo.value.play().catch(e => console.error('[StreamStudio] Webcam play error:', e));
      
      mixAudioSources();
    } catch (e) {
      console.error('Failed to start webcam', e);
      alert('Could not access camera or microphone.');
    }
  }
};

const mixAudioSources = () => {
  // If we don't have an audio context, create one
  if (!audioContext) {
    audioContext = new AudioContext();
    canvasAudioDestination = audioContext.createMediaStreamDestination();
  }

  // Connect screen audio
  if (isScreenShared.value && screenVideo.value?.srcObject) {
    const stream = screenVideo.value.srcObject as MediaStream;
    if (stream.getAudioTracks().length > 0 && !screenAudioSource) {
      screenAudioSource = audioContext.createMediaStreamSource(stream);
      screenAudioSource.connect(canvasAudioDestination!);
    }
  }

  // Connect mic audio
  if (isWebcamActive.value && userAudioStream.value) {
    if (userAudioStream.value.getAudioTracks().length > 0 && !micAudioSource) {
      micAudioSource = audioContext.createMediaStreamSource(userAudioStream.value);
      micAudioSource.connect(canvasAudioDestination!);
    }
  }
};

const renderLoop = () => {
  if (!compositeCanvas.value) return;
  
  // Create context with hardware acceleration
  const ctx = compositeCanvas.value.getContext('2d', { alpha: false, desynchronized: true });
  if (!ctx) {
    console.error('[StreamStudio] Failed to get 2D context');
    return;
  }

  // Clear background
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, 1920, 1080);

  // Debug: draw a green rectangle in corner to confirm canvas works
  ctx.fillStyle = '#00ff00';
  ctx.fillRect(10, 10, 100, 100);
  ctx.fillStyle = '#ffffff';
  ctx.font = '24px Arial';
  ctx.fillText('DEBUG', 20, 60);

  // 1. Draw Screen (if active)
  if (isScreenShared.value && screenVideo.value && screenVideo.value.readyState >= 2 && screenVideo.value.videoWidth > 0) {
    console.log('[StreamStudio] Drawing screen:', screenVideo.value.videoWidth, 'x', screenVideo.value.videoHeight, 'currentTime:', screenVideo.value.currentTime);
    
    try {
      ctx.drawImage(screenVideo.value, 0, 0, 1920, 1080);
      console.log('[StreamStudio] drawImage called successfully');
    } catch (e) {
      console.error('[StreamStudio] drawImage error:', e);
    }
  }

  // 2. Draw Webcam PIP (if active)
  if (isWebcamActive.value && webcamVideo.value && webcamVideo.value.readyState >= 2 && webcamVideo.value.videoWidth > 0) {
    console.log('[StreamStudio] Drawing webcam:', webcamVideo.value.videoWidth, 'x', webcamVideo.value.videoHeight);
    const pipWidth = 320;
    const pipHeight = 180;
    const x = 1920 - pipWidth - 20;
    const y = 1080 - pipHeight - 20;

    ctx.drawImage(webcamVideo.value, x, y, pipWidth, pipHeight);
  }

  renderFrameId = requestAnimationFrame(renderLoop);
};

const toggleStream = () => {
  if (caster.isStreaming.value) {
    caster.stopStream();
  } else {
    if (!props.twitchKey && !props.kickKey) {
      alert("Please configure a stream key in the settings first!");
      return;
    }
    if (compositeCanvas.value) {
        caster.startStream(
            compositeCanvas.value, 
            canvasAudioDestination ? canvasAudioDestination.stream : null,
            props.twitchKey || '', 
            props.kickKey || ''
        );
    }
  }
};

onMounted(() => {
  renderLoop();
});

onUnmounted(() => {
  cancelAnimationFrame(renderFrameId);
  caster.stopStream();
  if (audioContext) audioContext.close();
});
</script>
