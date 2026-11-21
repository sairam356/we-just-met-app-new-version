export const linkedinHref = (url: string) => url;
export const instagramHref = (handle: string) => `https://www.instagram.com/${handle}/`;

export function trackClick(connectionId: string, network: "linkedin" | "instagram") {
  const body = JSON.stringify({ network });
  const url = `/api/v1/connections/${connectionId}/click`;
  fetch(url, { method: "POST", credentials: "include", keepalive: true, headers: { "content-type": "application/json" }, body }).catch(() => {});
}
