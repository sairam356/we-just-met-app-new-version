import { useEffect, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { toPng } from "html-to-image";
import { uploadImage, useConnection, useEvents, useUpdateConnection } from "../api/hooks";
import { ContactCard } from "../components/ContactCard";
import { EventPicker } from "../components/EventPicker";
import { ImagePicker } from "../components/ImagePicker";
import { ErrorText, Spinner } from "../components/Layout";
import { setActiveEventId } from "../lib/activeEvent";
import { downloadVCard } from "../lib/vcard";

export default function ConnectionDetail() {
  const { id = "" } = useParams();
  const [params] = useSearchParams();
  const isNew = !!params.get("new");
  const conn = useConnection(id, isNew);
  const events = useEvents();
  const update = useUpdateConnection(id);
  const cardRef = useRef<HTMLDivElement>(null);
  const [note, setNote] = useState("");
  const [place, setPlace] = useState("");
  const [saved, setSaved] = useState(false);
  const [skipped, setSkipped] = useState(false);

  useEffect(() => { if (conn.data) { setNote(conn.data.note ?? ""); setPlace(conn.data.placeLabel ?? ""); } }, [conn.data?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (conn.isLoading) return <Spinner />;
  if (!conn.data) return <div className="card"><ErrorText error={conn.error} /><Link to="/" className="btn-secondary mt-3">Back</Link></div>;
  const c = conn.data;

  const saveCardImage = async () => {
    if (!cardRef.current) return;
    const url = await toPng(cardRef.current, { pixelRatio: 2, filter: (n) => !(n instanceof HTMLElement && n.hasAttribute("data-html2image-ignore")) });
    const a = document.createElement("a");
    a.href = url; a.download = `${c.contact.name || "card"}.png`; a.click();
  };

  const savePhoto = async (b: Blob) => { const { key } = await uploadImage("connection", b, c.id); await update.mutateAsync({ photoKey: key }); };

  if (isNew && !skipped && !c.photoUrl) {
    return (
      <div className="card mt-6 space-y-3 text-center" data-testid="photo-step">
        <div className="mx-auto h-20 w-20 overflow-hidden rounded-full bg-indigo-100">
          {c.contact.avatarUrl && <img src={c.contact.avatarUrl} alt="" className="h-full w-full object-cover" />}
        </div>
        <h1 className="text-xl font-bold">You just met {c.contact.name || "someone"}!</h1>
        <p className="text-sm text-slate-600">Take a photo together so you both recognise each other later. One photo is enough: it is saved on both of your cards.</p>
        <ImagePicker label="🤳 Take a photo together" capture="user" testId="together-input" className="btn-primary w-full" onPicked={savePhoto} />
        <ImagePicker label="Use the back camera" capture="environment" className="btn-secondary w-full" onPicked={savePhoto} />
        <ErrorText error={update.error} />
        <button className="w-full text-sm text-slate-500" onClick={() => setSkipped(true)} data-testid="skip-photo">Skip for now</button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Link to="/" className="text-sm text-indigo-600">← Contacts</Link>
      {isNew && <div className="rounded-lg bg-green-50 p-3 text-sm text-green-800">You just met {c.contact.name || "someone"}! {c.photoUrl ? "Your photo together is on both of your cards." : "Add a photo and a note so you remember them."}</div>}
      <ContactCard ref={cardRef} contact={c.contact} photoUrl={c.photoUrl} eventName={c.eventName} placeLabel={c.placeLabel} metAt={c.metAt} connectionId={c.id} linkedinClickedAt={c.linkedinClickedAt} instagramClickedAt={c.instagramClickedAt} size="full" />
      <div className="grid grid-cols-2 gap-2">
        <ImagePicker label={c.photoUrl ? "Replace photo" : "📷 Add photo"} capture="user" testId="photo-input" className="btn-primary" onPicked={savePhoto} />
        <button className="btn-secondary" onClick={() => downloadVCard(c.contact, c.note)}>Save to contacts</button>
        <button className="btn-secondary col-span-2" onClick={saveCardImage}>Save card as image</button>
        {c.photoUrl && <button className="col-span-2 text-sm text-slate-500" onClick={() => update.mutate({ photoKey: null })} data-testid="remove-photo">Remove photo from my card</button>}
      </div>

      <form className="card space-y-3" onSubmit={async (e) => { e.preventDefault(); setSaved(false); await update.mutateAsync({ note, placeLabel: place }); setSaved(true); }}>
        <div>
          <div className="label">Event</div>
          <EventPicker
            value={c.eventId}
            onChange={(ev) => {
              if (ev) setActiveEventId(ev.id);
              if (ev?.placeLabel && !place) setPlace(ev.placeLabel);
              update.mutate({ eventId: ev?.id ?? null, ...(ev?.placeLabel && !place ? { placeLabel: ev.placeLabel } : {}) });
            }}
          />
        </div>
        <div>
          <label className="label" htmlFor="place">Place</label>
          <input id="place" className="input" placeholder={events.data?.find((e) => e.id === c.eventId)?.placeLabel ?? "Where did you meet?"} value={place} onChange={(e) => setPlace(e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="note">Note</label>
          <textarea id="note" className="input min-h-24" maxLength={2000} placeholder="What did you talk about? What to follow up on?" value={note} onChange={(e) => setNote(e.target.value)} data-testid="note" />
        </div>
        <ErrorText error={update.error} />
        <div className="flex items-center gap-3">
          <button className="btn-primary" disabled={update.isPending} data-testid="save-connection">Save</button>
          {saved && <span className="text-sm text-green-700">Saved</span>}
        </div>
      </form>
      {c.lat != null && c.lng != null && <p className="text-center text-xs text-slate-400">Location saved: {c.lat.toFixed(4)}, {c.lng.toFixed(4)}</p>}
    </div>
  );
}
