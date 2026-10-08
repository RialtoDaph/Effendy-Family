import Link from "next/link";
import { MODULES, type ScreenInfo } from "@/lib/nav";
import { ModuleTabs } from "./module-tabs";
import { Card, PageHeader } from "./page-header";

/** Stand-in for pages that are built in a later phase of docs/design/ROADMAP.md. */
export function ScreenPlaceholder({ info }: { info: ScreenInfo }) {
  return (
    <>
      {info.module ? (
        <div className="flex flex-col gap-3">
          <PageHeader eyebrow={MODULES[info.module].name} title={info.title} />
          <ModuleTabs module={info.module} active={info.id} />
        </div>
      ) : (
        <PageHeader eyebrow="RIDEFF Life · Life Together" title={info.title} />
      )}
      <ComingSoon phase={info.phase} blurb={info.blurb} />
    </>
  );
}

export function ComingSoon({ phase, blurb }: { phase: number; blurb: string }) {
  return (
    <Card className="flex flex-col gap-3">
      <span className="self-start rounded-full bg-soft2 px-2.5 py-1 font-mono text-[11px] font-bold uppercase tracking-[.08em] text-mut">
        Coming in phase {phase}
      </span>
      <p className="m-0 text-[15px] font-bold leading-normal">{blurb}</p>
      <p className="m-0 text-[13.5px] leading-normal text-mut">
        The foundation is ready: sign-in, the app shell, offline mode and settings. This page is built next, step by
        step.
      </p>
      <Link href="/settings" className="self-start text-[13.5px] font-bold text-acct">
        Open settings →
      </Link>
    </Card>
  );
}
