import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import type { ExchangeResult } from "@wjm/shared";
import { api } from "../api/client";
import { Spinner } from "../components/Layout";
import { getActiveEventId, setActiveEventId } from "../lib/activeEvent";

const getPosition = () => new Promise<{ lat?: number; lng?: number }>((resolve) => {
  if (!navigator.geolocation) return resolve({});
  navigator.geolocation.getCurrentPosition((p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }), () => resolve({}), { timeout: 5000, maximumAge: 60_000 });
});

export default function Redeem() {
  const { token } = useParams();
  const nav = useNavigate();
  const [err, setErr] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    (async () => {
      try {
        const pos = await getPosition();
        const c = await api<ExchangeResult>("/exchange/redeem", { method: "POST", body: { token, ...pos, eventId: getActiveEventId() } });
        if (c.eventId) setActiveEventId(c.eventId);
        nav(`/c/${c.id}?new=1&memory=${c.memoryPhotoIncluded ? "added" : "prompt"}`, { replace: true });
      } catch (e) { setErr(e instanceof Error ? e.message : "Something went wrong"); }
    })();
  }, [token, nav]);

  return (
    <div className="card mt-10 text-center">
      {err ? (<><p className="font-semibold text-red-600">{err}</p><Link to="/" className="btn-secondary mt-4">Go to contacts</Link></>) : (<><Spinner /><p className="text-sm text-slate-600">Exchanging cards…</p></>)}
    </div>
  );
}
