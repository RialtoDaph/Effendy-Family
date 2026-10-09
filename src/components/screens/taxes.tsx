"use client";

import { Check, FileText } from "lucide-react";
import { useState } from "react";
import { useFinance } from "@/components/finance-data";
import { useMoney } from "@/components/money-data";
import { useMoneyForms } from "@/components/money-forms";
import { FormSheet } from "@/components/sheet";
import { useToast } from "@/components/toast";
import { AddButton, Card, EmptyNote, H2, PrivateMark } from "@/components/ui";
import { taxPot } from "@/lib/finance";
import { eur, parseAmount, shortDate } from "@/lib/money";
import { monthLabel } from "./business";
import { ModuleTabs } from "./module-tabs";
import { PageHeader } from "./page-header";

export function TaxesScreen() {
  const fin = useFinance();
  const { today } = useMoney();
  const { openForm } = useMoneyForms();
  const toast = useToast();
  const [editRefund, setEditRefund] = useState(false);
  const year = today.y;

  const familyMonths = fin.businessMonths.filter((m) => m.visibility === "family");
  const pot = taxPot(familyMonths, year);
  const potMonths = familyMonths.filter((m) => m.month.startsWith(`${year}-`)).length;
  const refund = fin.taxYears.find((t) => t.year === year)?.refund_estimate ?? null;
  const deductions = fin.taxDeductions.filter((d) => d.year === year);
  const dedTotal = deductions.filter((d) => d.visibility === "family").reduce((a, d) => a + d.amount, 0);
  const dedCollected = deductions.filter((d) => d.collected).length;
  const open = fin.taxDeadlines.filter((d) => !d.done);
  const done = fin.taxDeadlines.filter((d) => d.done);
  const reports = fin.businessMonths
    .filter((m) => m.file_id)
    .map((m) => ({ m, file: fin.files.find((f) => f.id === m.file_id), biz: fin.businesses.find((b) => b.id === m.business_id) }))
    .filter((x) => x.file);

  const daysUntil = (iso: string) => Math.round((Date.parse(`${iso}T12:00:00`) - Date.parse(`${today.iso}T12:00:00`)) / 864e5);

  async function toggle(table: "tax_deadlines" | "tax_deductions", id: string, patch: Record<string, unknown>) {
    const err = await fin.save(table, patch, id);
    if (err) toast(err);
  }

  return (
    <>
      <div className="flex flex-col gap-3">
        <PageHeader eyebrow="Money" title="Taxes & refund" />
        <ModuleTabs module="money" active="tax" />
      </div>

      <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(100%,300px),1fr))]">
        <section className="rounded-[10px] bg-inv p-6 text-white">
          <div className="font-mono text-[11px] font-bold uppercase tracking-[.16em] text-acc2">Tax pot {year}</div>
          <div className="mt-2 text-[46px] font-black leading-none tracking-[-0.03em]">{eur(pot, 0)}</div>
          <div className="mt-2 text-[13px] text-white/70">
            Set aside in {potMonths} business month{potMonths === 1 ? "" : "s"} · keep it untouched for the tax office
          </div>
        </section>
        <Card className="flex flex-col gap-2">
          <div className="text-[12.5px] text-mut">{year} refund estimate · joint filing</div>
          <div className="text-[40px] font-black leading-none tracking-[-0.03em]">{refund == null ? "—" : `≈ ${eur(refund, 0)}`}</div>
          <div className="text-[12.5px] text-mut">
            {refund == null ? "Add the estimate from your Steuerberater or ELSTER." : "Entered by hand. Update it when you know more."}
          </div>
          <button
            onClick={() => setEditRefund(true)}
            className="mt-auto self-start min-h-10 rounded-full border-0 bg-tint px-3.5 text-[12.5px] font-extrabold text-acct"
          >
            {refund == null ? "Add estimate" : "Update estimate"}
          </button>
        </Card>
      </div>

      <Card>
        <div className="mb-1.5 flex items-center justify-between gap-2.5">
          <H2>Coming up</H2>
          <AddButton onClick={() => openForm("deadline")} />
        </div>
        {[...open, ...done].map((d) => {
          const n = daysUntil(d.due_date);
          const when = d.done ? "Done" : n < 0 ? `${-n} days late` : n === 0 ? "Today" : n === 1 ? "Tomorrow" : `In ${n} days`;
          return (
            <div key={d.id} className={`flex items-center gap-3 border-b border-line py-3 ${d.visibility === "private" ? "border-dashed" : ""}`}>
              <button
                onClick={() => toggle("tax_deadlines", d.id, { done: !d.done })}
                aria-label={d.done ? `Mark “${d.title}” not done` : `Mark “${d.title}” done`}
                className={`flex h-[26px] w-[26px] flex-none items-center justify-center rounded-[9px] border-2 text-white ${
                  d.done ? "border-ok bg-ok" : "border-line2 bg-card"
                }`}
              >
                {d.done && <Check size={14} strokeWidth={3} />}
              </button>
              <button onClick={() => openForm("deadline", d.id)} className="min-w-0 flex-1 border-0 bg-transparent p-0 text-left">
                <div className={`text-sm font-bold ${d.done ? "text-mut2 line-through" : "text-ink"}`}>{d.title}</div>
                <div className="flex flex-wrap items-center gap-x-2 text-xs text-mut2">
                  <span>
                    {shortDate(d.due_date)} {d.due_date.slice(0, 4)}
                    {d.amount != null ? ` · ${eur(d.amount)}` : ""}
                  </span>
                  {d.visibility === "private" && <PrivateMark />}
                </div>
              </button>
              <span
                className={`whitespace-nowrap text-xs font-bold ${
                  !d.done && n < 0 ? "text-bad" : !d.done && n <= 10 ? "text-warnt" : "text-mut2"
                }`}
              >
                {when}
              </span>
            </div>
          );
        })}
        {!fin.taxDeadlines.length && <EmptyNote>No deadlines yet.</EmptyNote>}
        <div className="mt-3 text-xs text-mut2">
          Kleinunternehmer: no VAT returns. Add income-tax prepayments here if the Finanzamt asks for them.
        </div>
      </Card>

      <Card>
        <div className="mb-1.5 flex items-center justify-between gap-2.5">
          <div>
            <H2>Deductions {year}</H2>
            <div className="mt-1 text-[12.5px] text-mut">
              {eur(dedTotal, 0)} collected so far · {dedCollected} of {deductions.length} with receipts
            </div>
          </div>
          <AddButton onClick={() => openForm("deduction", undefined, { year: String(year) })} />
        </div>
        {deductions.map((d) => (
          <div key={d.id} className={`flex items-center gap-3 border-b border-line py-3 ${d.visibility === "private" ? "border-dashed" : ""}`}>
            <button
              onClick={() => toggle("tax_deductions", d.id, { collected: !d.collected })}
              aria-label={d.collected ? `Receipts for “${d.title}” not collected` : `Receipts for “${d.title}” collected`}
              className={`flex h-[26px] w-[26px] flex-none items-center justify-center rounded-[9px] border-2 text-white ${
                d.collected ? "border-ok bg-ok" : "border-line2 bg-card"
              }`}
            >
              {d.collected && <Check size={14} strokeWidth={3} />}
            </button>
            <button onClick={() => openForm("deduction", d.id)} className="min-w-0 flex-1 border-0 bg-transparent p-0 text-left">
              <div className="text-sm font-bold text-ink">{d.title}</div>
              {d.visibility === "private" && <PrivateMark />}
            </button>
            <span className="whitespace-nowrap text-sm font-black">{eur(d.amount)}</span>
          </div>
        ))}
        {!deductions.length && (
          <EmptyNote>Commute, work equipment, insurance, donations, childcare… add each one and tick it when the receipt is safe.</EmptyNote>
        )}
      </Card>

      <Card>
        <H2 className="mb-1.5">Documents</H2>
        {reports.map(({ m, file, biz }) => (
          <button
            key={m.id}
            onClick={() => fin.openFile(file!.id)}
            className="flex w-full items-center gap-3 border-0 border-b border-line bg-transparent py-3 text-left"
          >
            <FileText size={18} strokeWidth={1.8} className="flex-none text-mut" />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-bold text-ink">{file!.name}</div>
              <div className="text-xs text-mut2">
                {biz?.name} · {monthLabel(m.month)}
              </div>
            </div>
            <span className="text-[12.5px] font-extrabold text-acct">Open</span>
          </button>
        ))}
        {!reports.length && <EmptyNote>Monthly business reports you upload appear here.</EmptyNote>}
      </Card>

      <p className="m-0 text-[12.5px] text-mut2">
        Estimates from your own data, not tax advice. Check the final return with your Steuerberater or ELSTER.
      </p>

      {editRefund && (
        <FormSheet
          title={`Refund estimate ${year}`}
          editing={refund != null}
          initial={{ refund: refund == null ? "" : String(refund) }}
          fields={[
            { kind: "amount", key: "refund", label: "Expected refund (leave empty to clear)", placeholder: "0" },
            { kind: "note", key: "n", label: "", text: "Use the number from your Steuerberater, ELSTER or a tax app." },
          ]}
          onClose={() => setEditRefund(false)}
          onSave={async (v) => {
            const raw = String(v.refund ?? "").trim();
            const n = raw ? parseAmount(raw) : null;
            if (n != null && !Number.isFinite(n)) return "Please enter a number.";
            await fin.setRefund(year, n);
            setEditRefund(false);
            toast("Saved");
          }}
        />
      )}
    </>
  );
}
