"use client";

import { ScanFace } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { authPrimary, authSub, authTitle } from "./auth-card";

/** Right after the first sign-in on a device. Skipping is always fine. */
export function PasskeyOffer({ onDone }: { onDone: () => void }) {
  const t = useTranslations();
  const [busy, setBusy] = useState(false);

  async function create() {
    setBusy(true);
    await supabase().auth.registerPasskey();
    setBusy(false);
    onDone();
  }

  return (
    <>
      <div className="flex flex-col items-start gap-3.5 pt-[3vh]">
        <span className="flex h-[72px] w-[72px] items-center justify-center rounded-[20px] bg-inv text-acc2">
          <ScanFace size={38} strokeWidth={1.6} />
        </span>
        <div>
          <h1 className={authTitle}>{t("copy.sign_in_with_face_id_next_time")}</h1>
          <p className={authSub}>{t("copy.a_passkey_stays_on_this_phone_nothing_to_type_nothing_to")}</p>
        </div>
      </div>
      <div className="mt-auto flex flex-col gap-2.5">
        <button onClick={create} disabled={busy} className={authPrimary}>
          {busy ? t("ui.waiting_face_id") : t("ui.use_face_id")}
        </button>
        <button onClick={onDone} className="min-h-12 rounded-[14px] border-0 bg-transparent text-sm font-bold text-mut">
          {t("copy.not_now")}
        </button>
      </div>
    </>
  );
}
