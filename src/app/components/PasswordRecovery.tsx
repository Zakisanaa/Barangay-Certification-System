import { useState } from "react";
import { requestPasswordReset, updateRecoveredPassword } from "../residentAuth";
import { isSupabaseConfigured } from "../supabase";

export default function PasswordRecovery({ mode, staff = false, onComplete, onBack }: {
  mode: "request" | "update"; staff?: boolean; onComplete?: () => void; onBack: () => void | Promise<void>;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const inputClass = "min-h-12 w-full rounded-md border border-[#c9d1ca] bg-white px-3 text-base";
  return <section className="w-full max-w-md space-y-5 rounded-lg border border-[#d9e2da] bg-white p-5 sm:p-8">
    <h1 className="text-2xl font-bold text-[#122d1f]">{mode === "request" ? "Forgot your password?" : "Set a new password"}</h1>
    <p className="text-sm leading-relaxed text-[#53645b]">{mode === "request" ? "Enter your registered email address to request a password reset link." : "Use at least 8 characters. After saving, sign in with your new password."}</p>
    {error && <p role="alert" className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
    {sent ? <p role="status" className="rounded border border-green-200 bg-green-50 p-3 text-sm text-green-800">If an account exists for this address, you’ll receive a reset link. Check your inbox and spam folder.</p> : <form className="space-y-4" onSubmit={async event => {
      event.preventDefault(); if (busy) return;
      setError("");
      if (mode === "update" && (password.length < 8 || password !== confirm)) { setError(password.length < 8 ? "Use at least 8 characters." : "The passwords do not match."); return; }
      setBusy(true);
      try {
        if (mode === "request") { await requestPasswordReset(email, staff); setSent(true); }
        else { await updateRecoveredPassword(password); onComplete?.(); }
      } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not process the password reset. Try again."); }
      finally { setBusy(false); }
    }}>
      {mode === "request" ? <label className="grid gap-2 text-sm font-semibold">Registered email<input required type="email" autoComplete="email" value={email} disabled={busy} onChange={event => setEmail(event.target.value)} className={inputClass} /></label> : <>
        <label className="grid gap-2 text-sm font-semibold">New password<input required type="password" minLength={8} maxLength={128} autoComplete="new-password" value={password} disabled={busy} onChange={event => setPassword(event.target.value)} className={inputClass} /></label>
        <label className="grid gap-2 text-sm font-semibold">Confirm new password<input required type="password" minLength={8} maxLength={128} autoComplete="new-password" value={confirm} disabled={busy} onChange={event => setConfirm(event.target.value)} className={inputClass} /></label>
      </>}
      <button disabled={busy || !isSupabaseConfigured} className="min-h-12 w-full rounded-md bg-[#123323] px-4 text-sm font-semibold text-white disabled:opacity-50">{busy ? "Please wait…" : mode === "request" ? "Email reset link" : "Save new password"}</button>
    </form>}
    <button type="button" disabled={busy} onClick={async () => {
      setBusy(true); setError("");
      try { await onBack(); }
      catch (cause) { setError(cause instanceof Error ? cause.message : "Could not return to sign in. Try again."); }
      finally { setBusy(false); }
    }} className="min-h-11 text-sm font-semibold text-[#123323] underline">Back to sign in</button>
  </section>;
}
