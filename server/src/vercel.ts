import { createHash } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import { buildApp } from "./app.js";
import { anthropicDesigner } from "./ai-card.js";

// Vercel Function entry: one Fastify app per warm instance, built on first request.
let ready: ReturnType<typeof buildApp> | undefined;

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  const url = process.env.DATABASE_URL;
  // Without SESSION_SECRET, sessions are signed with a key derived from the (secret, stable) database URL.
  const secret = process.env.SESSION_SECRET ?? (url && createHash("sha256").update(`wjm-session:${url}`).digest("hex"));
  if (!url || !secret) {
    res.statusCode = 500;
    res.setHeader("content-type", "application/json");
    return res.end(JSON.stringify({ error: { code: "not_configured", message: "DATABASE_URL must be set" } }));
  }
  ready ??= buildApp({ db: url, sessionSecret: secret, appUrl: process.env.APP_URL, showDevLink: process.env.SHOW_DEV_LINK !== "false", logger: true,
    designCard: process.env.ANTHROPIC_API_KEY ? anthropicDesigner(process.env.ANTHROPIC_API_KEY, process.env.ANTHROPIC_MODEL ?? "claude-haiku-4-5") : undefined })
    .then(async (app) => { await app.ready(); return app; });
  let app;
  try { app = await ready; } catch (e) { ready = undefined; throw e; }
  app.server.emit("request", req, res);
}
