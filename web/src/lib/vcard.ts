import type { Contact } from "@wjm/shared";

const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/([,;])/g, "\\$1");

export function buildVCard(c: Contact, note?: string | null): string {
  const lines = ["BEGIN:VCARD", "VERSION:3.0", `FN:${esc(c.name)}`, `N:${esc(c.name)};;;;`];
  if (c.company) lines.push(`ORG:${esc(c.company)}`);
  if (c.jobTitle || c.headline) lines.push(`TITLE:${esc(c.jobTitle || c.headline || "")}`);
  if (c.phone) lines.push(`TEL;TYPE=CELL:${esc(c.phone)}`);
  if (c.email) lines.push(`EMAIL:${esc(c.email)}`);
  if (c.website) lines.push(`URL:${esc(c.website)}`);
  if (c.linkedinUrl) lines.push(`X-SOCIALPROFILE;TYPE=linkedin:${c.linkedinUrl}`);
  if (c.instagramHandle) lines.push(`X-SOCIALPROFILE;TYPE=instagram:https://www.instagram.com/${c.instagramHandle}/`);
  if (note) lines.push(`NOTE:${esc(note)}`);
  lines.push("END:VCARD");
  return lines.join("\r\n");
}

export function downloadVCard(c: Contact, note?: string | null) {
  const blob = new Blob([buildVCard(c, note)], { type: "text/vcard" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${c.name.replace(/[^\w ]+/g, "").trim() || "contact"}.vcf`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
