"use client";

import { FileText, Upload } from "lucide-react";
import { useTranslations } from "next-intl";
import { useAppData } from "@/components/app-data";
import { ModuleEmpty } from "@/components/empty-state";
import { useFinance } from "@/components/finance-data";
import { useMoneyForms } from "@/components/money-forms";
import { useLabel } from "@/components/nav-label";
import { avatarColors } from "@/components/shell/avatar";
import { PrivateMark } from "@/components/ui";
import { businessStats, profit } from "@/lib/finance";
import { eur } from "@/lib/money";
import { useDates } from "@/lib/use-dates";
import { ModuleHeader } from "./module-tabs";

export function BusinessScreen() {
  const tm = useTranslations("money");
  const dates = useDates();
  const label = useLabel();
  const { businesses, businessMonths, files, openFile, loaded } = useFinance();
  const { members } = useAppData();
  const { openForm } = useMoneyForms();

  if (loaded && !businesses.length) {
    return (
      <>
        <ModuleHeader module="money" active="biz" />
        <ModuleEmpty screen="biz" eyebrow={label("nav.business")} onAction={() => openForm("business")} />
      </>
    );
  }

  return (
    <>
      <ModuleHeader module="money" active="biz" />

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-[10px] border border-dashed border-line bg-card px-4 py-3.5">
        <div className="max-w-[560px] text-[13px] leading-normal text-mut">{tm("biz_intro")}</div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => openForm("business")} className="hit44 min-h-10 whitespace-nowrap rounded-full border border-line bg-card px-4 text-[13px] font-bold text-ink">
            {tm("add_business")}
          </button>
          <button onClick={() => openForm("bizmonth")} className="hit44 min-h-10 whitespace-nowrap rounded-full border-0 bg-acc px-4 text-[13px] font-bold text-onacc">
            {tm("add_a_month")}
          </button>
        </div>
      </div>

      <div className="grid items-start gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(100%,360px),1fr))]">
        {businesses.map((b) => {
          const months = businessMonths.filter((m) => m.business_id === b.id);
          const st = businessStats(months.filter((m) => m.visibility === "family"));
          const owner = members.find((m) => m.id === b.member_id);
          const { bg, fg } = owner ? avatarColors(owner) : { bg: "var(--acc)", fg: "var(--onacc)" };
          return (
            <section key={b.id} className="flex flex-col gap-3.5 rounded-[18px] border border-line bg-card p-5">
              <button onClick={() => openForm("business", b.id)} className="flex items-center gap-3 border-0 bg-transparent p-0 text-left">
                <span className="flex h-10 w-10 flex-none items-center justify-center rounded-full font-bold" style={{ background: bg, color: fg }}>
                  {b.name[0]?.toUpperCase()}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[17px] font-bold text-ink">{b.name}</span>
                  <span className="flex flex-wrap items-center gap-2 text-[12.5px] text-mut">
                    {tm(`vat_${b.vat_mode}`)}
                    {b.visibility === "private" && <PrivateMark />}
                  </span>
                </span>
              </button>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { k: tm("revenue_n_mo", { n: st.months || 3 }), v: eur(st.revenue, 0), c: "" },
                  { k: tm("profit_n_mo", { n: st.months || 3 }), v: eur(st.profit, 0), c: "text-ok" },
                  { k: tm("profit_per_month"), v: eur(st.perMonth, 0), c: "" },
                ].map(({ k, v, c }) => (
                  <div key={k} className="min-w-0 rounded-[10px] bg-soft p-3">
                    <div className="text-[11.5px] text-mut">{k}</div>
                    <div className={`mt-1 text-lg font-bold tabular-nums ${c}`}>{v}</div>
                  </div>
                ))}
              </div>
              <button
                onClick={() => openForm("bizmonth", undefined, { business: b.id })}
                className="flex min-h-12 items-center justify-center gap-2 rounded-[10px] border-2 border-dashed border-line2 bg-card text-[13.5px] font-bold text-ink"
              >
                <Upload size={16} strokeWidth={2} />
                {tm("upload_report")}
              </button>
              <div>
                {months.map((m) => {
                  const file = m.file_id ? files.find((f) => f.id === m.file_id) : undefined;
                  return (
                    <div key={m.id} className={`flex items-center gap-3 border-t border-line py-3 ${m.visibility === "private" ? "border-dashed" : ""}`}>
                      <div className="min-w-0 flex-1">
                        <button onClick={() => openForm("bizmonth", m.id)} className="hit44 border-0 bg-transparent p-0 text-left text-sm font-bold text-ink">
                          {dates.monthYear(m.month)}
                        </button>
                        {m.visibility === "private" && <span className="ml-2"><PrivateMark /></span>}
                        {file ? (
                          <button onClick={() => openFile(file.id)} className="hit44 mt-0.5 flex max-w-full items-center gap-[5px] border-0 bg-transparent p-0 text-xs text-mut2">
                            <FileText size={12} strokeWidth={2} className="flex-none" />
                            <span className="truncate">{file.name}</span>
                          </button>
                        ) : (
                          <div className="mt-0.5 text-xs font-bold text-warnt">{tm("no_file_attached")}</div>
                        )}
                      </div>
                      <button onClick={() => openForm("bizmonth", m.id)} className="flex-none border-0 bg-transparent p-0 text-right">
                        <span className="block text-[14.5px] font-bold tabular-nums text-ink">{eur(profit(m), 0)}</span>
                        <span className="block text-[11.5px] text-mut2">{tm("biz_row_meta", { revenue: eur(m.revenue, 0), tax: eur(m.tax_set_aside, 0) })}</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </>
  );
}
