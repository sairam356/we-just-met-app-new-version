import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useMe } from "../api/hooks";
import { api } from "../api/client";
import { ProfileForm } from "../components/ProfileForm";
import { ContactCard } from "../components/ContactCard";
import { Spinner } from "../components/Layout";

export default function Profile() {
  const me = useMe();
  const nav = useNavigate();
  const qc = useQueryClient();
  if (!me.data) return <Spinner />;
  const signOut = async () => { await api("/auth/logout", { method: "POST", body: {} }); qc.clear(); nav("/login", { replace: true }); };
  return (
    <div className="space-y-4">
      <div>
        <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">How others see you</div>
        <ContactCard contact={me.data} size="full" />
      </div>
      <ProfileForm me={me.data} submitLabel="Save profile" />
      <button className="btn-secondary w-full" onClick={signOut}>Sign out</button>
      <button
        className="btn w-full border border-red-200 bg-white text-red-600"
        onClick={async () => {
          if (!confirm("Delete your account, contacts, events and photos? This cannot be undone.")) return;
          await api("/me", { method: "DELETE" });
          qc.clear();
          nav("/login", { replace: true });
        }}
      >
        Delete account
      </button>
    </div>
  );
}
