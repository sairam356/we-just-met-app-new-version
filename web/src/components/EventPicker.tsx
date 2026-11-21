import { useState } from "react";
import { useCreateEvent, useEvents } from "../api/hooks";
import type { Event } from "@wjm/shared";

type Props = { value: string | null; onChange: (ev: Event | null) => void; allowNone?: boolean };

export function NewEventForm({ onCreated, onCancel }: { onCreated: (ev: Event) => void; onCancel?: () => void }) {
  const create = useCreateEvent();
  const [name, setName] = useState("");
  const [place, setPlace] = useState("");
  return (
    <form
      className="space-y-2"
      onSubmit={async (e) => { e.preventDefault(); if (!name.trim()) return; onCreated(await create.mutateAsync({ name, placeLabel: place || null, startsOn: new Date().toISOString().slice(0, 10) })); }}
    >
      <input className="input" placeholder="Event name, e.g. GITEX Dubai" value={name} onChange={(e) => setName(e.target.value)} autoFocus data-testid="event-name" />
      <input className="input" placeholder="Place, e.g. Dubai World Trade Centre" value={place} onChange={(e) => setPlace(e.target.value)} />
      <div className="flex gap-2">
        <button className="btn-primary flex-1" disabled={!name.trim() || create.isPending} data-testid="event-create">Save event</button>
        {onCancel && <button type="button" className="btn-secondary" onClick={onCancel}>Cancel</button>}
      </div>
    </form>
  );
}

export function EventPicker({ value, onChange, allowNone = true }: Props) {
  const events = useEvents();
  const [creating, setCreating] = useState(false);
  if (creating) return <NewEventForm onCreated={(ev) => { setCreating(false); onChange(ev); }} onCancel={() => setCreating(false)} />;
  return (
    <div className="flex gap-2">
      <select className="input" value={value ?? ""} onChange={(e) => onChange(events.data?.find((x) => x.id === e.target.value) ?? null)}>
        {allowNone && <option value="">No event</option>}
        {events.data?.map((ev) => <option key={ev.id} value={ev.id}>{ev.name}{ev.placeLabel ? ` · ${ev.placeLabel}` : ""}</option>)}
      </select>
      <button type="button" className="btn-secondary whitespace-nowrap" onClick={() => setCreating(true)}>+ New</button>
    </div>
  );
}
