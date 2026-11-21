import { useNavigate, useSearchParams } from "react-router-dom";
import { useMe } from "../api/hooks";
import { ProfileForm } from "../components/ProfileForm";
import { Spinner } from "../components/Layout";

export default function Onboarding() {
  const me = useMe();
  const nav = useNavigate();
  const [params] = useSearchParams();
  if (!me.data) return <Spinner />;
  return (
    <div className="mx-auto max-w-[480px] p-4">
      <h1 className="mb-1 text-xl font-bold">Create your card</h1>
      <p className="mb-4 text-sm text-slate-600">This is what people get when they scan your QR. Only your name is required.</p>
      <ProfileForm me={me.data} submitLabel="Continue" onSaved={() => nav(params.get("next") || "/", { replace: true })} />
    </div>
  );
}
