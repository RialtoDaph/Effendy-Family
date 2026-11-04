"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { useAppData } from "@/components/app-data";
import { useLabel } from "@/components/nav-label";
import { MODULES, hrefOf, type ModuleKey } from "@/lib/nav";
import { lockedBy } from "@/lib/plans";
import { PageHeader } from "./page-header";

/** Pill row for a module's pages. Scrolls sideways when it does not fit. */
export function ModuleTabs({ module, active }: { module: ModuleKey; active: string }) {
  const label = useLabel();
  const { plan } = useAppData();
  const row = useRef<HTMLElement>(null);
  // The current page's pill stays in view on a phone.
  useEffect(() => {
    const el = row.current;
    const on = el?.querySelector<HTMLElement>('[aria-current="page"]');
    if (el && on) el.scrollLeft = on.offsetLeft - el.offsetLeft - (el.clientWidth - on.offsetWidth) / 2;
  }, [active]);
  return (
    <nav ref={row} aria-label={label(MODULES[module].key)} className="flex gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:none]">
      {MODULES[module].tabs.map((t) => {
        const on = t.id === active;
        const need = lockedBy(`/${t.id}`, plan);
        return (
          <Link
            key={t.id}
            href={hrefOf(t.id)}
            aria-current={on ? "page" : undefined}
            className={`hit44 flex h-10 flex-none items-center whitespace-nowrap rounded-full px-4 text-[13px] font-bold ${
              on ? "bg-inv text-white" : "bg-card text-ink"
            }`}
          >
            {label(t.key)}
            {need && <span className="ml-1.5 text-[11px] font-bold text-mut2">{need === "plus" ? "Plus" : "Together"}</span>}
          </Link>
        );
      })}
    </nav>
  );
}

/** Eyebrow, serif title and the module's pills: the top of every module page. */
export function ModuleHeader({ module, active }: { module: ModuleKey; active: string }) {
  const label = useLabel();
  const tab = MODULES[module].tabs.find((t) => t.id === active);
  return (
    <div className="flex flex-col gap-3">
      <PageHeader eyebrow={label(MODULES[module].key)} title={tab ? label(tab.key) : ""} />
      <ModuleTabs module={module} active={active} />
    </div>
  );
}
