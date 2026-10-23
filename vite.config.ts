import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Never silently point Al-Mokhtar at a shared database. Invalid URL settings
// are removed; with no dedicated Al-Mokhtar database, the client stays offline.
const BLOCKED_SHARED_PROJECT_HOST = "myqtvbfibvgxkqwxvuru.supabase.co";
for (const key of ["VITE_SUPABASE_URL", "SUPABASE_URL"]) {
  const value = process.env[key];
  let removeValue = false;
  if (value) {
    try {
      const parsed = new URL(value);
      removeValue =
        !["http:", "https:"].includes(parsed.protocol) ||
        parsed.hostname.toLowerCase() === BLOCKED_SHARED_PROJECT_HOST;
    } catch {
      removeValue = true;
    }
  }
  if (removeValue) {
    delete process.env[key];
    if (key === "VITE_SUPABASE_URL") {
      delete process.env.VITE_SUPABASE_ANON_KEY;
      delete process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    } else {
      delete process.env.SUPABASE_ANON_KEY;
      delete process.env.SUPABASE_PUBLISHABLE_KEY;
    }
  }
}

export default defineConfig({
  plugins: [
    tanstackStart({
      prerender: {
        enabled: true,
        autoStaticPathsDiscovery: false,
      },
    }),
    react(),
    tailwindcss(),
  ],
  resolve: {
    tsconfigPaths: true,
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 3000,
    allowedHosts: true,
  },
});
