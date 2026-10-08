import Link from "next/link";
import { MODULE_ORDER, MODULES, TOOLS, hrefOf } from "@/lib/nav";

const rows = [
  ...MODULE_ORDER.map((k) => ({ id: MODULES[k].tabs[0].id, label: MODULES[k].name, icon: MODULES[k].icon })),
  ...TOOLS.map((t) => ({ id: t.id, label: t.label, icon: t.icon })),
];

export default function MorePage() {
  return (
    <div className="flex flex-col gap-3">
      <h1 className="m-0 text-[28px] font-extrabold tracking-[-0.02em]">All modules</h1>
      <section className="rounded-[10px] border border-line bg-card px-4 py-1.5">
        {rows.map((r, i) => (
          <Link
            key={r.id}
            href={hrefOf(r.id)}
            className={`flex min-h-[54px] w-full items-center gap-3 text-left text-[15px] font-bold text-ink ${
              i < rows.length - 1 ? "border-b border-line" : ""
            }`}
          >
            <r.icon size={18} strokeWidth={2} />
            <span className="flex-1">{r.label}</span>
          </Link>
        ))}
      </section>
    </div>
  );
}
