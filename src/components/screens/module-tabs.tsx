"use client";

import Link from "next/link";
import { MODULES, hrefOf, type ModuleKey } from "@/lib/nav";

/** Pill row for a module's pages. Wraps onto a second line so every page stays visible. */
export function ModuleTabs({ module, active }: { module: ModuleKey; active: string }) {
  return (
    <nav aria-label="Pages in this section" className="flex flex-wrap gap-1.5">
      {MODULES[module].tabs.map((t) => {
        const on = t.id === active;
        return (
          <Link
            key={t.id}
            href={hrefOf(t.id)}
            aria-current={on ? "page" : undefined}
            className={`flex h-10 flex-none items-center whitespace-nowrap rounded-full border px-3.5 text-[13px] font-bold ${
              on ? "border-inv bg-inv text-white" : "border-line bg-card text-ink"
            }`}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
