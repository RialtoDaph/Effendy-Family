"use client";

import { Check } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { ScreenEmpty } from "@/components/empty-state";
import { useFinance } from "@/components/finance-data";
import { useMoney } from "@/components/money-data";
import { useMoneyForms } from "@/components/money-forms";
import { useLabel } from "@/components/nav-label";
import { FormSheet } from "@/components/sheet";
import { useToast } from "@/components/toast";
import { AddButton, Card, EmptyNote, H2, PrivateMark } from "@/components/ui";
import { taxPot } from "@/lib/finance";
import { eur, parseAmount } from "@/lib/money";
import { QUEUED } from "@/lib/offline-queue";
import { useDates } from "@/lib/use-dates";
import { ModuleHeader } from "./module-tabs";

export function TaxesScreen() {
  const t = useTranslations();
  const tm = useTranslations("money");
  const dates = useDates();
  const label = useLabel();
  const fin = useFinance();
  const { today, incomes } = useMoney();
  const { openForm } = useMoneyForms();
  const toast = useToast();
  const [editRefund, setEditRefund] = useState(false);
  const year = today.y;

  const familyMonths = fin.businessMonths.filter((m) => m.visibility === "family");
  const pot = taxPot(familyMonths, year);
  const potMonths = familyMonths.filter((m) => m.month.startsWith(`${year}-`)).length;
  const refund = fin.taxYears.find((x) => x.year === year)?.refund_estimate ?? null;
  const deductions = fin.taxDeductions.filter((d) => d.year === year);
  const dedTotal = deductions.filter((d) => d.visibility === "family").reduce((a, d) => a + d.amount, 0);
  const open = fin.taxDeadlines.filter((d) => !d.done);
  const done = fin.taxDeadlines.filter((d) => d.done);
  const thisYear = fin.businessMonths.filter((m) => m.month.startsWith(`${year}-`));
  const docs = thisYear
    .map((m) => ({ m, file: fin.files.find((f) => f.id === m.file_id), biz: fin.businesses.find((b) => b.id === m.business_id) }))
    .sort((a, b) => Number(!!a.file) - Number(!!b.file));

  const daysUntil = (iso: string) => Math.round((Date.parse(`${iso}T12:00:00`) - Date.parse(`${today.iso}T12:00:00`)) / 864e5);

  async function toggle(table: "tax_deadlines" | "tax_deductions", id: string, patch: Record<string, unknown>) {
    const err = await fin.save(table, patch, id);
    if (err && err !== QUEUED) toast(err);
  }

  if (fin.loaded && !incomes.length && !fin.businessMonths.length && !fin.taxDeadlines.length && !fin.taxDeductions.length) {
    return (
      <>
        <ModuleHeader module="money" active="tax" />
        <ScreenEmpty eyebrow={label("nav.taxes_refund")} title={t("t.e_tax")} action={t("t.b_income")} onAction={() => openForm("income")} />
      </>
    );
  }

  return (
    <>
      <ModuleHeader module="money" active="tax" />

      <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(100%,320px),1fr))]">
        <section className="rounded-[18px] bg-inv p-6 text-white">
          <div className="font-mono text-[11px] font-bold uppercase tracking-[.16em] text-acc2">{tm("tax_pot_year", { year })}</div>
          <div className="mt-2.5 font-serif text-[60px] font-normal leading-none tabular-nums tracking-[-0.01em]">{eur(pot, 0)}</div>
          <div className="mt-1 text-sm text-white/75">{tm("tax_pot_note", { n: potMonths })}</div>
        </section>
        <section className="flex flex-col rounded-[18px] border border-line bg-card p-[22px]">
          <div className="eyebrow">{tm("refund_estimate_year", { year })}</div>
          <div className="mt-2.5 font-serif text-[60px] font-normal leading-none tabular-nums tracking-[-0.01em] text-acct">{refund == null ? "—" : `≈ ${eur(refund, 0)}`}</div>
          <div className="mt-1 text-sm text-mut">{refund == null ? tm("refund_add_note") : tm("refund_by_hand")}</div>
          <button onClick={() => setEditRefund(true)} className="hit44 mt-3 min-h-10 self-start rounded-full border-0 bg-tint px-3.5 text-[12.5px] font-bold text-acct">
            {refund == null ? tm("add_estimate") : tm("update_estimate")}
          </button>
        </section>
      </div>

      <div className="grid items-start gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(100%,360px),1fr))]">
        <Card>
          <div className="mb-1.5 flex items-center justify-between gap-2.5">
            <H2>{tm("coming_up")}</H2>
            <AddButton onClick={() => openForm("deadline")} />
          </div>
          {[...open, ...done].map((d) => {
            const n = daysUntil(d.due_date);
            const when = d.done ? tm("done") : n < 0 ? tm("days_late", { n: -n }) : n === 0 ? tm("today") : n === 1 ? tm("tomorrow") : tm("in_days", { n });
            const tile = d.done ? "bg-soft2 text-mut" : n < 0 ? "bg-badbg text-bad" : n <= 10 ? "bg-warnbg text-warnt" : "bg-soft2 text-ink";
            return (
              <div key={d.id} className={`flex items-center gap-3 border-b border-line py-3 ${d.visibility === "private" ? "border-dashed" : ""}`}>
                <button
                  onClick={() => toggle("tax_deadlines", d.id, { done: !d.done })}
                  aria-label={d.done ? tm("mark_not_done", { title: d.title }) : tm("mark_done", { title: d.title })}
                  className={`hit44 flex h-[26px] w-[26px] flex-none items-center justify-center rounded-[9px] border-2 text-white ${d.done ? "border-ok bg-ok" : "border-line2 bg-card"}`}
                >
                  {d.done && <Check size={14} strokeWidth={3} />}
                </button>
                <button onClick={() => openForm("deadline", d.id)} className="flex min-w-0 flex-1 items-center gap-3 border-0 bg-transparent p-0 text-left">
                  <span className={`w-12 flex-none rounded-xl py-1.5 text-center ${tile}`}>
                    <span className="block text-lg font-bold leading-none">{Number(d.due_date.slice(8, 10))}</span>
                    <span className="block text-[11px] font-bold uppercase tracking-[.08em]">{dates.mon(d.due_date)}</span>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={`block text-sm font-bold ${d.done ? "text-mut2 line-through" : "text-ink"}`}>{d.title}</span>
                    <span className="flex flex-wrap items-center gap-x-2 text-xs text-mut">
                      {when}
                      {d.visibility === "private" && <PrivateMark />}
                    </span>
                  </span>
                  {d.amount != null && <span className="text-sm font-bold tabular-nums text-ink">{eur(d.amount)}</span>}
                </button>
              </div>
            );
          })}
          {!fin.taxDeadlines.length && <EmptyNote>{tm("no_deadlines")}</EmptyNote>}
          <div className="mt-3 text-xs text-mut2">{tm("kleinunternehmer_note")}</div>
        </Card>

        <Card>
          <div className="mb-1.5 flex items-center justify-between gap-2.5">
            <H2>{tm("deductions_collected")}</H2>
            <span className="flex items-center gap-2.5">
              <span className="text-[15px] font-bold tabular-nums">{eur(dedTotal, 0)}</span>
              <AddButton onClick={() => openForm("deduction", undefined, { year: String(year) })} />
            </span>
          </div>
          {deductions.map((d) => (
            <div key={d.id} className={`flex items-center gap-3 border-b border-line py-2.5 ${d.visibility === "private" ? "border-dashed" : ""}`}>
              <button
                onClick={() => toggle("tax_deductions", d.id, { collected: !d.collected })}
                aria-label={d.collected ? tm("receipts_not_collected", { title: d.title }) : tm("receipts_collected", { title: d.title })}
                className={`hit44 flex h-[26px] w-[26px] flex-none items-center justify-center rounded-[9px] border-2 text-white ${d.collected ? "border-ok bg-ok" : "border-line2 bg-card"}`}
              >
                {d.collected && <Check size={14} strokeWidth={3} />}
              </button>
              <button onClick={() => openForm("deduction", d.id)} className="min-w-0 flex-1 border-0 bg-transparent p-0 text-left">
                <span className="block text-[13.5px] font-bold text-ink">{d.title}</span>
                <span className="flex flex-wrap items-center gap-x-2 text-xs text-mut2">
                  {d.collected ? tm("receipt_safe") : tm("receipt_missing")}
                  {d.visibility === "private" && <PrivateMark />}
                </span>
              </button>
              <span className="whitespace-nowrap text-[13.5px] font-bold tabular-nums">{eur(d.amount)}</span>
            </div>
          ))}
          {!deductions.length && <EmptyNote>{tm("deductions_empty")}</EmptyNote>}
        </Card>

        <Card>
          <H2 className="mb-1.5">{tm("documents")}</H2>
          {docs.map(({ m, file, biz }) => (
            <div key={m.id} className="flex items-center gap-2.5 border-b border-line py-[11px]">
              <span
                className={`flex h-6 w-6 flex-none items-center justify-center rounded-full text-xs font-bold ${file ? "bg-okbg text-ok" : "bg-warnbg text-warnt"}`}
              >
                {file ? "✓" : "!"}
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13.5px] font-bold">{file?.name ?? tm("report_month", { month: dates.monthYear(m.month) })}</div>
                <div className="text-xs text-mut2">
                  {biz?.name} · {dates.monthYear(m.month)}
                </div>
              </div>
              {file ? (
                <button onClick={() => fin.openFile(file.id)} className="hit44 border-0 bg-transparent p-0 text-[12.5px] font-bold text-acct">
                  {tm("open")}
                </button>
              ) : (
                <button onClick={() => openForm("bizmonth", m.id)} className="hit44 min-h-10 rounded-full border-0 bg-acc px-3 text-xs font-bold text-onacc">
                  {tm("upload")}
                </button>
              )}
            </div>
          ))}
          {!docs.length && <EmptyNote>{tm("documents_empty")}</EmptyNote>}
        </Card>
      </div>

      <p className="m-0 text-[12.5px] text-mut2">{tm("tax_disclaimer")}</p>

      {editRefund && (
        <FormSheet
          title={tm("refund_form_title", { year })}
          editing={refund != null}
          initial={{ refund: refund == null ? "" : String(refund) }}
          fields={[
            { kind: "amount", key: "refund", label: tm("expected_refund"), placeholder: "0" },
            { kind: "note", key: "n", label: "", text: tm("refund_form_note") },
          ]}
          onClose={() => setEditRefund(false)}
          onSave={async (v) => {
            const raw = String(v.refund ?? "").trim();
            const n = raw ? parseAmount(raw) : null;
            if (n != null && !Number.isFinite(n)) return tm("enter_number");
            await fin.setRefund(year, n);
            setEditRefund(false);
            toast(tm("saved"));
          }}
        />
      )}
    </>
  );
}
