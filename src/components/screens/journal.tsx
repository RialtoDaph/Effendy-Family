"use client";

import { Lock } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useAppData } from "@/components/app-data";
import { ModuleEmpty } from "@/components/empty-state";
import { useMoney } from "@/components/money-data";
import { useMoneyForms } from "@/components/money-forms";
import { useLabel } from "@/components/nav-label";
import { useTime } from "@/components/time-data";
import { useToast } from "@/components/toast";
import { Card } from "@/components/ui";
import { QUEUED } from "@/lib/offline-queue";
import { useDates } from "@/lib/use-dates";
import { ModuleHeader } from "./module-tabs";

/** Always private: the database forces it and nothing here offers another choice. */
export function JournalScreen() {
  const tt = useTranslations("time");
  const tm = useTranslations("money");
  const dates = useDates();
  const label = useLabel();
  const { today } = useMoney();
  const { members, userId } = useAppData();
  const time = useTime();
  const { openForm } = useMoneyForms();
  const toast = useToast();
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const me = members.find((m) => m.id === userId);
  const others = members.filter((m) => m.id !== userId).map((m) => m.display_name);
  const entries = time.journal.filter((j) => j.owner_id === userId);

  async function save() {
    if (!draft.trim()) return;
    setBusy(true);
    const err = await time.save("journal_entries", { text: draft.trim(), date: today.iso, visibility: "private" });
    setBusy(false);
    if (err && err !== QUEUED) return toast(err);
    setDraft("");
    toast(err === QUEUED ? tm("queued") : tt("journal_saved"));
  }

  if (time.loaded && !entries.length) {
    return (
      <>
        <ModuleHeader module="life" active="journal" />
        <ModuleEmpty screen="journal" eyebrow={label("nav.journal")} onAction={() => openForm("journal")} />
      </>
    );
  }

  return (
    <>
      <ModuleHeader module="life" active="journal" />
      <div className="flex max-w-[820px] flex-col gap-4">
        <div className="flex items-center gap-2.5 rounded-[10px] border border-dashed border-line bg-card px-4 py-3">
          <Lock size={16} className="flex-none text-acc" />
          <span className="text-[13.5px] font-semibold">{others.length ? tt("journal_privacy_shared", { names: others.join(", ") }) : tt("journal_privacy_solo")}</span>
        </div>
        <Card className="flex flex-col gap-3">
          <div className="eyebrow">{[me?.display_name, `${dates.dowLong(today.iso)}, ${dates.short(today.iso)}`].filter(Boolean).join(" · ")}</div>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={tt("how_was_today")}
            rows={5}
            aria-label={tt("journal_note")}
            className="w-full resize-y rounded-[10px] border border-line bg-soft p-3.5 text-base leading-[1.6] text-ink outline-none focus:border-line2"
          />
          <button onClick={save} disabled={busy || !draft.trim()} className="h-11 self-end rounded-full border-0 bg-inv px-5 text-[13.5px] font-bold text-white disabled:opacity-50">
            {busy ? tm("saving") : tt("save_note")}
          </button>
        </Card>
        <div className="flex flex-col gap-2.5">
          {entries.map((j) => (
            <button key={j.id} onClick={() => openForm("journal", j.id)} className="rounded-[18px] border border-line bg-card px-5 py-[18px] text-left hover:border-line2">
              <span className="flex justify-between text-xs font-bold text-mut2">
                <span>{dates.day(j.date)}</span>
                <span>{tt("edit")}</span>
              </span>
              <span className="mt-1.5 block whitespace-pre-wrap text-[15px] leading-[1.6] text-ink [text-wrap:pretty]">{j.text}</span>
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
