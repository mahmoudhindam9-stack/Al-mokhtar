import "./lib/error-capture";
import { GoogleGenAI } from "@google/genai";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";

// Cloud credentials are configured explicitly per deployment; no existing project is assumed.

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isH3SwallowedErrorBody(body)) return response;

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function isH3SwallowedErrorBody(body: string): boolean {
  try {
    const payload = JSON.parse(body) as { unhandled?: unknown; message?: unknown };
    return payload.unhandled === true && payload.message === "HTTPError";
  } catch {
    return false;
  }
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      const url = new URL(request.url);

      if (url.pathname === "/api/chat" && request.method === "POST") {
        if (!process.env.GEMINI_API_KEY) {
          return new Response("AI chat is not configured on this deployment.", {
            status: 503,
            headers: { "Content-Type": "text/plain; charset=utf-8" },
          });
        }
        const payload = await request.json();
        const messages = payload?.messages;
        const model = typeof payload?.model === "string" ? payload.model : "gemini-3.5-flash";
        if (!Array.isArray(messages) || messages.length === 0 || messages.length > 40 ||
            !messages.every((m: any) => m && typeof m.text === "string" &&
              ["user", "model"].includes(m.role))) {
          return new Response("Invalid chat request.", {
            status: 400,
            headers: { "Content-Type": "text/plain; charset=utf-8" },
          });
        }
        const ai = new GoogleGenAI({
          apiKey: process.env.GEMINI_API_KEY,
          httpOptions: {
            headers: {
              "User-Agent": "aistudio-build",
            },
          },
        });

        const contents = messages.map((m: any) => ({
          role: m.role,
          parts: [{ text: m.text }],
        }));

        const response = await ai.models.generateContentStream({
          model: model,
          contents: contents,
          config: {
            systemInstruction:
              "You are a helpful and professional AI assistant for Al Mokhtar (المختار لإدارة المشروعات), a comprehensive enterprise ERP, project management, commercial mall and property management, and financial accounting system. Help users with their questions, suggest features, and provide clear and concise answers in Arabic or English as requested.",
          },
        });

        const encoder = new TextEncoder();
        const stream = new ReadableStream({
          async start(controller) {
            try {
              for await (const chunk of response) {
                if (chunk.text) {
                  controller.enqueue(encoder.encode(chunk.text));
                }
              }
            } catch (err) {
              console.error("Gemini stream error:", err);
            } finally {
              controller.close();
            }
          },
        });

        return new Response(stream, {
          headers: {
            "Content-Type": "text/plain",
            "Transfer-Encoding": "chunked",
          },
        });
      }

      // GitHub write/release endpoints were intentionally removed.
      // Publishing is handled by GitHub/Vercel integrations, never by shell commands
      // that accept repository names or credentials from an HTTP request.

      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return await normalizeCatastrophicSsrResponse(response);
    } catch (error) {
      console.error(error);
      return new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
  },
};
