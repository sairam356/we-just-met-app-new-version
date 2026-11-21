import type { IncomingMessage, ServerResponse } from "node:http";
import { buildApp } from "./app.js";

// Vercel Function entry: one Fastify app per warm instance, built on first request.
let ready: ReturnType<typeof buildApp> | undefined;

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  const url = process.env.DATABASE_URL, secret = process.env.SESSION_SECRET;
  if (!url || !secret) {
    res.statusCode = 500;
    res.setHeader("content-type", "application/json");
    return res.end(JSON.stringify({ error: { code: "not_configured", message: "DATABASE_URL and SESSION_SECRET must be set" } }));
  }
  ready ??= buildApp({ db: url, sessionSecret: secret, appUrl: process.env.APP_URL, showDevLink: process.env.SHOW_DEV_LINK !== "false", logger: true })
    .then(async (app) => { await app.ready(); return app; });
  let app;
  try { app = await ready; } catch (e) { ready = undefined; throw e; }
  app.server.emit("request", req, res);
}
