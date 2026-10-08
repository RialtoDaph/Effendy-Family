"use client";

import { useRouter } from "next/navigation";
import { ScanFace } from "lucide-react";
import { useEffect, useState } from "react";
import { AuthCard, authInput, authPrimary, authSecondary } from "@/components/auth/auth-card";
import { supabase } from "@/lib/supabase";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  useEffect(() => {
    supabase()
      .auth.getSession()
      .then(({ data }) => data.session && router.replace("/"));
  }, [router]);

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setInfo("");
    if (!email.trim() || !password) {
      setError(`Please fill in: ${!email.trim() ? "Email" : "Password"}`);
      return;
    }
    setBusy(true);
    const { error } = await supabase().auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (error) {
      setError(
        error.message.toLowerCase().includes("invalid")
          ? "Email or password is not right."
          : navigator.onLine
            ? "Could not sign in. Try again in a moment."
            : "You are offline. Connect to the internet to sign in.",
      );
      return;
    }
    router.replace("/");
  }

  async function passkey() {
    setError("");
    setInfo("");
    setBusy(true);
    const { error } = await supabase().auth.signInWithPasskey();
    setBusy(false);
    if (error) {
      const code = (error as { code?: string }).code;
      setError(
        code === "webauthn_credential_not_found"
          ? "This passkey is not linked to an account. Sign in with your password, then add Face ID in Settings."
          : code === "passkey_disabled"
            ? "Face ID sign-in is not switched on yet. Use your password."
            : "Face ID / fingerprint sign-in did not work. Use your password.",
      );
      return;
    }
    router.replace("/");
  }

  async function forgot() {
    setError("");
    if (!email.trim()) {
      setError("Type your email first, then tap “Forgot password?” again.");
      return;
    }
    setBusy(true);
    const { error } = await supabase().auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset`,
    });
    setBusy(false);
    if (error) setError("Could not send the email. Try again later.");
    else setInfo("Check your inbox for a link to choose a new password.");
  }

  return (
    <AuthCard title="Sign in" sub="Effendy Family · for Rialto and Amnah">
      <form onSubmit={signIn} className="flex flex-col gap-3">
        <label className="flex flex-col gap-2">
          <span className="text-[12.5px] font-bold text-mut">Email</span>
          <input
            className={authInput}
            type="email"
            autoComplete="username webauthn"
            inputMode="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-2">
          <span className="text-[12.5px] font-bold text-mut">Password</span>
          <input
            className={authInput}
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        {error && <div className="text-[13px] font-bold text-bad">{error}</div>}
        {info && <div className="text-[13px] font-bold text-ok">{info}</div>}
        <button type="submit" disabled={busy} className={authPrimary}>
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
      <div className="flex items-center gap-3 text-xs text-mut2">
        <span className="h-px flex-1 bg-line" />
        or
        <span className="h-px flex-1 bg-line" />
      </div>
      <button onClick={passkey} disabled={busy} className={authSecondary}>
        <ScanFace size={18} />
        Sign in with Face ID / fingerprint
      </button>
      <button
        onClick={forgot}
        disabled={busy}
        className="min-h-11 self-center border-0 bg-transparent text-[13.5px] font-bold text-mut"
      >
        Forgot password?
      </button>
    </AuthCard>
  );
}
