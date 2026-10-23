// Server-only Supabase client for genuinely privileged operations.
// This client bypasses RLS and therefore requires a real server-side secret.
// Never import this file from browser components, routes, or client bundles.
import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

function isNewSupabaseApiKey(value: string): boolean {
  return value.startsWith("sb_publishable_") || value.startsWith("sb_secret_");
}

function isValidHttpUrl(url: string | undefined | null): boolean {
  if (!url || typeof url !== "string") return false;
  const trimmed = url.trim();
  if (!trimmed.startsWith("http://") && !trimmed.startsWith("https://")) return false;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function createSupabaseFetch(supabaseKey: string): typeof fetch {
  return (input, init) => {
    const headers = new Headers(
      typeof Request !== "undefined" && input instanceof Request ? input.headers : undefined,
    );

    if (init?.headers) {
      new Headers(init.headers).forEach((value, key) => headers.set(key, value));
    }

    // New Supabase API keys are opaque strings, not bearer JWTs.
    if (
      isNewSupabaseApiKey(supabaseKey) &&
      headers.get("Authorization") === `Bearer ${supabaseKey}`
    ) {
      headers.delete("Authorization");
    }

    headers.set("apikey", supabaseKey);
    return fetch(input, { ...init, headers });
  };
}

function createSupabaseAdminClient() {
  const rawUrlCandidates = [process.env.AL_MOKHTAR_SUPABASE_URL, process.env.VITE_AL_MOKHTAR_SUPABASE_URL];
  const SUPABASE_URL = rawUrlCandidates.find(isValidHttpUrl);
  const SUPABASE_SERVICE_ROLE_KEY = process.env.AL_MOKHTAR_SUPABASE_SERVICE_ROLE_KEY;

  if (!SUPABASE_URL) {
    throw new Error("Missing Al-Mokhtar database configuration.");
  }

  // Privileged access only reads configuration explicitly named for Al-Mokhtar.

  if (
    !SUPABASE_SERVICE_ROLE_KEY ||
    SUPABASE_SERVICE_ROLE_KEY.startsWith("http://") ||
    SUPABASE_SERVICE_ROLE_KEY.startsWith("https://") ||
    SUPABASE_SERVICE_ROLE_KEY.startsWith("sb_publishable_") ||
    SUPABASE_SERVICE_ROLE_KEY.startsWith("sb_anon_")
  ) {
    throw new Error(
      "Privileged Al-Mokhtar operations require AL_MOKHTAR_SUPABASE_SERVICE_ROLE_KEY.",
    );
  }

  return createClient<Database>(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    global: {
      fetch: createSupabaseFetch(SUPABASE_SERVICE_ROLE_KEY),
    },
    auth: {
      storage: undefined,
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

let _supabaseAdmin: ReturnType<typeof createSupabaseAdminClient> | undefined;

export const supabaseAdmin = new Proxy({} as ReturnType<typeof createSupabaseAdminClient>, {
  get(_, prop, receiver) {
    if (!_supabaseAdmin) _supabaseAdmin = createSupabaseAdminClient();
    return Reflect.get(_supabaseAdmin, prop, receiver);
  },
});
