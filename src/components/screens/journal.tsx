"use client";

import { Lock } from "lucide-react";
import { useState } from "react";
import { useAppData } from "@/components/app-data";
import { useMoney } from "@/components/money-data";
import { useMoneyForms } from "@/components/money-forms";
import { useTime } from "@/components/time-data";
import { useToast } from "@/components/toast";
import { Card, EmptyNote, H2, OwnerPill, Segmented } from "@/components/ui";
import { QUEUED, QUEUED_MSG } from "@/lib/offline-queue";
import { dayLabel } from "@/lib/time";
import { ModuleTabs } from "./module-tabs";
import { PageHeader } from "./page-header";

export function JournalScreen() {
  const { today } = useMoney();
  const { members, userId, settings } = useAppData();
  const time = useTime();
  const { openForm } = useMoneyForms();
  const toast = useToast();
  const [draft, setDraft] = useState("");
  const [visibility, setVisibility] = useState<"private" | "family">(
    settings?.default_visibility?.journal === "family" ? "family" : "private",
  );
  const [busy, setBusy] = useState(false);

  async function save() {
    if (!draft.trim()) return;
    setBusy(true);
    const err = await time.save("journal_entries", { text: draft.trim(), date: today.iso, visibility });
    setBusy(false);
    if (err && err !== QUEUED) return toast(err);
    setDraft("");
    toast(err === QUEUED ? QUEUED_MSG : visibility === "private" ? "Saved · only you can read it" : "Saved · shared with the family");
  }

  return (
    <>
      <div className="flex flex-col gap-3">
        <PageHeader eyebrow="Life" title="Journal" />
        <ModuleTabs module="life" active="journal" />
      </div>

      <Card className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <H2>{dayLabel(today.iso)}</H2>
          <span className="inline-flex items-center gap-1 text-xs font-bold text-mut">
            <Lock size={12} /> Private by default
          </span>
        </div>
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="How was today?"
          rows={6}
          aria-label="Journal note"
          className="min-h-[140px] rounded-[10px] border border-line bg-soft px-3.5 py-3 text-base leading-normal text-ink outline-none focus:border-line2"
        />
        <div className="flex flex-wrap items-center gap-2">
          <Segmented
            options={[
              { value: "private", label: "Only me" },
              { value: "family", label: "Family" },
            ]}
            value={visibility}
            onChange={setVisibility}
          />
          <button
            onClick={save}
            disabled={busy || !draft.trim()}
            className="ml-auto min-h-11 rounded-full border-0 bg-acc px-6 text-sm font-extrabold text-onacc disabled:opacity-50"
          >
            {busy ? "Saving…" : "Save"}
          </button>
        </div>
      </Card>

      <Card className="flex flex-col gap-1">
        <H2 className="mb-1">Earlier</H2>
        {time.journal.map((j) => (
          <button
            key={j.id}
            onClick={() => (j.owner_id === userId ? openForm("journal", j.id) : undefined)}
            className={`flex w-full flex-col gap-1 border-0 border-t border-line bg-transparent py-3 text-left ${j.visibility === "private" ? "border-dashed" : ""}`}
          >
            <div className="flex items-center gap-2 text-xs text-mut2">
              <span className="font-bold text-mut">{dayLabel(j.date)}</span>
              <OwnerPill member={members.find((m) => m.id === j.owner_id)} />
              {j.visibility === "private" ? (
                <span className="inline-flex items-center gap-1 font-bold">
                  <Lock size={11} /> only you
                </span>
              ) : (
                <span className="font-bold">shared</span>
              )}
            </div>
            <div className="whitespace-pre-wrap text-[14px] leading-normal text-ink">{j.text}</div>
          </button>
        ))}
        {!time.journal.length && <EmptyNote>Nothing written yet. A few lines a day is enough.</EmptyNote>}
      </Card>
    </>
  );
}
