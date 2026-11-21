import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { buildApp } from "./app.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = process.env.DATA_DIR ?? join(root, "data");
mkdirSync(dataDir, { recursive: true });
const secretFile = join(dataDir, ".session-secret");
if (!process.env.SESSION_SECRET && !existsSync(secretFile)) writeFileSync(secretFile, randomBytes(32).toString("hex"));

const port = Number(process.env.PORT ?? 4000);
const app = await buildApp({
  dbFile: join(dataDir, "wjm.sqlite"),
  uploadsDir: join(dataDir, "uploads"),
  appUrl: process.env.APP_URL ?? "http://localhost:5173",
  sessionSecret: process.env.SESSION_SECRET ?? readFileSync(secretFile, "utf8"),
  webDist: process.env.WEB_DIST ?? join(root, "..", "web", "dist"),
  showDevLink: process.env.SHOW_DEV_LINK !== "false",
  logger: true,
});
await app.listen({ port, host: "0.0.0.0" });
