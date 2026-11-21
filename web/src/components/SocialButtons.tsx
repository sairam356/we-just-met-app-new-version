import { useState } from "react";
import type { Contact } from "@wjm/shared";
import { instagramHref, linkedinHref, trackClick } from "../lib/deeplinks";

type Props = { contact: Contact; connectionId?: string; linkedinClickedAt?: string | null; instagramClickedAt?: string | null; compact?: boolean };

export function SocialButtons({ contact, connectionId, linkedinClickedAt, instagramClickedAt, compact }: Props) {
  const [liDone, setLiDone] = useState(!!linkedinClickedAt);
  const [igDone, setIgDone] = useState(!!instagramClickedAt);
  const size = compact ? "h-8 px-2 text-xs" : "h-10 px-3 text-sm";
  return (
    <div className="flex gap-2">
      {contact.linkedinUrl && (
        <a
          href={linkedinHref(contact.linkedinUrl)} target="_blank" rel="noopener noreferrer" data-testid="linkedin-button"
          onClick={(e) => { e.stopPropagation(); if (connectionId) { trackClick(connectionId, "linkedin"); setLiDone(true); } }}
          className={`inline-flex items-center gap-1.5 rounded-lg font-semibold ${size} ${liDone ? "bg-slate-200 text-slate-600" : "bg-[#0a66c2] text-white"}`}
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor"><path d="M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5ZM3 9h4v12H3zM9 9h3.8v1.7h.1c.5-1 1.8-2 3.8-2 4 0 4.8 2.7 4.8 6.1V21h-4v-5.4c0-1.3 0-3-1.8-3s-2.1 1.4-2.1 2.9V21H9z" /></svg>
          {liDone ? "Opened" : compact ? "" : "Connect"}
          {contact.linkedinVerified && <span title="Verified with LinkedIn">✓</span>}
        </a>
      )}
      {contact.instagramHandle && (
        <a
          href={instagramHref(contact.instagramHandle)} target="_blank" rel="noopener noreferrer" data-testid="instagram-button"
          onClick={(e) => { e.stopPropagation(); if (connectionId) { trackClick(connectionId, "instagram"); setIgDone(true); } }}
          className={`inline-flex items-center gap-1.5 rounded-lg font-semibold ${size} ${igDone ? "bg-slate-200 text-slate-600" : "bg-gradient-to-r from-fuchsia-500 via-pink-500 to-orange-400 text-white"}`}
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2}><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r="0.8" fill="currentColor" /></svg>
          {igDone ? "Opened" : compact ? "" : "Follow"}
        </a>
      )}
    </div>
  );
}
