"use client";

import { KeyRound, Mail, ScanFace } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { AuthScreen, authSecondary } from "@/components/auth/auth-card";
import { EmailCode } from "@/components/auth/email-code";
import { PasskeyOffer } from "@/components/auth/passkey-offer";
import { PasswordSignIn } from "@/components/auth/password-sign-in";
import { Clopar } from "@/components/clopar";
import { supabase } from "@/lib/supabase";

export default function LoginPage() {
  const t = useTranslations();
  const router = useRouter();
  const [step, setStep] = useState<"start" | "email" | "password" | "passkey">("start");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    supabase()
      .auth.getSession()
      .then(({ data }) => data.session && router.replace("/"));
  }, [router]);

  async function passkey() {
    setError("");
    setBusy(true);
    const { error } = await supabase().auth.signInWithPasskey();
    setBusy(false);
    if (error) {
      const off = (error as { code?: string }).code === "passkey_disabled";
      setError(off ? t("ui.passkey_off") : t("ui.passkey_failed"));
      return;
    }
    router.replace("/");
  }

  return (
    <AuthScreen>
      {step === "email" && <EmailCode onDone={() => setStep("passkey")} />}
      {step === "password" && <PasswordSignIn onDone={() => router.replace("/")} onBack={() => setStep("start")} />}
      {step === "passkey" && <PasskeyOffer onDone={() => router.replace("/")} />}
      {step === "start" && (
        <>
          <div className="relative -mx-5 h-[min(280px,34vh)] flex-none">
            <Clopar variant="hero" />
          </div>
          <div className="flex flex-col gap-3">
            <h1 className="m-0 font-serif text-[50px] font-normal leading-none tracking-[-0.01em] [text-wrap:pretty]">
              {t("copy.your_life_in_germany_in_one_calm_place")}
            </h1>
            <p className="m-0 text-base leading-normal text-mut [text-wrap:pretty]">
              {t("copy.sign_in_or_create_an_account_no_password_to_remember")}
            </p>
          </div>
          <div className="mt-auto flex flex-col gap-2.5">
            <button onClick={() => setStep("email")} className={authSecondary}>
              <Mail size={18} strokeWidth={1.8} />
              {t("copy.continue_with_email")}
            </button>
            <div className="mx-0 mb-0.5 mt-2 flex items-center gap-3 text-xs font-bold text-mut2">
              <span className="h-px flex-1 bg-line" />
              {t("copy.been_here_before")}
              <span className="h-px flex-1 bg-line" />
            </div>
            <button onClick={passkey} disabled={busy} className={`${authSecondary} border-0 bg-soft2`}>
              <ScanFace size={20} strokeWidth={1.8} />
              {t("ui.sign_in_passkey")}
            </button>
            <button onClick={() => setStep("password")} className={`${authSecondary} border-0 bg-soft2`}>
              <KeyRound size={18} strokeWidth={1.8} />
              {t("settings.pw_open")}
            </button>
            {error && <div className="text-center text-[13px] font-bold text-bad">{error}</div>}
          </div>
          <p className="m-0 text-center text-xs leading-normal text-mut2 [text-wrap:pretty]">
            {t("copy.your_data_stays_in_the_eu")}
          </p>
        </>
      )}
    </AuthScreen>
  );
}
