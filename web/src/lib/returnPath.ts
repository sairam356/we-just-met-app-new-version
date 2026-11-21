const KEY = "wjm_return_path";
export const saveReturnPath = (p: string) => sessionStorage.setItem(KEY, p);
export function popReturnPath(): string {
  const p = sessionStorage.getItem(KEY) ?? localStorage.getItem(KEY);
  sessionStorage.removeItem(KEY);
  localStorage.removeItem(KEY);
  return p && p.startsWith("/") ? p : "/";
}
export const saveReturnPathDurable = (p: string) => { sessionStorage.setItem(KEY, p); localStorage.setItem(KEY, p); };
