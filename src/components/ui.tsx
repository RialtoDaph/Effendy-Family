import { Lock } from "lucide-react";
import type { ReactNode } from "react";
import type { Member } from "@/components/app-data";
import { avatarColors } from "@/components/shell/avatar";
import { STATUS_LABEL, type Status } from "@/lib/money";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-[10px] border border-line bg-card p-5 ${className}`}>{children}</section>;
}

export function H2({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <h2 className={`m-0 text-lg font-extrabold ${className}`}>{children}</h2>;
}

/** "+ Add" tint pill used next to section titles. */
export function AddButton({ onClick, label = "+ Add" }: { onClick: () => void; label?: string }) {
  return (
    <button
      onClick={onClick}
      className="min-h-10 whitespace-nowrap rounded-full border-0 bg-tint px-3 text-[12.5px] font-extrabold text-acct"
    >
      {label}
    </button>
  );
}

const STATUS_STYLE: Record<Status, string> = {
  over: "bg-badbg text-bad",
  near: "bg-warnbg text-warnt",
  fast: "bg-warnbg text-warnt",
  paid: "bg-soft2 text-mut",
  notyet: "bg-soft2 text-mut",
  ontrack: "bg-soft2 text-mut",
};

export function StatusPill({ status }: { status: Status }) {
  return (
    <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-extrabold ${STATUS_STYLE[status]}`}>
      {STATUS_LABEL[status]}
    </span>
  );
}

export function statusBarColor(status: Status, fixed: boolean) {
  if (status === "over") return "var(--bad)";
  if (status === "near" || status === "fast") return "var(--warn)";
  return fixed ? "var(--line2)" : "var(--ink)";
}

/** Segmented control (3–4 options), selected segment raised. */
export function Segmented<T extends string | number>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex gap-0.5 rounded-[10px] bg-soft2 p-[3px]">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={String(o.value)}
            onClick={() => onChange(o.value)}
            aria-pressed={on}
            className={`min-h-10 rounded-lg border-0 px-3 text-[13px] font-bold ${
              on ? "bg-card text-ink shadow-[0_1px_3px_rgba(0,0,0,.12)]" : "bg-transparent text-mut"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** Small owner pill: "Rialto", "Amnah", "Family". */
export function OwnerPill({ member, fallback = "Family" }: { member: Member | undefined; fallback?: string }) {
  const { bg, fg } = member ? avatarColors(member) : { bg: "var(--acc)", fg: "var(--onacc)" };
  return (
    <span className="whitespace-nowrap rounded-full px-[9px] py-[3px] text-[11px] font-bold" style={{ background: bg, color: fg }}>
      {member?.display_name ?? fallback}
    </span>
  );
}

export function PrivateMark() {
  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-mut2" title="Only you can see this">
      <Lock size={11} strokeWidth={2.2} />
      Only me
    </span>
  );
}

export function ProgressBar({ pct, color = "var(--acc)", height = 6 }: { pct: number; color?: string; height?: number }) {
  return (
    <div className="overflow-hidden rounded-full bg-soft2" style={{ height }}>
      <div className="h-full rounded-full" style={{ width: `${Math.max(0, Math.min(100, pct))}%`, background: color }} />
    </div>
  );
}

export function EmptyNote({ children }: { children: ReactNode }) {
  return <div className="rounded-[10px] bg-soft px-3.5 py-3 text-[13px] leading-normal text-mut">{children}</div>;
}
