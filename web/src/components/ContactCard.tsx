import { forwardRef, useState } from "react";
import type { Contact } from "@wjm/shared";
import { SocialButtons } from "./SocialButtons";

type Props = {
  contact: Contact;
  photoUrl?: string | null;
  eventName?: string | null;
  placeLabel?: string | null;
  metAt?: string | null;
  connectionId?: string;
  linkedinClickedAt?: string | null;
  instagramClickedAt?: string | null;
  size?: "list" | "full";
};

const initials = (n: string) => n.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join("") || "?";

export const ContactCard = forwardRef<HTMLDivElement, Props>(function ContactCard(p, ref) {
  const [flipped, setFlipped] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const c = p.contact;
  const img = p.photoUrl || c.avatarUrl;
  const footer = [p.eventName && `Met at ${p.eventName}`, p.placeLabel, p.metAt && new Date(p.metAt).toLocaleDateString()].filter(Boolean).join(" · ");
  const full = p.size === "full";

  return (
    <div className="flip w-full">
      <div className={`flip-inner relative w-full ${flipped ? "flipped" : ""}`} style={{ aspectRatio: "1.6 / 1" }}>
        <div ref={ref} className="flip-face absolute inset-0 flex overflow-hidden rounded-2xl bg-gradient-to-br from-white to-indigo-50 shadow-md ring-1 ring-slate-200" data-testid="contact-card">
          <div className="relative h-full w-[38%] shrink-0 bg-indigo-100">
            {img ? (
              <img src={img} alt={c.name} loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
            ) : (
              <div className="flex h-full items-center justify-center text-3xl font-bold text-indigo-400">{initials(c.name)}</div>
            )}
          </div>
          <div className="flex min-w-0 flex-1 flex-col p-3">
            <div className="truncate text-lg font-bold leading-tight text-slate-900">{c.name || "Unnamed"}</div>
            {(c.jobTitle || c.headline) && <div className="truncate text-xs text-slate-600">{c.jobTitle || c.headline}</div>}
            {c.company && <div className="truncate text-xs font-medium text-indigo-700">{c.company}</div>}
            <div className="mt-1 space-y-0.5 text-[11px] text-slate-600">
              {c.phone && <div className="truncate">☎ {c.phone}</div>}
              {c.email && <div className="truncate">✉ {c.email}</div>}
              {full && c.website && <div className="truncate">🔗 {c.website}</div>}
            </div>
            <div className="mt-auto pt-1"><SocialButtons contact={c} connectionId={p.connectionId} linkedinClickedAt={p.linkedinClickedAt} instagramClickedAt={p.instagramClickedAt} compact={!full} /></div>
            {footer && <div className="mt-1 truncate text-[10px] text-slate-500" data-testid="card-footer">{footer}</div>}
          </div>
          {c.businessCardUrl && (
            <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setFlipped(true); }} className="absolute right-2 top-2 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-semibold text-slate-700 shadow" data-html2image-ignore>
              Flip ↻
            </button>
          )}
        </div>
        {c.businessCardUrl && (
          <div className="flip-face flip-back absolute inset-0 overflow-hidden rounded-2xl bg-slate-800 shadow-md">
            <img src={c.businessCardUrl} alt="Business card" className="h-full w-full cursor-zoom-in object-contain" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setFullscreen(true); }} />
            <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setFlipped(false); }} className="absolute right-2 top-2 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-semibold text-slate-700 shadow">Flip ↻</button>
          </div>
        )}
      </div>
      {fullscreen && c.businessCardUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4" onClick={() => setFullscreen(false)}>
          <img src={c.businessCardUrl} alt="Business card" className="max-h-full max-w-full" />
        </div>
      )}
    </div>
  );
});
