import { NavLink, Outlet } from "react-router-dom";

const tabs = [
  { to: "/", label: "Contacts", icon: "M17 20h5v-2a4 4 0 0 0-5-3.9M9 20H2v-2a4 4 0 0 1 4-4h2a4 4 0 0 1 4 4v2M12 7a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm8 1a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0Z" },
  { to: "/qr", label: "My QR", icon: "M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h2v2h-2zM18 14h2v2h-2zM14 18h2v2h-2zM18 18h2v2h-2z" },
  { to: "/profile", label: "Profile", icon: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 8a7 7 0 0 1 14 0" },
];

export function Layout() {
  return (
    <div className="mx-auto flex min-h-dvh max-w-[480px] flex-col bg-slate-50">
      <main className="flex-1 px-4 pb-24 pt-4"><Outlet /></main>
      <nav className="fixed bottom-0 left-1/2 z-10 flex w-full max-w-[480px] -translate-x-1/2 border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)]">
        {tabs.map((t) => (
          <NavLink key={t.to} to={t.to} end className={({ isActive }) => `flex flex-1 flex-col items-center gap-0.5 py-2 text-xs ${isActive ? "text-indigo-600" : "text-slate-500"}`}>
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d={t.icon} /></svg>
            {t.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

export function Spinner() {
  return <div className="flex justify-center py-10"><div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-600" /></div>;
}

export function ErrorText({ error }: { error: unknown }) {
  if (!error) return null;
  return <p className="mt-2 text-sm text-red-600">{error instanceof Error ? error.message : String(error)}</p>;
}
