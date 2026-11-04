"use client";

import { Mail } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { authInput, authPrimary, authSub, authTitle } from "./auth-card";

/**
 * Email, then the link or 6-digit code from that email. The same step signs in
 * and signs up; `data` only counts for a new account (see handle_new_user).
 */
export function EmailCode({ data, onDone }: { data?: Record<string, string>; onDone: () => void }) {
  const t = useTranslations();
  const locale = useLocale();
  const [step, setStep] = useState<"email" | "sent">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function send() {
    setError("");
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setError(t("ui.email_invalid"));
    setBusy(true);
    const { error } = await supabase().auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: window.location.origin, data: { lang: locale, ...data } },
    });
    setBusy(false);
    if (error) return setError(t("ui.email_failed"));
    setStep("sent");
  }

  async function verify(token: string) {
    setError("");
    setBusy(true);
    const { error } = await supabase().auth.verifyOtp({ email: email.trim(), token, type: "email" });
    setBusy(false);
    if (error) return setError(t("ui.code_wrong"));
    onDone();
  }

  if (step === "email") {
    return (
      <>
        <div>
          <h1 className={authTitle}>{t("copy.what_s_your_email")}</h1>
          <p className={authSub}>{t("copy.we_send_you_a_sign_in_link_and_a_6_digit_code_new_here_t")}</p>
        </div>
        <label className="flex flex-col gap-2">
          <span className="text-[12.5px] font-bold text-mut">{t("copy.email")}</span>
          <input
            className={authInput}
            type="email"
            inputMode="email"
            autoComplete="username webauthn"
            placeholder="name@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
          />
        </label>
        {error && <div className="-mt-4 text-[13px] font-bold text-bad">{error}</div>}
        <button onClick={send} disabled={busy} className={`${authPrimary} mt-auto`}>
          {busy ? t("copy.sending") : t("copy.send_sign_in_link")}
        </button>
      </>
    );
  }

  return (
    <>
      <div className="flex flex-col gap-3.5">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-tint text-acct">
          <Mail size={26} strokeWidth={1.8} />
        </span>
        <div>
          <h1 className={authTitle}>{t("copy.check_your_inbox")}</h1>
          <p className={authSub}>
            {t("copy.tap_the_link_we_sent_to")} <strong className="text-ink">{email.trim()}</strong>
          </p>
        </div>
      </div>
      <label className="flex flex-col gap-2">
        <span className="text-[12.5px] font-bold text-mut">{t("copy.6_digit_code")}</span>
        <input
          className="h-16 w-full rounded-[12px] border border-line bg-card px-4 text-center font-mono text-[28px] font-bold tracking-[.3em] text-ink outline-none focus:border-line2"
          inputMode="numeric"
          autoComplete="one-time-code"
          placeholder="••••••"
          maxLength={6}
          value={code}
          onChange={(e) => {
            const v = e.target.value.replace(/\D/g, "");
            setCode(v);
            if (v.length === 6) verify(v);
          }}
        />
      </label>
      {busy && <div className="-mt-4 text-[13px] font-bold text-mut">{t("copy.checking")}</div>}
      {error && <div className="-mt-4 text-[13px] font-bold text-bad">{error}</div>}
      <div className="mt-auto flex flex-col gap-2.5">
        <div className="flex gap-2">
          <button
            onClick={send}
            disabled={busy}
            className="min-h-12 flex-1 rounded-[14px] border border-line bg-card text-sm font-bold text-ink"
          >
            {t("copy.send_again")}
          </button>
          <button
            onClick={() => {
              setStep("email");
              setCode("");
              setError("");
            }}
            className="min-h-12 flex-1 rounded-[14px] border border-line bg-card text-sm font-bold text-ink"
          >
            {t("copy.different_email")}
          </button>
        </div>
        <p className="m-0 mt-1 text-center text-xs text-mut2">{t("copy.not_there_check_spam_the_link_works_for_15_minutes")}</p>
      </div>
    </>
  );
}
