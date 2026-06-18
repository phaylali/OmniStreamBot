import type { ElectrobunConfig } from "electrobun";

export default {
  app: {
    name: "OmniversifyStudio",
    identifier: "com.omniversify.studio",
    version: "1.0.0",
  },
  build: {
    bun: {
      entrypoint: "src/bun/index.ts",
    },
    views: {
      main: {
        entrypoint: "src/views/main/index.ts",
      },
    },
    copy: {
      "src/views/main/index.html": "views/main/index.html",
    },
    mac: {
      bundleCEF: false,
      bundleWGPU: false,
    },
    linux: {
      bundleCEF: false,
      bundleWGPU: false,
    },
    win: {
      bundleCEF: false,
      bundleWGPU: false,
    },
  },
} satisfies ElectrobunConfig;