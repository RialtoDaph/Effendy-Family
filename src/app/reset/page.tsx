"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AuthCard, authInput, authPrimary } from "@/components/auth/auth-card";
import { supabase } from "@/lib/supabase";

/** Opened from the "reset password" email. Supabase signs the person in from the link. */
export default function ResetPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const sb = supabase();
    sb.auth.getSession().then(({ data }) => data.session && setReady(true));
    const { data } = sb.auth.onAuthStateChange((event, session) => {
      if (session && (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN")) setReady(true);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      setError("Use at least 8 characters.");
      return;
    }
    setBusy(true);
    const { error } = await supabase().auth.updateUser({ password });
    setBusy(false);
    if (error) setError("Could not save the new password. Ask for a new email.");
    else router.replace("/");
  }

  return (
    <AuthCard title="New password" sub={ready ? "Choose a new password for your account." : "Opening your reset link…"}>
      <form onSubmit={save} className="flex flex-col gap-3">
        <label className="flex flex-col gap-2">
          <span className="text-[12.5px] font-bold text-mut">New password</span>
          <input
            className={authInput}
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        {error && <div className="text-[13px] font-bold text-bad">{error}</div>}
        <button type="submit" disabled={!ready || busy} className={authPrimary}>
          {busy ? "Saving…" : "Save password"}
        </button>
      </form>
    </AuthCard>
  );
}
