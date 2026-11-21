import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import { ErrorText } from "../components/Layout";

export default function Login() {
  const [email, setEmail] = useState("");
  const send = useMutation({ mutationFn: (email: string) => api<{ ok: true; devLink?: string }>("/auth/magic-link", { method: "POST", body: { email } }) });

  return (
    <div className="mx-auto flex min-h-dvh max-w-[480px] flex-col justify-center px-6">
      <div className="mb-8 text-center">
        <img src="/icon.svg" alt="" className="mx-auto mb-3 h-16 w-16" />
        <h1 className="text-2xl font-bold text-slate-900">We Just Met</h1>
        <p className="mt-1 text-sm text-slate-600">Meet someone. Scan. Never forget who they are.</p>
      </div>
      {send.data ? (
        <div className="card text-center">
          <h2 className="font-semibold">Check your email</h2>
          <p className="mt-1 text-sm text-slate-600">We sent a sign-in link to {email}.</p>
          {send.data.devLink && (
            <div className="mt-4 rounded-lg bg-amber-50 p-3 text-left text-xs text-amber-800">
              <div className="font-semibold">POC mode: no email is sent.</div>
              <Link to={send.data.devLink} className="btn-primary mt-2 w-full" data-testid="dev-magic-link">Open sign-in link</Link>
            </div>
          )}
          <button className="mt-3 text-xs text-indigo-600" onClick={() => send.reset()}>Use a different email</button>
        </div>
      ) : (
        <form className="card space-y-3" onSubmit={(e) => { e.preventDefault(); send.mutate(email); }}>
          <label className="label" htmlFor="email">Email</label>
          <input id="email" type="email" required className="input" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} data-testid="login-email" />
          <button className="btn-primary w-full" disabled={send.isPending} data-testid="login-submit">{send.isPending ? "Sending…" : "Email me a sign-in link"}</button>
          <ErrorText error={send.error} />
        </form>
      )}
    </div>
  );
}
