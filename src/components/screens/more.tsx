"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useMoney } from "@/components/money-data";
import { useLabel } from "@/components/nav-label";
import { MODULE_ORDER, MODULES, TOOLS, hrefOf } from "@/lib/nav";

const rows = [
  ...MODULE_ORDER.map((k) => ({ id: MODULES[k].tabs[0].id, label: MODULES[k].key, icon: MODULES[k].icon })),
  ...TOOLS.map((t) => ({ id: t.id, label: t.key, icon: t.icon })),
];

export function More() {
  const t = useTranslations("copy");
  const label = useLabel();
  const { alerts } = useMoney();
  const alertCount = alerts.filter((a) => a.sev !== "info").length;

  return (
    <div className="flex flex-col gap-3">
      <h1 className="m-0 font-serif text-4xl font-normal tracking-[-0.01em]">{t("all_modules")}</h1>
      <section className="rounded-[18px] border border-line bg-card px-4 py-1.5">
        {rows.map((r, i) => (
          <Link
            key={r.id}
            href={hrefOf(r.id)}
            className={`flex min-h-[54px] w-full items-center gap-3 text-left text-[15px] font-bold text-ink ${
              i < rows.length - 1 ? "border-b border-line" : ""
            }`}
          >
            <r.icon size={18} strokeWidth={2} />
            <span className="flex-1">{label(r.label)}</span>
            {r.id === "alerts" && alertCount > 0 && (
              <span className="rounded-full bg-soft2 px-2 py-[3px] text-[11px] font-bold uppercase tracking-[.08em] text-mut">
                {alertCount}
              </span>
            )}
          </Link>
        ))}
      </section>
    </div>
  );
}
