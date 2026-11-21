import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { normalizeInstagram, normalizeLinkedin } from "@wjm/shared";
import { buildApp } from "../src/app.js";

type App = Awaited<ReturnType<typeof buildApp>>;
let app: App;

async function signIn(email: string, name: string) {
  const ml = await app.inject({ method: "POST", url: "/api/v1/auth/magic-link", payload: { email } });
  const token = new URL(ml.json().devLink, "http://x").searchParams.get("token");
  const v = await app.inject({ method: "POST", url: "/api/v1/auth/verify", payload: { token } });
  const cookie = v.cookies.find((c) => c.name === "wjm_session")!;
  const headers = { cookie: `wjm_session=${cookie.value}` };
  await app.inject({ method: "PATCH", url: "/api/v1/me", headers, payload: { name, linkedinUrl: `linkedin.com/in/${name.toLowerCase()}-x/` } });
  return headers;
}

beforeAll(async () => {
  const dir = mkdtempSync(join(tmpdir(), "wjm-"));
  app = await buildApp({ db: process.env.TEST_DATABASE_URL ?? join(dir, "t.sqlite"), appUrl: "http://app", sessionSecret: "x".repeat(32), showDevLink: true,
    geocode: async () => "Detected Place",
    designCard: async () => ({ layout: "left", background: "#111111", background2: "#222222", text: "#ffffff", accent: "#ffcc00", font: "sans", tagline: "Hi" }) });
});
afterAll(() => app.close());

describe("normalisation", () => {
  it("linkedin", () => {
    expect(normalizeLinkedin("https://linkedin.com/in/jane-doe/?trk=1")).toBe("https://www.linkedin.com/in/jane-doe");
    expect(normalizeLinkedin("www.linkedin.com/in/ab")).toBeNull();
    expect(normalizeLinkedin("https://twitter.com/x")).toBeNull();
  });
  it("instagram", () => {
    expect(normalizeInstagram("@Jane.Doe_")).toBe("jane.doe_");
    expect(normalizeInstagram("bad handle!")).toBeNull();
  });
});

describe("flows", () => {
  it("magic link is single use", async () => {
    const ml = await app.inject({ method: "POST", url: "/api/v1/auth/magic-link", payload: { email: "once@x.com" } });
    const token = new URL(ml.json().devLink, "http://x").searchParams.get("token");
    expect((await app.inject({ method: "POST", url: "/api/v1/auth/verify", payload: { token } })).statusCode).toBe(200);
    expect((await app.inject({ method: "POST", url: "/api/v1/auth/verify", payload: { token } })).statusCode).toBe(400);
  });

  it("rejects invalid linkedin with 422", async () => {
    const h = await signIn("bad@x.com", "Bad");
    const r = await app.inject({ method: "PATCH", url: "/api/v1/me", headers: h, payload: { linkedinUrl: "facebook.com/me" } });
    expect(r.statusCode).toBe(422);
  });

  it("exchange with event, reuse, isolation, self exchange", async () => {
    const a = await signIn("a@x.com", "Alice");
    const b = await signIn("b@x.com", "Bob");
    const c = await signIn("c@x.com", "Carol");
    const ev = (await app.inject({ method: "POST", url: "/api/v1/events", headers: a, payload: { name: "Demo Summit", placeLabel: "Dubai" } })).json();
    const tok = (await app.inject({ method: "POST", url: "/api/v1/exchange/token", headers: a, payload: { eventId: ev.id } })).json();
    expect(tok.token).toHaveLength(22);

    expect((await app.inject({ method: "POST", url: "/api/v1/exchange/redeem", headers: a, payload: { token: tok.token } })).json().error.code).toBe("self_exchange");

    const r = await app.inject({ method: "POST", url: "/api/v1/exchange/redeem", headers: b, payload: { token: tok.token, lat: 25.2, lng: 55.3 } });
    expect(r.statusCode).toBe(200);
    const bConn = r.json();
    expect(bConn.contact.name).toBe("Alice");
    expect(bConn.eventName).toBe("Demo Summit");
    expect(bConn.placeLabel).toBe("Dubai");
    expect(bConn.lat).toBe(25.2);

    const st = (await app.inject({ url: `/api/v1/exchange/token/${tok.token}/status`, headers: a })).json();
    expect(st.status).toBe("redeemed");
    const aConn = (await app.inject({ url: `/api/v1/connections/${st.connectionId}`, headers: a })).json();
    expect(aConn.contact.name).toBe("Bob");
    expect(aConn.eventName).toBe("Demo Summit");
    expect(aConn.lat).toBe(25.2);

    expect((await app.inject({ method: "POST", url: "/api/v1/exchange/redeem", headers: b, payload: { token: tok.token } })).statusCode).toBe(410);

    // second scan at same event reuses scanner's event
    const tok2 = (await app.inject({ method: "POST", url: "/api/v1/exchange/token", headers: c, payload: {} })).json();
    const ev2 = (await app.inject({ method: "POST", url: "/api/v1/events", headers: c, payload: { name: " demo summit " } })).json();
    const tok3 = (await app.inject({ method: "POST", url: "/api/v1/exchange/token", headers: c, payload: { eventId: ev2.id } })).json();
    await app.inject({ method: "POST", url: "/api/v1/exchange/redeem", headers: b, payload: { token: tok3.token } });
    const bEvents = (await app.inject({ url: "/api/v1/events", headers: b })).json();
    expect(bEvents).toHaveLength(1);
    expect(tok2.token).toBeTruthy();

    // ownership isolation
    expect((await app.inject({ url: `/api/v1/connections/${bConn.id}`, headers: c })).statusCode).toBe(404);
    expect((await app.inject({ url: "/api/v1/connections?q=alice", headers: b })).json().items).toHaveLength(1);
    expect(bConn.contact.businessCardUrl).toBeNull();
  });

  it("requires auth", async () => {
    expect((await app.inject({ url: "/api/v1/connections" })).statusCode).toBe(401);
  });

  it("fills the place from GPS when the event has none, and designs a card", async () => {
    const a = await signIn("geo-a@x.com", "Gina");
    const b = await signIn("geo-b@x.com", "Hari");
    const tok = (await app.inject({ method: "POST", url: "/api/v1/exchange/token", headers: a, payload: {} })).json();
    const r = (await app.inject({ method: "POST", url: "/api/v1/exchange/redeem", headers: b, payload: { token: tok.token, lat: 25.2, lng: 55.3 } })).json();
    expect(r.placeLabel).toBe("Detected Place");
    const st = (await app.inject({ url: `/api/v1/exchange/token/${tok.token}/status`, headers: a })).json();
    expect((await app.inject({ url: `/api/v1/connections/${st.connectionId}`, headers: a })).json().placeLabel).toBe("Detected Place");
    expect((await app.inject({ url: "/api/v1/geo/reverse?lat=25.2&lng=55.3", headers: a })).json().placeLabel).toBe("Detected Place");
    expect((await app.inject({ method: "POST", url: "/api/v1/me/card-design", headers: a })).json().accent).toBe("#ffcc00");
  });
  it("a photo taken together goes on both cards and only those two can open it", async () => {
    const a = await signIn("ph-a@x.com", "Pia");
    const b = await signIn("ph-b@x.com", "Raj");
    const c = await signIn("ph-c@x.com", "Sam");
    const tok = (await app.inject({ method: "POST", url: "/api/v1/exchange/token", headers: a, payload: {} })).json();
    const bConn = (await app.inject({ method: "POST", url: "/api/v1/exchange/redeem", headers: b, payload: { token: tok.token } })).json();
    const aId = (await app.inject({ url: `/api/v1/exchange/token/${tok.token}/status`, headers: a })).json().connectionId;
    const bytes = Buffer.from([0xff, 0xd8, 0xff, 0xd9, 1, 2, 3]);
    const up = (await app.inject({ method: "POST", url: `/api/v1/uploads?connectionId=${bConn.id}`, headers: b, payload: { kind: "connection", contentType: "image/jpeg", dataBase64: bytes.toString("base64") } })).json();
    await app.inject({ method: "PATCH", url: `/api/v1/connections/${bConn.id}`, headers: b, payload: { photoKey: up.key } });
    const aConn = (await app.inject({ url: `/api/v1/connections/${aId}`, headers: a })).json();
    expect(aConn.photoKey).toBe(up.key);
    expect(Buffer.compare((await app.inject({ url: aConn.photoUrl, headers: a })).rawPayload, bytes)).toBe(0);
    expect((await app.inject({ url: aConn.photoUrl, headers: c })).statusCode).toBe(404);
    // removing it from one card leaves the other
    await app.inject({ method: "PATCH", url: `/api/v1/connections/${aId}`, headers: a, payload: { photoKey: null } });
    expect((await app.inject({ url: `/api/v1/connections/${bConn.id}`, headers: b })).json().photoKey).toBe(up.key);
    expect((await app.inject({ url: up.url, headers: a })).statusCode).toBe(404);
  });
});
