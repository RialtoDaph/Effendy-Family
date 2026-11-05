"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useToast } from "@/components/toast";
import { supabase } from "@/lib/supabase";

/** Fills an empty household with the prototype's sample data (load_sample_data). */
export function SampleDataButton() {
  const t = useTranslations();
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  async function load() {
    setBusy(true);
    const { error } = await supabase().rpc("load_sample_data");
    setBusy(false);
    if (error) return toast(error.message.includes("not_empty") ? t("ui.sample_not_empty") : t("ui.sample_failed"));
    toast(t("ui.sample_loaded"));
    router.push("/");
    router.refresh();
  }

  return (
    <button
      onClick={load}
      disabled={busy}
      className="min-h-[46px] self-start rounded-full border border-line bg-card px-4 text-[13.5px] font-bold text-mut disabled:opacity-60"
    >
      {t("t.f_sample")}
    </button>
  );
}
