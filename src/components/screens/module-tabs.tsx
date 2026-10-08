"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { MODULES, hrefOf, type ModuleKey } from "@/lib/nav";

/** Pill row for a module's pages. Keeps the active pill scrolled into view. */
export function ModuleTabs({ module, active }: { module: ModuleKey; active: string }) {
  const rowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const row = rowRef.current;
    const pill = row?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!row || !pill) return;
    const left = pill.offsetLeft - row.offsetLeft;
    if (left < row.scrollLeft || left + pill.offsetWidth > row.scrollLeft + row.clientWidth) {
      row.scrollTo({ left: Math.max(0, left - 14), behavior: "smooth" });
    }
  }, [active]);

  return (
    <div ref={rowRef} className="no-scrollbar flex gap-1.5 overflow-x-auto pb-0.5 [-webkit-overflow-scrolling:touch]">
      {MODULES[module].tabs.map((t) => {
        const on = t.id === active;
        return (
          <Link
            key={t.id}
            href={hrefOf(t.id)}
            aria-current={on ? "page" : undefined}
            className={`flex h-10 flex-none items-center whitespace-nowrap rounded-full px-4 text-[13px] font-bold ${
              on ? "bg-inv text-white" : "bg-card text-ink"
            }`}
          >
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}
