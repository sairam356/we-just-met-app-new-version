# We Just Met — POC

Meet someone, show your QR, they scan it with their phone camera, and you both get each other's contact card
(with event, place, photo and note), plus one-tap LinkedIn / Instagram buttons.

This is a simplified **proof of concept** that runs on one machine with zero external services or keys.

## Run

```bash
npm install
npm run build   # builds the web app into web/dist
npm start       # API + web app on http://localhost:4000
```

Dev mode with hot reload: `npm run dev` (web on :5173, proxies /api to :4000).
Tests: `npm test`.

## What's in

- Magic-link sign-in (POC: the link is shown on screen instead of emailed)
- Profile + onboarding (LinkedIn URL / Instagram handle normalised server-side), avatar, business card image
- My QR with active event ("Where are you?"), 5-min single-use token, auto-refresh, status polling
- Redeem (`/x/:token`) with optional geolocation; event carried to both people (plan §16.2 rules)
- Contact card (front/back flip, full-screen business card), list/card view, search, event filter, cursor pagination
- Connection detail: photo (client-side compressed), event, place, note, vCard download, save card as PNG
- LinkedIn / Instagram deep-link buttons with click tracking (no automation/scraping)
- Account deletion, installable PWA

## POC simplifications vs. the full plan

| Full plan | POC |
|---|---|
| Postgres + Prisma | SQLite (`node:sqlite`), file at `server/data/wjm.sqlite` |
| Redis (exchange tokens, rate limits) | In-memory TTL store; no rate limits |
| S3/R2 presigned uploads | Images stored in the database, served only to signed-in users |
| Resend / Mailpit email | Magic link shown on screen |
| BullMQ reminder worker | Not included |
| LinkedIn OIDC sign-in | Not included |

## Environment variables (all optional)

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `4000` | Server port |
| `DATA_DIR` | `server/data` | SQLite DB, uploads, generated session secret |
| `SESSION_SECRET` | auto-generated | JWT signing secret |
| `SHOW_DEV_LINK` | `true` | Show the magic link on screen |

## Deploy (Vercel)

One Vercel project: `web/` builds to `web/dist`, and `api/index.js` is a single Vercel Function that serves `/api/*` from the Fastify app bundled by `npm run build:vercel`.

Set `DATABASE_URL` (Postgres, for example Neon) and `SESSION_SECRET`. With a `postgres://` URL the app uses Postgres for data, QR tokens and images; without it, it uses the local SQLite file. Tables are created on first start.

Run the tests against Postgres with `TEST_DATABASE_URL=postgres://... npm test`.
