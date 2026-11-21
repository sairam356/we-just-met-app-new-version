import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { QRCodeSVG } from "qrcode.react";
import type { TokenResponse, TokenStatus } from "@wjm/shared";
import { api } from "../api/client";
import { useEvents } from "../api/hooks";
import { EventPicker, NewEventForm } from "../components/EventPicker";
import { ErrorText, Spinner } from "../components/Layout";
import { getActiveEventId, setActiveEventId } from "../lib/activeEvent";

const ASKED_KEY = "wjm_where_asked";

export default function MyQR() {
  const nav = useNavigate();
  const events = useEvents();
  const [eventId, setEventId] = useState<string | null>(() => getActiveEventId());
  const [asking, setAsking] = useState(() => !getActiveEventId() && Date.now() - Number(sessionStorage.getItem(ASKED_KEY) ?? 0) > 12 * 3600_000);
  const [changing, setChanging] = useState(false);
  const [visible, setVisible] = useState(!document.hidden);
  const [now, setNow] = useState(Date.now());

  useEffect(() => { const f = () => setVisible(!document.hidden); document.addEventListener("visibilitychange", f); return () => document.removeEventListener("visibilitychange", f); }, []);
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);

  const token = useQuery({
    queryKey: ["xchg-token", eventId],
    queryFn: () => api<TokenResponse>("/exchange/token", { method: "POST", body: { eventId } }),
    enabled: !asking,
    staleTime: Infinity,
    gcTime: 0,
  });
  const expiresAt = token.data ? Date.parse(token.data.expiresAt) : 0;
  const secondsLeft = Math.max(0, Math.round((expiresAt - now) / 1000));

  useEffect(() => { if (token.data && secondsLeft <= 30 && !token.isFetching) token.refetch(); }, [token, secondsLeft]);

  const status = useQuery({
    queryKey: ["xchg-status", token.data?.token],
    queryFn: () => api<TokenStatus>(`/exchange/token/${token.data!.token}/status`),
    enabled: !!token.data && visible && secondsLeft > 0,
    refetchInterval: 2000,
  });
  useEffect(() => { if (status.data?.status === "redeemed") nav(`/c/${status.data.connectionId}?new=1`); }, [status.data, nav]);

  const selectEvent = (id: string | null) => { setEventId(id); setActiveEventId(id); setChanging(false); };
  const skip = () => { sessionStorage.setItem(ASKED_KEY, String(Date.now())); setAsking(false); };
  const activeEvent = events.data?.find((e) => e.id === eventId);
  const shareUrl = token.data ? `${window.location.origin}/x/${token.data.token}` : "";

  if (asking) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-bold">Where are you?</h1>
        <p className="text-sm text-slate-600">We'll attach the event to everyone you meet here, for both of you.</p>
        {!!events.data?.length && (
          <div className="card space-y-2">
            <div className="label">Recent events</div>
            {events.data.slice(0, 5).map((ev) => (
              <button key={ev.id} className="btn-secondary w-full justify-start" onClick={() => { selectEvent(ev.id); skip(); }}>{ev.name}{ev.placeLabel ? ` · ${ev.placeLabel}` : ""}</button>
            ))}
          </div>
        )}
        <div className="card"><NewEventForm onCreated={(ev) => { selectEvent(ev.id); skip(); }} /></div>
        <button className="w-full text-sm text-slate-500" onClick={skip}>Skip for now</button>
      </div>
    );
  }

  return (
    <div className="space-y-4 text-center">
      <div className="card text-left">
        <div className="label">Active event</div>
        {changing ? (
          <EventPicker value={eventId} onChange={(ev) => selectEvent(ev?.id ?? null)} />
        ) : (
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="truncate font-semibold" data-testid="active-event">{activeEvent?.name ?? "No event"}</div>
              {activeEvent?.placeLabel && <div className="truncate text-xs text-slate-500">{activeEvent.placeLabel}</div>}
            </div>
            <button className="btn-secondary" onClick={() => setChanging(true)}>Change</button>
          </div>
        )}
      </div>
      <div className="card flex flex-col items-center">
        {token.isLoading || !token.data ? <Spinner /> : (
          <>
            <div className="rounded-xl bg-white p-3" data-testid="qr" data-url={shareUrl}>
              <QRCodeSVG value={shareUrl} size={280} level="M" />
            </div>
            <p className="mt-3 text-sm text-slate-600">Ask them to scan this with their phone camera</p>
            <p className="text-xs text-slate-400">Refreshes in {Math.max(0, secondsLeft - 30)}s</p>
            <div className="mt-3 flex w-full gap-2">
              <button className="btn-secondary flex-1" onClick={() => navigator.clipboard?.writeText(shareUrl)}>Copy link</button>
              {navigator.share && <button className="btn-secondary flex-1" onClick={() => navigator.share({ title: "We Just Met", url: shareUrl }).catch(() => {})}>Share link</button>}
            </div>
            <p className="mt-2 break-all text-[10px] text-slate-400" data-testid="exchange-url">{shareUrl}</p>
          </>
        )}
        <ErrorText error={token.error} />
      </div>
    </div>
  );
}
