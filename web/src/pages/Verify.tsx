import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import type { User } from "@wjm/shared";
import { api } from "../api/client";
import { Spinner } from "../components/Layout";
import { popReturnPath } from "../lib/returnPath";

export default function Verify() {
  const [params] = useSearchParams();
  const nav = useNavigate();
  const qc = useQueryClient();
  const [err, setErr] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    api<User>("/auth/verify", { method: "POST", body: { token: params.get("token") ?? "" } })
      .then(async (u) => {
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
        qc.setQueryData(["me"], await api<User>("/me", { method: "PATCH", body: { timezone: tz } }).catch(() => u));
        nav(u.name ? popReturnPath() : `/onboarding?next=${encodeURIComponent(popReturnPath())}`, { replace: true });
      })
      .catch((e) => setErr(e.message));
  }, [params, nav, qc]);

  return (
    <div className="mx-auto max-w-[480px] p-6 text-center">
      {err ? (<><p className="text-red-600">{err}</p><a className="btn-primary mt-4" href="/login">Back to sign in</a></>) : <Spinner />}
    </div>
  );
}
