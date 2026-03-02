import { ref, onMounted, onUnmounted } from 'vue';

interface SystemInfoData {
    cpuCores: number;
    deviceMemory: number | null;
    devicePixelRatio: number;
    gpuVendor: string;
    gpuRenderer: string;
    platform: string;
    userAgent: string;
}

interface NetworkInfoData {
    downlink: number | null;
    effectiveType: string | null;
    saveData: boolean;
}

export const useSystemInfo = () => {
    const cpuCores = ref(0);
    const deviceMemory = ref<number | null>(null);
    const gpuRenderer = ref('Unknown');
    const gpuVendor = ref('Unknown');
    const networkType = ref('Unknown');
    const networkSpeed = ref<number | null>(null);
    const isReady = ref(false);

    const detectGPU = (): { vendor: string; renderer: string } => {
        if (typeof window === 'undefined') {
            return { vendor: 'N/A', renderer: 'N/A' };
        }
        const canvas = document.createElement('canvas');
        const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl') as WebGLRenderingContext | null;
        
        if (!gl) {
            return { vendor: 'Unknown', renderer: 'Unknown' };
        }

        const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
        if (debugInfo) {
            return {
                vendor: gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL),
                renderer: gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL),
            };
        }

        return { vendor: 'Unknown', renderer: 'Unknown' };
    };

    const updateNetworkInfo = () => {
        const connection = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
        
        if (connection) {
            networkSpeed.value = connection.downlink || null;
            networkType.value = connection.effectiveType || 'Unknown';
        } else {
            networkType.value = 'Unknown';
            networkSpeed.value = null;
        }
    };

    onMounted(() => {
        cpuCores.value = navigator.hardwareConcurrency || 1;
        deviceMemory.value = (navigator as any).deviceMemory || null;
        
        const gpu = detectGPU();
        gpuVendor.value = gpu.vendor;
        gpuRenderer.value = gpu.renderer;

        updateNetworkInfo();
        
        const connection = (navigator as any).connection;
        if (connection) {
            connection.addEventListener('change', updateNetworkInfo);
        }

        isReady.value = true;
    });

    return {
        cpuCores,
        deviceMemory,
        gpuRenderer,
        gpuVendor,
        networkType,
        networkSpeed,
        isReady,
    };
};
