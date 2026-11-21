import { useEffect, useState } from "react";
import type { ProfilePatch, User } from "@wjm/shared";
import { uploadImage, useUpdateMe } from "../api/hooks";
import { ImagePicker } from "./ImagePicker";
import { ErrorText } from "./Layout";

const fields: { k: keyof ProfilePatch; label: string; placeholder?: string; type?: string }[] = [
  { k: "name", label: "Name *", placeholder: "Jane Doe" },
  { k: "headline", label: "Headline", placeholder: "Building the future of payments" },
  { k: "jobTitle", label: "Job title", placeholder: "Product Manager" },
  { k: "company", label: "Company", placeholder: "Acme Inc." },
  { k: "phone", label: "Phone", placeholder: "+971 50 123 4567", type: "tel" },
  { k: "website", label: "Website", placeholder: "https://example.com" },
  { k: "linkedinUrl", label: "LinkedIn URL", placeholder: "linkedin.com/in/your-name" },
  { k: "instagramHandle", label: "Instagram handle", placeholder: "@yourhandle" },
];

export function ProfileForm({ me, submitLabel, onSaved }: { me: User; submitLabel: string; onSaved?: () => void }) {
  const update = useUpdateMe();
  const [form, setForm] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    setForm(Object.fromEntries(fields.map((f) => [f.k, (me[f.k as keyof User] as string | null) ?? ""])));
  }, [me]);

  return (
    <form
      className="space-y-3"
      onSubmit={async (e) => {
        e.preventDefault();
        setSaved(false);
        await update.mutateAsync(form as ProfilePatch);
        setSaved(true);
        onSaved?.();
      }}
    >
      <div className="card flex items-center gap-3">
        <div className="h-16 w-16 shrink-0 overflow-hidden rounded-full bg-indigo-100">
          {me.avatarUrl && <img src={me.avatarUrl} alt="" className="h-full w-full object-cover" />}
        </div>
        <ImagePicker label={me.avatarUrl ? "Change photo" : "Add photo"} onPicked={async (b) => { const { key } = await uploadImage("avatar", b); await update.mutateAsync({ avatarKey: key }); }} />
      </div>
      <div className="card space-y-3">
        {fields.map((f) => (
          <div key={f.k}>
            <label className="label" htmlFor={f.k}>{f.label}</label>
            <input id={f.k} className="input" type={f.type ?? "text"} required={f.k === "name"} placeholder={f.placeholder} value={form[f.k] ?? ""} onChange={(e) => setForm({ ...form, [f.k]: e.target.value })} data-testid={`profile-${f.k}`} />
          </div>
        ))}
      </div>
      <div className="card">
        <div className="label">Your business card (optional)</div>
        {me.businessCardUrl && <img src={me.businessCardUrl} alt="Business card" className="mb-2 w-full rounded-lg object-contain" style={{ aspectRatio: "1.6 / 1" }} />}
        <div className="flex gap-2">
          <ImagePicker label={me.businessCardUrl ? "Replace card" : "Add your business card"} onPicked={async (b) => { const { key } = await uploadImage("business_card", b); await update.mutateAsync({ businessCardKey: key }); }} />
          {me.businessCardUrl && <button type="button" className="btn-secondary" onClick={() => update.mutate({ businessCardKey: null })}>Remove</button>}
        </div>
      </div>
      <ErrorText error={update.error} />
      {saved && !update.error && <p className="text-sm text-green-700">Saved</p>}
      <button className="btn-primary w-full" disabled={update.isPending} data-testid="profile-save">{update.isPending ? "Saving…" : submitLabel}</button>
    </form>
  );
}
