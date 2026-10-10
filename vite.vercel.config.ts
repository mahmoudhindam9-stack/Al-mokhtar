import { defineConfig, mergeConfig } from "vite";
import { nitro } from "nitro/vite";
import appConfig from "./vite.config";

// Nitro is installed as part of the Vercel build command so local offline setup
// does not need an additional dependency just to run on this computer.
export default defineConfig(
  mergeConfig(appConfig, {
    plugins: [nitro()],
  }),
);
