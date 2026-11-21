import Fastify, { FastifyReply, FastifyRequest } from "fastify";
import cookie from "@fastify/cookie";
import fstatic from "@fastify/static";
import { SignJWT, jwtVerify } from "jose";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { z, ZodError } from "zod";
import {
  ClickBody, ConnectionPatch, EventBody, MagicLinkBody, ProfilePatch, RedeemBody, TokenBody, UploadBody, VerifyBody,
  normalizeInstagram, normalizeLinkedin, type Connection, type User,
} from "@wjm/shared";
import { DB, now, openDb } from "./db.js";
import { TtlStore, XchgValue } from "./exchange-store.js";

export type AppOptions = { dbFile: string; uploadsDir: string; appUrl: string; sessionSecret: string; webDist?: string; showDevLink?: boolean; logger?: boolean };

class HttpError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}

const COOKIE = "wjm_session";
const KEY_RE = /^u\/[0-9a-f-]{36}\/(?:avatar|card|c\/[0-9a-f-]{36})\/[0-9a-f-]{36}\.(?:jpg|webp)$/;

export async function buildApp(opts: AppOptions) {
  const db: DB = openDb(opts.dbFile);
  const secret = new TextEncoder().encode(opts.sessionSecret);
  const xchg = new TtlStore<XchgValue>();
  const xchgResult = new TtlStore<string>();
  const app = Fastify({ logger: opts.logger ?? false, bodyLimit: 4 * 1024 * 1024 });
  await app.register(cookie);

  app.setErrorHandler((err, _req, reply) => {
    if (err instanceof HttpError) return reply.status(err.status).send({ error: { code: err.code, message: err.message } });
    if (err instanceof ZodError) {
      const msg = err.issues.map((i) => `${i.path.join(".") || "body"}: ${i.message}`).join("; ");
      return reply.status(422).send({ error: { code: "validation_error", message: msg } });
    }
    app.log.error(err);
    const status = (err as { statusCode?: number }).statusCode ?? 500;
    return reply.status(status).send({ error: { code: "internal", message: status === 500 ? "Something went wrong" : err.message } });
  });

  const fileUrl = (key: string | null) => (key ? `/api/v1/files/${key}` : null);

  const userRow = (id: string) => db.prepare("SELECT * FROM users WHERE id = ?").get(id) as Record<string, any> | undefined;
  const toUser = (r: Record<string, any>): User => ({
    id: r.id, email: r.email, name: r.name, headline: r.headline, company: r.company, jobTitle: r.job_title,
    website: r.website, phone: r.phone, linkedinUrl: r.linkedin_url, linkedinVerified: !!r.linkedin_verified,
    instagramHandle: r.instagram_handle, avatarKey: r.avatar_key, avatarUrl: fileUrl(r.avatar_key),
    businessCardKey: r.business_card_key, businessCardUrl: fileUrl(r.business_card_key),
  });

  async function requireUser(req: FastifyRequest): Promise<string> {
    const tok = req.cookies[COOKIE];
    if (!tok) throw new HttpError(401, "unauthorized", "Please sign in");
    try {
      const { payload } = await jwtVerify(tok, secret);
      const id = String(payload.sub);
      if (!userRow(id)) throw new Error("gone");
      return id;
    } catch {
      throw new HttpError(401, "unauthorized", "Please sign in");
    }
  }

  async function setSession(reply: FastifyReply, userId: string) {
    const jwt = await new SignJWT({}).setProtectedHeader({ alg: "HS256" }).setSubject(userId).setIssuedAt().setExpirationTime("30d").sign(secret);
    reply.setCookie(COOKIE, jwt, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 30 * 24 * 3600, secure: false });
  }

  const P = "/api/v1";
  app.get(`${P}/health`, async () => { db.prepare("SELECT 1").get(); return { ok: true }; });

  // ---- auth ----
  app.post(`${P}/auth/magic-link`, async (req) => {
    const { email } = MagicLinkBody.parse(req.body);
    const token = randomBytes(32).toString("base64url");
    const hash = createHash("sha256").update(token).digest("hex");
    db.prepare("INSERT INTO magic_tokens (id, email, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?, ?)")
      .run(randomUUID(), email, hash, new Date(Date.now() + 15 * 60_000).toISOString(), now());
    const link = `/auth/verify?token=${token}`;
    app.log.info({ email }, "magic link created");
    return opts.showDevLink ? { ok: true, devLink: link } : { ok: true };
  });

  app.post(`${P}/auth/verify`, async (req, reply) => {
    const { token } = VerifyBody.parse(req.body);
    const hash = createHash("sha256").update(token).digest("hex");
    const row = db.prepare("SELECT * FROM magic_tokens WHERE token_hash = ?").get(hash) as Record<string, any> | undefined;
    if (!row || row.used_at || row.expires_at < now()) throw new HttpError(400, "invalid_token", "This sign-in link is invalid or has expired");
    db.prepare("UPDATE magic_tokens SET used_at = ? WHERE id = ?").run(now(), row.id);
    let user = db.prepare("SELECT * FROM users WHERE email = ?").get(row.email) as Record<string, any> | undefined;
    if (!user) {
      const id = randomUUID();
      db.prepare("INSERT INTO users (id, email, created_at, updated_at) VALUES (?, ?, ?, ?)").run(id, row.email, now(), now());
      user = userRow(id)!;
    }
    await setSession(reply, user.id);
    return toUser(user);
  });

  app.post(`${P}/auth/logout`, async (_req, reply) => { reply.clearCookie(COOKIE, { path: "/" }); return { ok: true }; });

  // ---- profile ----
  app.get(`${P}/me`, async (req) => toUser(userRow(await requireUser(req))!));

  app.patch(`${P}/me`, async (req) => {
    const uid = await requireUser(req);
    const body = ProfilePatch.parse(req.body);
    const set: Record<string, unknown> = {};
    const blankToNull = (v: string | null | undefined) => (v === undefined ? undefined : v && v.trim() ? v.trim() : null);
    if (body.name !== undefined) set.name = body.name;
    for (const [k, col] of [["headline", "headline"], ["company", "company"], ["jobTitle", "job_title"], ["website", "website"], ["phone", "phone"], ["timezone", "timezone"]] as const) {
      const v = blankToNull(body[k]); if (v !== undefined) set[col] = v;
    }
    const li = blankToNull(body.linkedinUrl);
    if (li !== undefined) {
      if (li === null) set.linkedin_url = null;
      else {
        const n = normalizeLinkedin(li);
        if (!n) throw new HttpError(422, "invalid_linkedin", "LinkedIn URL must look like linkedin.com/in/your-name");
        set.linkedin_url = n;
      }
    }
    const ig = blankToNull(body.instagramHandle);
    if (ig !== undefined) {
      if (ig === null) set.instagram_handle = null;
      else {
        const n = normalizeInstagram(ig);
        if (!n) throw new HttpError(422, "invalid_instagram", "Instagram handle can only contain letters, digits, dots and underscores (max 30)");
        set.instagram_handle = n;
      }
    }
    for (const [k, col] of [["avatarKey", "avatar_key"], ["businessCardKey", "business_card_key"]] as const) {
      const v = blankToNull(body[k]);
      if (v === undefined) continue;
      if (v !== null && !v.startsWith(`u/${uid}/`)) throw new HttpError(422, "invalid_key", "Invalid upload key");
      set[col] = v;
    }
    const cols = Object.keys(set);
    if (cols.length) {
      db.prepare(`UPDATE users SET ${cols.map((c) => `${c} = ?`).join(", ")}, updated_at = ? WHERE id = ?`)
        .run(...(Object.values(set) as any[]), now(), uid);
    }
    return toUser(userRow(uid)!);
  });

  app.delete(`${P}/me`, async (req, reply) => {
    const uid = await requireUser(req);
    db.prepare("DELETE FROM users WHERE id = ?").run(uid);
    rmSync(join(opts.uploadsDir, "u", uid), { recursive: true, force: true });
    reply.clearCookie(COOKIE, { path: "/" });
    return { ok: true };
  });

  // ---- uploads (POC: stored on local disk instead of S3) ----
  app.post(`${P}/uploads`, async (req) => {
    const uid = await requireUser(req);
    const body = UploadBody.parse(req.body);
    const buf = Buffer.from(body.dataBase64, "base64");
    if (buf.length > 2 * 1024 * 1024) throw new HttpError(413, "too_large", "Image must be under 2 MB");
    const ext = body.contentType === "image/webp" ? "webp" : "jpg";
    const folder = body.kind === "avatar" ? "avatar" : body.kind === "business_card" ? "card" : `c/${z.string().uuid().parse((req.query as any).connectionId)}`;
    const key = `u/${uid}/${folder}/${randomUUID()}.${ext}`;
    const path = join(opts.uploadsDir, key);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, buf);
    return { key, url: fileUrl(key) };
  });

  app.get(`${P}/files/*`, async (req, reply) => {
    await requireUser(req);
    const key = (req.params as { "*": string })["*"];
    if (!KEY_RE.test(key)) throw new HttpError(404, "not_found", "Not found");
    const path = join(opts.uploadsDir, key);
    if (!existsSync(path)) throw new HttpError(404, "not_found", "Not found");
    reply.header("cache-control", "private, max-age=3600").type(key.endsWith(".webp") ? "image/webp" : "image/jpeg");
    return readFileSync(path);
  });

  // ---- events ----
  const toEvent = (r: Record<string, any>) => ({ id: r.id, name: r.name, startsOn: r.starts_on, placeLabel: r.place_label, createdAt: r.created_at });
  const ownEvent = (uid: string, id: string) => db.prepare("SELECT * FROM events WHERE id = ? AND owner_id = ?").get(id, uid) as Record<string, any> | undefined;

  app.get(`${P}/events`, async (req) => {
    const uid = await requireUser(req);
    return (db.prepare("SELECT * FROM events WHERE owner_id = ? ORDER BY created_at DESC LIMIT 100").all(uid) as any[]).map(toEvent);
  });
  app.post(`${P}/events`, async (req) => {
    const uid = await requireUser(req);
    const b = EventBody.parse(req.body);
    const id = randomUUID();
    db.prepare("INSERT INTO events (id, owner_id, name, starts_on, place_label, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
      .run(id, uid, b.name, b.startsOn || null, b.placeLabel || null, now(), now());
    return toEvent(ownEvent(uid, id)!);
  });

  // ---- exchange ----
  app.post(`${P}/exchange/token`, async (req) => {
    const uid = await requireUser(req);
    const { eventId } = TokenBody.parse(req.body ?? {});
    const value: XchgValue = { userId: uid };
    if (eventId) {
      const ev = ownEvent(uid, eventId);
      if (!ev) throw new HttpError(404, "not_found", "Event not found");
      Object.assign(value, { eventId: ev.id, eventName: ev.name, placeLabel: ev.place_label, startsOn: ev.starts_on });
    }
    const token = randomBytes(17).toString("base64url").slice(0, 22);
    xchg.set(token, value, 300);
    return { token, url: `${opts.appUrl}/x/${token}`, expiresAt: new Date(Date.now() + 300_000).toISOString() };
  });

  app.get(`${P}/exchange/token/:token/status`, async (req) => {
    await requireUser(req);
    const { token } = req.params as { token: string };
    const connectionId = xchgResult.get(token);
    if (connectionId) return { status: "redeemed", connectionId };
    return xchg.get(token) ? { status: "waiting" } : { status: "expired" };
  });

  app.post(`${P}/exchange/redeem`, async (req) => {
    const scanner = await requireUser(req);
    const b = RedeemBody.parse(req.body);
    const t = xchg.get(b.token);
    if (!t) throw new HttpError(410, "token_expired", "This QR code has expired. Ask them to show a fresh one.");
    if (t.userId === scanner) throw new HttpError(400, "self_exchange", "You can't exchange cards with yourself");
    const owner = t.userId;

    db.exec("BEGIN");
    try {
      // Rule 2: scanner's event
      let scannerEvent: Record<string, any> | undefined;
      if (b.eventId) scannerEvent = ownEvent(scanner, b.eventId);
      if (!scannerEvent && t.eventName) {
        const since = new Date(Date.now() - 7 * 86400_000).toISOString();
        scannerEvent = db.prepare("SELECT * FROM events WHERE owner_id = ? AND lower(trim(name)) = lower(trim(?)) AND created_at >= ? ORDER BY created_at DESC LIMIT 1")
          .get(scanner, t.eventName, since) as Record<string, any> | undefined;
        if (!scannerEvent) {
          const id = randomUUID();
          db.prepare("INSERT INTO events (id, owner_id, name, starts_on, place_label, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
            .run(id, scanner, t.eventName, t.startsOn ?? null, t.placeLabel ?? null, now(), now());
          scannerEvent = ownEvent(scanner, id);
        }
      }
      const upsert = (ownerId: string, contactId: string, eventId: string | null, place: string | null) => {
        const existing = db.prepare("SELECT * FROM connections WHERE owner_id = ? AND contact_id = ?").get(ownerId, contactId) as Record<string, any> | undefined;
        const ts = now();
        if (existing) {
          const stale = Date.now() - Date.parse(existing.met_at) > 24 * 3600_000;
          db.prepare(`UPDATE connections SET met_at = ?, event_id = COALESCE(?, event_id), place_label = COALESCE(?, place_label),
            lat = COALESCE(?, lat), lng = COALESCE(?, lng), archived_at = NULL, updated_at = ? WHERE id = ?`)
            .run(stale ? ts : existing.met_at, eventId, place, b.lat ?? null, b.lng ?? null, ts, existing.id);
          return existing.id as string;
        }
        const id = randomUUID();
        db.prepare(`INSERT INTO connections (id, owner_id, contact_id, event_id, met_at, lat, lng, place_label, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(id, ownerId, contactId, eventId, ts, b.lat ?? null, b.lng ?? null, place, ts, ts);
        return id;
      };
      const ownerConn = upsert(owner, scanner, t.eventId ?? null, t.placeLabel ?? null);
      const scannerConn = upsert(scanner, owner, scannerEvent?.id ?? null, scannerEvent?.place_label ?? null);
      db.exec("COMMIT");
      xchg.delete(b.token);
      xchgResult.set(b.token, ownerConn, 600);
      return { ...getConnection(scanner, scannerConn)!, eventId: scannerEvent?.id ?? null };
    } catch (e) {
      db.exec("ROLLBACK");
      throw e;
    }
  });

  // ---- connections ----
  const CONN_SELECT = `SELECT c.*, e.name AS event_name, u.name AS u_name, u.email AS u_email, u.headline AS u_headline, u.company AS u_company,
    u.job_title AS u_job_title, u.website AS u_website, u.phone AS u_phone, u.linkedin_url AS u_linkedin_url,
    u.linkedin_verified AS u_linkedin_verified, u.instagram_handle AS u_instagram_handle, u.avatar_key AS u_avatar_key,
    u.business_card_key AS u_business_card_key
    FROM connections c JOIN users u ON u.id = c.contact_id LEFT JOIN events e ON e.id = c.event_id`;
  const toConn = (r: Record<string, any>): Connection => ({
    id: r.id, metAt: r.met_at, lat: r.lat, lng: r.lng, placeLabel: r.place_label, note: r.note,
    photoKey: r.photo_key, photoUrl: fileUrl(r.photo_key), eventId: r.event_id, eventName: r.event_name ?? null,
    linkedinClickedAt: r.linkedin_clicked_at, instagramClickedAt: r.instagram_clicked_at,
    contact: {
      id: r.contact_id, name: r.u_name, email: r.u_email, headline: r.u_headline, company: r.u_company, jobTitle: r.u_job_title,
      website: r.u_website, phone: r.u_phone, linkedinUrl: r.u_linkedin_url, linkedinVerified: !!r.u_linkedin_verified,
      instagramHandle: r.u_instagram_handle, avatarUrl: fileUrl(r.u_avatar_key), businessCardUrl: fileUrl(r.u_business_card_key),
    },
  });
  function getConnection(uid: string, id: string) {
    const r = db.prepare(`${CONN_SELECT} WHERE c.id = ? AND c.owner_id = ?`).get(id, uid) as Record<string, any> | undefined;
    return r ? toConn(r) : undefined;
  }

  app.get(`${P}/connections`, async (req) => {
    const uid = await requireUser(req);
    const q = z.object({
      q: z.string().trim().max(100).optional(), eventId: z.string().optional(), cursor: z.string().optional(),
      limit: z.coerce.number().int().min(1).max(50).default(20),
    }).parse(req.query);
    const where = ["c.owner_id = ?", "c.archived_at IS NULL"];
    const args: any[] = [uid];
    if (q.q) {
      where.push("(lower(u.name) LIKE ? OR lower(coalesce(u.company,'')) LIKE ? OR lower(coalesce(c.note,'')) LIKE ?)");
      const like = `%${q.q.toLowerCase()}%`; args.push(like, like, like);
    }
    if (q.eventId) { where.push("c.event_id = ?"); args.push(q.eventId); }
    if (q.cursor) {
      const [metAt, id] = Buffer.from(q.cursor, "base64url").toString().split("|");
      where.push("(c.met_at < ? OR (c.met_at = ? AND c.id < ?))"); args.push(metAt, metAt, id);
    }
    const rows = db.prepare(`${CONN_SELECT} WHERE ${where.join(" AND ")} ORDER BY c.met_at DESC, c.id DESC LIMIT ?`).all(...args, q.limit + 1) as any[];
    const items = rows.slice(0, q.limit).map(toConn);
    const last = items[items.length - 1];
    return { items, nextCursor: rows.length > q.limit && last ? Buffer.from(`${last.metAt}|${last.id}`).toString("base64url") : null };
  });

  app.get(`${P}/connections/:id`, async (req) => {
    const uid = await requireUser(req);
    const c = getConnection(uid, (req.params as { id: string }).id);
    if (!c) throw new HttpError(404, "not_found", "Connection not found");
    return c;
  });

  app.patch(`${P}/connections/:id`, async (req) => {
    const uid = await requireUser(req);
    const id = (req.params as { id: string }).id;
    if (!getConnection(uid, id)) throw new HttpError(404, "not_found", "Connection not found");
    const b = ConnectionPatch.parse(req.body);
    const set: Record<string, unknown> = {};
    if (b.note !== undefined) set.note = b.note || null;
    if (b.placeLabel !== undefined) set.place_label = b.placeLabel || null;
    if (b.eventId !== undefined) {
      if (b.eventId && !ownEvent(uid, b.eventId)) throw new HttpError(404, "not_found", "Event not found");
      set.event_id = b.eventId || null;
    }
    if (b.photoKey !== undefined) {
      if (b.photoKey && !b.photoKey.startsWith(`u/${uid}/c/${id}/`)) throw new HttpError(422, "invalid_key", "Invalid upload key");
      set.photo_key = b.photoKey || null;
    }
    if (b.archived !== undefined) set.archived_at = b.archived ? now() : null;
    const cols = Object.keys(set);
    if (cols.length) db.prepare(`UPDATE connections SET ${cols.map((c) => `${c} = ?`).join(", ")}, updated_at = ? WHERE id = ?`).run(...(Object.values(set) as any[]), now(), id);
    return getConnection(uid, id);
  });

  app.post(`${P}/connections/:id/click`, async (req) => {
    const uid = await requireUser(req);
    const id = (req.params as { id: string }).id;
    const { network } = ClickBody.parse(typeof req.body === "string" ? JSON.parse(req.body) : req.body);
    const col = network === "linkedin" ? "linkedin_clicked_at" : "instagram_clicked_at";
    db.prepare(`UPDATE connections SET ${col} = COALESCE(${col}, ?) WHERE id = ? AND owner_id = ?`).run(now(), id, uid);
    return { ok: true };
  });

  // ---- web app (built SPA) ----
  if (opts.webDist && existsSync(opts.webDist)) {
    await app.register(fstatic, { root: resolve(opts.webDist), wildcard: false });
    app.setNotFoundHandler((req, reply) => {
      if (req.url.startsWith("/api/")) return reply.status(404).send({ error: { code: "not_found", message: "Not found" } });
      return reply.sendFile("index.html");
    });
  }

  app.addHook("onClose", async () => db.close());
  return app;
}
