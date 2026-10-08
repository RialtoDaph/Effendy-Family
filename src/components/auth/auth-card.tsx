import type { ReactNode } from "react";
import { LogoTile } from "@/components/logo";

export function AuthCard({ title, sub, children }: { title: string; sub: string; children: ReactNode }) {
  return (
    <main className="flex min-h-dvh items-center justify-center px-4 pb-[calc(24px+env(safe-area-inset-bottom))] pt-[calc(24px+env(safe-area-inset-top))]">
      <div className="flex w-full max-w-[400px] flex-col items-center gap-5">
        <LogoTile size={52} />
        <div className="text-center">
          <h1 className="m-0 text-[22px] font-extrabold tracking-[-0.01em]">{title}</h1>
          <p className="m-0 mt-1 text-[13.5px] text-mut">{sub}</p>
        </div>
        <div className="flex w-full flex-col gap-3 rounded-[24px] border border-line bg-card p-[22px]">{children}</div>
      </div>
    </main>
  );
}

export const authInput =
  "h-[50px] w-full rounded-[10px] border border-line bg-soft px-3.5 text-base text-ink outline-none focus:border-line2";
export const authPrimary =
  "h-[50px] w-full rounded-full border-0 bg-acc text-[15px] font-extrabold text-onacc hover:bg-acc2 disabled:opacity-60";
export const authSecondary =
  "flex h-[50px] w-full items-center justify-center gap-2 rounded-full border border-line bg-card text-[14px] font-bold text-ink disabled:opacity-60";
