"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useLabel } from "@/components/nav-label";
import { Sheet } from "@/components/sheet";
import { QUICK_ADD } from "@/lib/nav";
import { useShell } from "./app-shell";

const tileCls =
  "flex min-h-[84px] flex-col items-start gap-1.5 rounded-[18px] border border-line bg-card p-3.5 text-left hover:bg-soft";

export function QuickAddSheet({ onClose }: { onClose: () => void }) {
  const t = useTranslations("copy");
  const label = useLabel();
  const { runQuickAdd } = useShell();
  return (
    <Sheet title={t("add_something")} onClose={onClose}>
      <div className="grid grid-cols-2 gap-2">
        {QUICK_ADD.map((item) => {
          const body = (
            <>
              <item.icon size={23} strokeWidth={1.7} />
              <span className="text-sm font-extrabold text-ink">{label(item.label)}</span>
            </>
          );
          return item.href ? (
            <Link key={item.key} href={item.href} onClick={() => runQuickAdd(item)} className={tileCls}>
              {body}
            </Link>
          ) : (
            <button key={item.key} onClick={() => runQuickAdd(item)} className={tileCls}>
              {body}
            </button>
          );
        })}
      </div>
    </Sheet>
  );
}
