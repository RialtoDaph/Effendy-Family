"use client";

import { FileText, Upload } from "lucide-react";
import { useAppData } from "@/components/app-data";
import { useFinance } from "@/components/finance-data";
import { useMoneyForms } from "@/components/money-forms";
import { EmptyNote, OwnerPill, PrivateMark } from "@/components/ui";
import { businessStats, profit } from "@/lib/finance";
import { MONTHS, eur } from "@/lib/money";
import { ModuleTabs } from "./module-tabs";
import { PageHeader } from "./page-header";

const VAT_LABEL = { none: "No VAT · Kleinunternehmer", monthly: "VAT monthly", quarterly: "VAT quarterly" };

export function monthLabel(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  return `${MONTHS[m - 1]} ${y}`;
}

export function BusinessScreen() {
  const { businesses, businessMonths, files, openFile } = useFinance();
  const { members } = useAppData();
  const { openForm } = useMoneyForms();

  return (
    <>
      <div className="flex flex-col gap-3">
        <PageHeader eyebrow="Money" title="Business" />
        <ModuleTabs module="money" active="biz" />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="m-0 max-w-[640px] text-[13.5px] leading-normal text-mut">
          The businesses run in their own apps. Here you only keep the monthly totals, plus the report file, so family money and
          taxes stay in one picture.
        </p>
        <button
          onClick={() => openForm("business")}
          className="min-h-11 whitespace-nowrap rounded-full border border-line bg-card px-4 text-[13px] font-bold text-ink"
        >
          + Add business
        </button>
      </div>

      {businesses.map((b) => {
        const months = businessMonths.filter((m) => m.business_id === b.id);
        const familyMonths = months.filter((m) => m.visibility === "family");
        const st = businessStats(familyMonths);
        return (
          <section key={b.id} className="rounded-[10px] border border-line bg-card p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <button onClick={() => openForm("business", b.id)} className="border-0 bg-transparent p-0 text-left">
                <h2 className="m-0 text-lg font-extrabold text-ink">{b.name}</h2>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-mut2">
                  <OwnerPill member={members.find((m) => m.id === b.member_id)} />
                  <span>{VAT_LABEL[b.vat_mode]}</span>
                  {b.visibility === "private" && <PrivateMark />}
                </div>
              </button>
              <button
                onClick={() => openForm("bizmonth", undefined, { business: b.id })}
                className="flex min-h-11 items-center gap-2 whitespace-nowrap rounded-full border-0 bg-inv px-4 text-[13px] font-extrabold text-white"
              >
                <Upload size={15} strokeWidth={2.2} />
                Upload monthly report
              </button>
            </div>
            <div className="mt-4 grid gap-2.5 [grid-template-columns:repeat(auto-fit,minmax(min(100%,150px),1fr))]">
              {[
                [`Revenue · ${st.months || 3} mo`, eur(st.revenue, 0)],
                [`Profit · ${st.months || 3} mo`, eur(st.profit, 0)],
                ["Profit / month", eur(st.perMonth, 0)],
              ].map(([k, v]) => (
                <div key={k} className="rounded-[10px] bg-soft px-4 py-3">
                  <div className="text-xs text-mut">{k}</div>
                  <div className="text-xl font-black">{v}</div>
                </div>
              ))}
            </div>
            <div className="mt-3">
              {months.map((m) => {
                const file = m.file_id ? files.find((f) => f.id === m.file_id) : undefined;
                return (
                  <div
                    key={m.id}
                    className={`flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-line py-3 ${m.visibility === "private" ? "border-dashed" : ""}`}
                  >
                    <button onClick={() => openForm("bizmonth", m.id)} className="min-w-0 flex-1 border-0 bg-transparent p-0 text-left">
                      <div className="text-sm font-bold text-ink">{monthLabel(m.month)}</div>
                      <div className="flex flex-wrap items-center gap-x-2 text-xs text-mut2">
                        <span>
                          {eur(m.revenue, 0)} in · {eur(profit(m), 0)} profit · {eur(m.tax_set_aside, 0)} for tax
                        </span>
                        {m.visibility === "private" && <PrivateMark />}
                      </div>
                    </button>
                    {file ? (
                      <button
                        onClick={() => openFile(file.id)}
                        className="flex min-h-10 max-w-full items-center gap-1.5 rounded-full border border-line bg-card px-3 text-[12.5px] font-bold text-ink"
                      >
                        <FileText size={14} strokeWidth={2} className="flex-none" />
                        <span className="truncate">{file.name}</span>
                      </button>
                    ) : (
                      <span className="rounded-full bg-warnbg px-2.5 py-1 text-[11.5px] font-bold text-warnt">No file attached</span>
                    )}
                  </div>
                );
              })}
              {!months.length && <EmptyNote>No months yet. Upload last month&apos;s report to start.</EmptyNote>}
            </div>
          </section>
        );
      })}
      {!businesses.length && <EmptyNote>No businesses yet.</EmptyNote>}
    </>
  );
}
