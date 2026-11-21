import { CardDesign, type User } from "@wjm/shared";

export type DesignCard = (profile: Pick<User, "name" | "headline" | "company" | "jobTitle" | "website">) => Promise<CardDesign>;

const PROMPT = `You design business cards. Given a person's profile as JSON, reply with ONLY a JSON object:
{"layout": "left" | "center" | "split", "background": "#rrggbb", "background2": "#rrggbb", "text": "#rrggbb", "accent": "#rrggbb", "font": "sans" | "serif" | "mono", "tagline": string}
- background and background2 form a gradient; they may be equal for a flat colour.
- text must contrast strongly with both background colours; accent is used for the company name and a thin rule.
- Pick a style that suits the person's industry and role.
- tagline: at most 60 characters, derived only from the profile. Use "" if the profile gives too little to go on. Never invent facts, awards or numbers.`;

/** Asks Claude for a card design (colours, layout, tagline). The card itself is drawn by the web app, so names and numbers are never misspelled. */
export const anthropicDesigner = (apiKey: string, model: string): DesignCard => async (profile) => {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model, max_tokens: 300, system: PROMPT, messages: [{ role: "user", content: JSON.stringify(profile) }] }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`Anthropic API returned ${res.status}`);
  const text = ((await res.json()) as { content: { type: string; text?: string }[] }).content.find((c) => c.type === "text")?.text ?? "";
  return CardDesign.parse(JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1)));
};
