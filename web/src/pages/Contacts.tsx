import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useConnections, useEvents } from "../api/hooks";
import { ContactCard } from "../components/ContactCard";
import { ErrorText, Spinner } from "../components/Layout";

const VIEW_KEY = "wjm_contacts_view";

export default function Contacts() {
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  const [eventId, setEventId] = useState<string | null>(null);
  const [view, setView] = useState<"list" | "grid">(() => (localStorage.getItem(VIEW_KEY) as "grid") || "list");
  const events = useEvents();
  const list = useConnections(debounced, eventId);
  const sentinel = useRef<HTMLDivElement>(null);

  useEffect(() => { const t = setTimeout(() => setDebounced(q.trim()), 250); return () => clearTimeout(t); }, [q]);
  useEffect(() => { localStorage.setItem(VIEW_KEY, view); }, [view]);
  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const io = new IntersectionObserver((e) => { if (e[0]?.isIntersecting && list.hasNextPage && !list.isFetchingNextPage) list.fetchNextPage(); });
    io.observe(el);
    return () => io.disconnect();
  }, [list]);

  const items = list.data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Contacts</h1>
        <div className="flex rounded-lg bg-slate-200 p-0.5 text-xs">
          {(["list", "grid"] as const).map((v) => (
            <button key={v} onClick={() => setView(v)} className={`rounded-md px-2 py-1 ${view === v ? "bg-white shadow" : "text-slate-600"}`}>{v === "list" ? "List" : "Cards"}</button>
          ))}
        </div>
      </div>
      <input className="input" placeholder="Search name, company or note" value={q} onChange={(e) => setQ(e.target.value)} data-testid="contacts-search" />
      {!!events.data?.length && (
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
          <Chip active={!eventId} onClick={() => setEventId(null)}>All</Chip>
          {events.data.map((ev) => <Chip key={ev.id} active={eventId === ev.id} onClick={() => setEventId(ev.id)}>{ev.name}</Chip>)}
        </div>
      )}
      <ErrorText error={list.error} />
      {list.isLoading ? <Spinner /> : items.length === 0 ? (
        <div className="card text-center">
          <p className="font-semibold">{debounced || eventId ? "No matches" : "No contacts yet"}</p>
          {!debounced && !eventId && <><p className="mt-1 text-sm text-slate-600">Show your QR to someone you just met.</p><Link to="/qr" className="btn-primary mt-3">Open My QR</Link></>}
        </div>
      ) : view === "grid" ? (
        <div className="space-y-3">
          {items.map((c) => (
            <Link key={c.id} to={`/c/${c.id}`} className="block">
              <ContactCard contact={c.contact} photoUrl={c.photoUrl} eventName={c.eventName} placeLabel={c.placeLabel} metAt={c.metAt} connectionId={c.id} linkedinClickedAt={c.linkedinClickedAt} instagramClickedAt={c.instagramClickedAt} />
            </Link>
          ))}
        </div>
      ) : (
        <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl bg-white shadow-sm">
          {items.map((c) => {
            const img = c.photoUrl || c.contact.avatarUrl;
            return (
              <li key={c.id}>
                <Link to={`/c/${c.id}`} className="flex items-center gap-3 p-3 hover:bg-slate-50" data-testid="contact-row">
                  <div className="h-12 w-12 shrink-0 overflow-hidden rounded-full bg-indigo-100">
                    {img ? <img src={img} alt="" loading="lazy" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center font-bold text-indigo-400">{c.contact.name.slice(0, 1).toUpperCase()}</div>}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-semibold">{c.contact.name}</div>
                    <div className="truncate text-xs text-slate-600">{[c.contact.headline || c.contact.jobTitle, c.contact.company].filter(Boolean).join(" · ")}</div>
                    <div className="truncate text-[11px] text-slate-500">{[c.eventName, new Date(c.metAt).toLocaleDateString()].filter(Boolean).join(" · ")}</div>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      <div ref={sentinel} />
      {list.isFetchingNextPage && <Spinner />}
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button onClick={onClick} className={`whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium ${active ? "bg-indigo-600 text-white" : "bg-white text-slate-700 ring-1 ring-slate-200"}`}>{children}</button>;
}
