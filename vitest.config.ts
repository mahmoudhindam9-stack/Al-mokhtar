import { defineConfig } from "vitest/config";
import { resolve } from "path";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
  },
  // Prevent Vitest from loading the project's Vite config which invokes runtime plugins
  vite: {
    configFile: false,
    resolve: {
      alias: [{ find: /^@\/(.*)$/, replacement: resolve(__dirname, "src") + "/$1" }],
    },
    plugins: [tsconfigPaths()],
  },
});
