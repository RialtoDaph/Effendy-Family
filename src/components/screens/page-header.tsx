import type { ReactNode } from "react";

export function PageHeader({ eyebrow, title, children }: { eyebrow: ReactNode; title: ReactNode; children?: ReactNode }) {
  return (
    <div>
      <div className="eyebrow">{eyebrow}</div>
      <h1 className="m-0 mt-1.5 text-[28px] font-extrabold leading-[1.1] tracking-[-0.02em] wide:text-[30px]">{title}</h1>
      {children}
    </div>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-[10px] border border-line bg-card p-5 ${className}`}>{children}</section>;
}
