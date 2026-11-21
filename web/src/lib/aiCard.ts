import type { CardDesign, User } from "@wjm/shared";

const W = 1600, H = 1000, PAD = 110;
const FONTS = { sans: "system-ui, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif", serif: "Georgia, 'Times New Roman', serif", mono: "ui-monospace, Menlo, Consolas, monospace" };

/** Draws the business card image from the AI's design and the profile's own text. */
export function drawCard(d: CardDesign, me: User): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, d.background); g.addColorStop(1, d.background2);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

  const center = d.layout === "center";
  let left = PAD, maxW = W - 2 * PAD;
  if (d.layout === "split") { ctx.fillStyle = d.accent; ctx.fillRect(0, 0, 36, H); left = PAD + 36; maxW -= 36; }
  ctx.textAlign = center ? "center" : "left";
  ctx.textBaseline = "alphabetic";
  const x = center ? W / 2 : left;
  const line = (text: string, y: number, size: number, color: string, weight = 400, alpha = 1) => {
    do { ctx.font = `${weight} ${size}px ${FONTS[d.font]}`; size -= 4; } while (ctx.measureText(text).width > maxW && size > 24);
    ctx.globalAlpha = alpha; ctx.fillStyle = color; ctx.fillText(text, x, y); ctx.globalAlpha = 1;
  };

  line(me.name, 300, 124, d.text, 700);
  const role = [me.jobTitle, me.company].filter(Boolean).join(" · ") || me.headline || "";
  if (role) line(role, 390, 58, d.accent, 600);
  ctx.fillStyle = d.accent;
  ctx.fillRect(center ? W / 2 - 80 : left, 440, 160, 8);
  if (d.tagline) line(d.tagline, 540, 50, d.text, 400, 0.85);

  const contact = [me.phone, me.email, me.website?.replace(/^https?:\/\//, ""), me.linkedinUrl?.replace(/^https?:\/\/(www\.)?/, ""), me.instagramHandle && `@${me.instagramHandle}`].filter(Boolean) as string[];
  contact.slice(0, 4).reverse().forEach((t, i) => line(t, H - PAD - i * 68, 44, d.text, 400, 0.9));

  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not draw the card"))), "image/jpeg", 0.9));
}
