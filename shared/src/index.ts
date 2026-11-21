import { z } from "zod";

const LINKEDIN_RE = /^(?:https?:\/\/)?(?:[a-z]{2,3}\.)?(?:www\.)?linkedin\.com\/in\/([A-Za-z0-9\-_%]{3,100})\/?(?:[?#].*)?$/i;

export function normalizeLinkedin(input: string): string | null {
  const m = input.trim().match(LINKEDIN_RE);
  return m ? `https://www.linkedin.com/in/${m[1]}` : null;
}

export function normalizeInstagram(input: string): string | null {
  let h = input.trim();
  const url = h.match(/instagram\.com\/([^/?#]+)/i);
  if (url) h = url[1];
  h = h.replace(/^@/, "").toLowerCase();
  return /^[a-z0-9._]{1,30}$/.test(h) ? h : null;
}

const opt = (max = 200) => z.string().trim().max(max).optional().nullable();

export const MagicLinkBody = z.object({ email: z.string().trim().toLowerCase().email() });
export const VerifyBody = z.object({ token: z.string().min(10) });

export const ProfilePatch = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  headline: opt(), company: opt(), jobTitle: opt(), website: opt(), phone: opt(40),
  linkedinUrl: opt(300), instagramHandle: opt(100), avatarKey: opt(), businessCardKey: opt(), timezone: opt(64),
});
export type ProfilePatch = z.infer<typeof ProfilePatch>;

export const User = z.object({
  id: z.string(), email: z.string(), name: z.string(),
  headline: z.string().nullable(), company: z.string().nullable(), jobTitle: z.string().nullable(),
  website: z.string().nullable(), phone: z.string().nullable(), linkedinUrl: z.string().nullable(),
  linkedinVerified: z.boolean(), instagramHandle: z.string().nullable(),
  avatarKey: z.string().nullable(), avatarUrl: z.string().nullable(),
  businessCardKey: z.string().nullable(), businessCardUrl: z.string().nullable(),
});
export type User = z.infer<typeof User>;

export const UploadBody = z.object({
  kind: z.enum(["avatar", "connection", "business_card", "exchange"]),
  contentType: z.enum(["image/jpeg", "image/webp"]),
  dataBase64: z.string().max(3_000_000),
});
export type UploadBody = z.infer<typeof UploadBody>;

export const EventBody = z.object({ name: z.string().trim().min(1).max(120), startsOn: opt(20), placeLabel: opt() });
export type EventBody = z.infer<typeof EventBody>;
export const Event = z.object({ id: z.string(), name: z.string(), startsOn: z.string().nullable(), placeLabel: z.string().nullable(), createdAt: z.string() });
export type Event = z.infer<typeof Event>;

export const TokenBody = z.object({ eventId: z.string().optional().nullable() });
export const TokenResponse = z.object({ token: z.string(), url: z.string(), expiresAt: z.string() });
export type TokenResponse = z.infer<typeof TokenResponse>;
export type TokenStatus =
  | { status: "waiting" }
  | { status: "redeemed"; connectionId: string; memoryPhotoIncluded: boolean }
  | { status: "expired" };

export const RedeemBody = z.object({
  token: z.string().min(10), lat: z.number().optional(), lng: z.number().optional(), eventId: z.string().optional().nullable(),
});

export const ConnectionPatch = z.object({
  note: z.string().max(2000).optional().nullable(), eventId: z.string().optional().nullable(),
  placeLabel: opt(), photoKey: opt(), archived: z.boolean().optional(),
});
export type ConnectionPatch = z.infer<typeof ConnectionPatch>;
export const ClickBody = z.object({ network: z.enum(["linkedin", "instagram"]) });

export type Contact = Omit<User, "email" | "avatarKey" | "businessCardKey"> & { email: string | null };
export type Connection = {
  id: string; metAt: string; lat: number | null; lng: number | null; placeLabel: string | null; note: string | null;
  photoUrl: string | null; photoKey: string | null; eventId: string | null; eventName: string | null;
  linkedinClickedAt: string | null; instagramClickedAt: string | null; contact: Contact;
};
export type ExchangeResult = Connection & { memoryPhotoIncluded: boolean };
export type ConnectionList = { items: Connection[]; nextCursor: string | null };
export type ApiError = { error: { code: string; message: string } };

const Hex = z.string().regex(/^#[0-9a-fA-F]{6}$/);
export const CardDesign = z.object({
  layout: z.enum(["left", "center", "split"]), background: Hex, background2: Hex, text: Hex, accent: Hex,
  font: z.enum(["sans", "serif", "mono"]), tagline: z.string().max(80),
});
export type CardDesign = z.infer<typeof CardDesign>;
