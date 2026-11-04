"use client";

import { Check, Lock } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useAssistant } from "@/components/assistant";
import type { Card } from "@/lib/assistant-tools";
import { eur, eurSigned } from "@/lib/money";
import { useDates } from "@/lib/use-dates";

/** What the assistant wants to write. Nothing is saved until Save is tapped. */
export function ConfirmCard({ card }: { card: Card }) {
  const t = useTranslations("assistant");
  const { answerCard, editCard } = useAssistant();
  const dates = useDates();
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const a = card.args as Record<string, string | number | null>;
  const [draft, setDraft] = useState(String(a.text ?? ""));

  if (card.status === "skipped" || card.status === "undone") {
    return <div className="self-start text-[12.5px] text-mut2">{t(card.status === "undone" ? "card_undone" : "card_dismissed")}</div>;
  }

  const memory = card.kind === "remember" || card.kind === "forget";
  const title =
    card.kind === "transaction"
      ? t("card_transaction")
      : card.kind === "event"
        ? t("card_event")
        : card.kind === "goal"
          ? t("card_goal")
          : card.kind === "forget"
            ? t("card_forget")
            : a.scope === "shared"
              ? t("card_share")
              : t("card_remember");
  const lines: [string, string][] =
    card.kind === "transaction"
      ? [[String(a.payee), eurSigned(Number(a.amount))], [t("f_date"), dates.short(String(a.date))], ...(a.category ? ([[t("f_category"), String(a.category)]] as [string, string][]) : [])]
      : card.kind === "event"
        ? [[String(a.title), `${dates.short(String(a.date))}${a.time ? ` ${a.time}` : ""}`]]
        : card.kind === "goal"
          ? [[String(a.name), eur(Number(a.target))], ...(Number(a.monthly) ? ([[t("f_monthly"), eur(Number(a.monthly))]] as [string, string][]) : [])]
          : [];

  async function go(action: "save" | "undo") {
    setBusy(true);
    await answerCard(card, action, editing ? draft : undefined);
    setBusy(false);
    setEditing(false);
  }

  const pill = "min-h-10 rounded-full px-4 text-[13px] font-bold disabled:opacity-50";
  const hidden = a.visibility === "private" || (memory && a.scope !== "shared");

  return (
    <section data-screen-label="Confirm card" className="pointer-events-auto flex w-full max-w-[420px] flex-col gap-2.5 self-start rounded-[14px] border border-line bg-card p-3.5">
      <div className="flex items-center gap-2">
        {card.status === "saved" && <Check size={15} strokeWidth={3} className="flex-none text-ok" />}
        <span className="min-w-0 flex-1 font-mono text-[11px] font-bold uppercase tracking-[.14em] text-mut2">{card.status === "saved" ? t("card_saved") : title}</span>
        {hidden && (
          <span className="flex flex-none items-center gap-1 text-[11.5px] font-bold text-mut">
            <Lock size={12} /> {t("only_you")}
          </span>
        )}
      </div>
      {memory &&
        (editing ? (
          <textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={2} maxLength={500} className="w-full rounded-lg border border-line bg-soft p-2 text-base text-ink outline-none" />
        ) : (
          <p className="m-0 text-[14.5px] leading-normal">{draft}</p>
        ))}
      {lines.map(([k, v], i) => (
        <div key={k} className={`flex justify-between gap-3 text-[13.5px] ${i === 0 ? "font-bold" : "text-mut"}`}>
          <span className="min-w-0 truncate">{k}</span>
          <span className="flex-none">{v}</span>
        </div>
      ))}
      <div className="flex flex-wrap gap-1.5">
        {card.status === "pending" && (
          <>
            <button onClick={() => go("save")} disabled={busy} className={`${pill} border-0 bg-acc text-onacc`}>
              {t("save")}
            </button>
            {card.kind !== "forget" && (
              <button onClick={() => (memory ? setEditing((v) => !v) : editCard(card))} disabled={busy} className={`${pill} border border-line bg-card text-ink`}>
                {t("edit")}
              </button>
            )}
          </>
        )}
        <button onClick={() => go("undo")} disabled={busy} className={`${pill} border-0 bg-soft2 text-ink`}>
          {t("undo")}
        </button>
      </div>
    </section>
  );
}
