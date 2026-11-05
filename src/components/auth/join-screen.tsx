"use client";

import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { SHARE_AREAS } from "@/components/invite";
import { supabase } from "@/lib/supabase";
import { AuthScreen, authPrimary, authSub, authTitle } from "./auth-card";
import { EmailCode } from "./email-code";
import { PasskeyOffer } from "./passkey-offer";

type Preview = { household: string; inviter: string | null; invitee: string; role: string; share: Record<string, boolean> };

export function JoinScreen() {
  const t = useTranslations();
  const router = useRouter();
  const { token } = useParams<{ token: string }>();
  const [invite, setInvite] = useState<Preview | null | undefined>(undefined);
  const [signedIn, setSignedIn] = useState(false);
  const [step, setStep] = useState<"intro" | "email" | "passkey">("intro");

  useEffect(() => {
    const sb = supabase();
    sb.auth.getSession().then(({ data }) => setSignedIn(!!data.session));
    sb.rpc("invite_preview", { p_token: token }).then(({ data }) => setInvite((data as Preview[] | null)?.[0] ?? null));
  }, [token]);

  if (invite === undefined) return <AuthScreen>{null}</AuthScreen>;

  if (invite === null || signedIn) {
    return (
      <AuthScreen>
        <h1 className={authTitle}>{signedIn ? t("ui.already_signed_in") : t("ui.invite_gone")}</h1>
        <button onClick={() => router.replace("/")} className={`${authPrimary} mt-auto`}>
          {t("ui.back_home")}
        </button>
      </AuthScreen>
    );
  }

  if (step === "email") {
    return (
      <AuthScreen>
        <EmailCode data={{ invite_token: token, display_name: invite.invitee }} onDone={() => setStep("passkey")} />
      </AuthScreen>
    );
  }
  if (step === "passkey") {
    return (
      <AuthScreen>
        <PasskeyOffer onDone={() => router.replace("/")} />
      </AuthScreen>
    );
  }

  return (
    <AuthScreen>
      <div className="flex flex-col gap-3.5 pt-[2vh]">
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-inv text-2xl font-bold text-acc2">
          {(invite.inviter ?? invite.household).slice(0, 1).toUpperCase()}
        </span>
        <div>
          <h1 className={authTitle}>
            {invite.inviter
              ? t("ui.join_title", { inviter: invite.inviter, household: invite.household })
              : t("ui.join_title_short", { household: invite.household })}
          </h1>
          <p className={authSub}>{t("ui.join_sub", { name: invite.invitee })}</p>
        </div>
      </div>
      <div className="grid gap-2.5 [grid-template-columns:repeat(auto-fit,minmax(min(100%,180px),1fr))]">
        <div className="rounded-[14px] border border-line bg-card px-4 py-3.5">
          <div className="mb-2 text-xs font-bold text-ok">{t("copy.you_ll_share")}</div>
          {SHARE_AREAS.filter((a) => invite.share[a.key]).map((a) => (
            <div key={a.key} className="py-1 text-[13.5px]">
              {t(a.label)}
            </div>
          ))}
        </div>
        <div className="rounded-[14px] border border-line bg-soft px-4 py-3.5">
          <div className="mb-2 text-xs font-bold text-mut">{t("copy.stays_yours_alone")}</div>
          <div className="py-1 text-[13.5px]">{t("copy.journal")}</div>
          <div className="py-1 text-[13.5px]">{t("copy.ai_chats")}</div>
        </div>
      </div>
      <div className="mt-auto flex flex-col gap-2.5">
        <button onClick={() => setStep("email")} className={authPrimary}>
          {t("copy.continue_with_email")}
        </button>
        <p className="m-0 mt-1 text-center text-xs text-mut2 [text-wrap:pretty]">{t("copy.joining_is_free_for_you")}</p>
      </div>
    </AuthScreen>
  );
}
