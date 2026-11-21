import { useRef, useState } from "react";
import { compressImage } from "../lib/image";

type Props = { label: string; onPicked: (blob: Blob) => Promise<void>; className?: string; testId?: string; capture?: "user" | "environment" };

export function ImagePicker({ label, onPicked, className, testId, capture = "environment" }: Props) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  return (
    <>
      <button type="button" className={className ?? "btn-secondary"} disabled={busy} onClick={() => ref.current?.click()}>
        {busy ? "Uploading…" : label}
      </button>
      <input
        ref={ref} type="file" accept="image/*" capture={capture} className="hidden" data-testid={testId}
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (!f) return;
          setBusy(true); setErr(null);
          try { await onPicked(await compressImage(f)); } catch (x) { setErr(x instanceof Error ? x.message : "Upload failed"); } finally { setBusy(false); }
        }}
      />
      {err && <p className="text-xs text-red-600">{err}</p>}
    </>
  );
}
