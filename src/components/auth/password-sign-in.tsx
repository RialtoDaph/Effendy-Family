"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { authInput, authPrimary, authSecondary, authTitle } from "./auth-card";

/** Email and password, for accounts that have one. No email is sent. */
export function PasswordSignIn({ onDone, onBack }: { onDone: () => void; onBack: () => void }) {
  const t = useTranslations("settings");
  const tc = useTranslations("copy");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    const { error } = await supabase().auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (error) return setError(t(error.status === 400 ? "pw_wrong" : "pw_failed"));
    onDone();
  }

  return (
    <form onSubmit={submit} className="flex flex-1 flex-col gap-6">
      <h1 className={authTitle}>{t("pw_title")}</h1>
      <label className="flex flex-col gap-2">
        <span className="text-[12.5px] font-bold text-mut">{tc("email")}</span>
        <input className={authInput} type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
      </label>
      <label className="flex flex-col gap-2">
        <span className="text-[12.5px] font-bold text-mut">{t("pw_label")}</span>
        <input className={authInput} type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
      </label>
      {error && <div className="-mt-3 text-[13px] font-bold text-bad">{error}</div>}
      <div className="mt-auto flex flex-col gap-2.5">
        <button type="submit" disabled={busy} className={authPrimary}>
          {t("pw_submit")}
        </button>
        <button type="button" onClick={onBack} className={authSecondary}>
          {t("pw_back")}
        </button>
      </div>
    </form>
  );
}
