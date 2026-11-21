const KEY = "wjm_active_event";
const TWELVE_H = 12 * 3600_000;

export function getActiveEventId(): string | null {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "null") as { id: string; at: number } | null;
    return v && Date.now() - v.at < TWELVE_H ? v.id : null;
  } catch { return null; }
}
export function setActiveEventId(id: string | null) {
  if (id) localStorage.setItem(KEY, JSON.stringify({ id, at: Date.now() }));
  else localStorage.removeItem(KEY);
}
