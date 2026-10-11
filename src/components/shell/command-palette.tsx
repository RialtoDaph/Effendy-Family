"use client";

import { ASK_EVENT, ASK_HANDOFF } from "@/lib/ask";
import { useRouter } from "next/navigation";
import {
  BookOpen,
  CalendarDays,
  CircleDot,
  CreditCard,
  Heart,
  NotebookPen,
  Receipt,
  Repeat,
  Search,
  Settings,
  Sparkles,
  Tag,
  Target,
  TrendingUp,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useAppData } from "@/components/app-data";
import { useFinance } from "@/components/finance-data";
import { useMoney } from "@/components/money-data";
import { useMoneyForms } from "@/components/money-forms";
import { useTime } from "@/components/time-data";
import { useTheme } from "@/components/theme";
import { searchData, type HitKind } from "@/lib/search";
import { AI_NAME, HOME, MODULE_ORDER, MODULES, QUICK_ADD, TOOLS, hrefOf } from "@/lib/nav";
import { useShell } from "./app-shell";

type Cmd = { label: string; icon: LucideIcon; hint: string; detail?: string; run: () => void };

const HIT_ICON: Record<HitKind, LucideIcon> = {
  transaction: Receipt,
  recurring: Repeat,
  income: Wallet,
  goal: Target,
  category: Tag,
  subscription: Repeat,
  debt: CreditCard,
  asset: TrendingUp,
  event: CalendarDays,
  ygoal: Target,
  learning: BookOpen,
  idea: Heart,
  journal: NotebookPen,
};

export function CommandPalette({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const { runQuickAdd } = useShell();
  const { setTheme } = useTheme();
  const { userId } = useAppData();
  const money = useMoney();
  const fin = useFinance();
  const time = useTime();
  const { openForm } = useMoneyForms();
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => inputRef.current?.focus(), []);

  const groups = useMemo(() => {
    const go = (id: string) => () => {
      onClose();
      router.push(hrefOf(id));
    };
    const jump: Cmd[] = [{ label: HOME.label, icon: HOME.icon, hint: "Go", run: go("home") }];
    for (const k of MODULE_ORDER) {
      const M = MODULES[k];
      jump.push({ label: M.name, icon: M.icon, hint: "Go", run: go(M.tabs[0].id) });
      for (const t of M.tabs) jump.push({ label: `${M.name} › ${t.label}`, icon: CircleDot, hint: "Go", run: go(t.id) });
    }
    for (const t of TOOLS) jump.push({ label: t.label, icon: t.icon, hint: "Go", run: go(t.id) });

    const add: Cmd[] = QUICK_ADD.map((item) => ({
      label: `Add ${item.label.toLowerCase()}`,
      icon: item.icon,
      hint: "New",
      run: () => {
        onClose();
        if (item.href) router.push(item.href);
        runQuickAdd(item);
      },
    }));
    const prefs: Cmd[] = (
      [
        ["light", "Light mode"],
        ["dark", "Dark mode"],
        ["auto", "Auto theme"],
      ] as const
    ).map(([v, label]) => ({
      label,
      icon: Settings,
      hint: "Theme",
      run: () => {
        onClose();
        setTheme(v);
      },
    }));

    const query = q.trim().toLowerCase();
    const f = (xs: Cmd[]) => (query ? xs.filter((x) => x.label.toLowerCase().includes(query)) : xs);
    const out: { label: string; items: Cmd[] }[] = [];
    const ask = () => {
      try {
        sessionStorage.setItem(ASK_HANDOFF, q.trim());
      } catch {}
      go("ask")();
      window.dispatchEvent(new Event(ASK_EVENT));
    };
    // Your own data first (works offline and without Rialna), then pages, then Ask.
    const hits: Cmd[] = searchData(q, {
      viewerId: userId,
      transactions: money.transactions,
      recurring: money.recurring,
      incomes: money.incomes,
      goals: money.goals,
      categories: money.categories,
      subscriptions: fin.subscriptions,
      debts: fin.debts,
      assets: fin.assets,
      events: time.events,
      yearlyGoals: time.yearlyGoals,
      learningItems: time.learningItems,
      dateIdeas: time.dateIdeas,
      journal: time.journal,
    }).map((h) => ({
      label: h.label,
      detail: h.detail,
      icon: HIT_ICON[h.kind],
      hint: "Open",
      run: () => {
        onClose();
        openForm(h.form as Parameters<typeof openForm>[0], h.id);
      },
    }));
    if (hits.length) out.push({ label: "In your data", items: hits });
    const sections: [string, Cmd[], number][] = [
      ["Jump to", f(jump), 8],
      ["Quick add", f(add), 9],
      ["Settings", f(prefs), 9],
    ];
    for (const [label, items, max] of sections) {
      if (items.length) out.push({ label, items: query ? items.slice(0, 6) : items.slice(0, max) });
    }
    if (query) out.push({ label: "Ask", items: [{ label: `Ask ${AI_NAME}: “${q.trim()}”`, icon: Sparkles, hint: "Ask", run: ask }] });
    return out;
  }, [q, onClose, router, runQuickAdd, setTheme, userId, money, fin, time, openForm]);

  // With no match, ↵ asks Rialna (README → Command palette).
  const flat = groups.flatMap((g) => g.items);

  function onKey(e: React.KeyboardEvent) {
    if (e.key === "Escape") onClose();
    else if (e.key === "ArrowDown") {
      e.preventDefault();
      setSel((s) => Math.min(s + 1, flat.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSel((s) => Math.max(s - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      flat[sel]?.run();
    }
  }

  let idx = 0;
  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[70] flex items-start justify-center bg-[rgba(10,11,13,.32)] px-3.5 pb-3.5 pt-[12vh]"
    >
      <div
        role="dialog"
        aria-label="Search"
        onClick={(e) => e.stopPropagation()}
        className="flex w-full max-w-[620px] flex-col overflow-hidden rounded-[14px] border border-line bg-card shadow-[0_24px_70px_rgba(0,0,0,.28)]"
      >
        <div className="flex items-center gap-2.5 border-b border-line px-4">
          <Search size={18} strokeWidth={2} className="flex-none text-mut2" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setSel(0);
            }}
            onKeyDown={onKey}
            placeholder={`Search your data, pages, or ask ${AI_NAME}…`}
            className="h-14 min-w-0 flex-1 border-0 bg-transparent text-base text-ink outline-none"
          />
          <button
            onClick={onClose}
            className="no-hit flex-none rounded-md border border-line bg-soft px-[7px] py-[3px] font-mono text-[11px] text-mut"
          >
            esc
          </button>
        </div>
        <div className="max-h-[56vh] overflow-y-auto p-1.5">
          {groups.map((g) => (
            <div key={g.label}>
              <div className="px-2.5 pb-1 pt-2.5 font-mono text-[11px] font-bold uppercase tracking-[.14em] text-mut2">
                {g.label}
              </div>
              {g.items.map((c) => {
                const i = idx++;
                return (
                  <button
                    key={g.label + c.label}
                    onClick={c.run}
                    onMouseEnter={() => setSel(i)}
                    className={`flex min-h-11 w-full items-center gap-3 rounded-[9px] border-0 px-2.5 text-left text-sm font-semibold text-ink ${
                      i === sel ? "bg-soft2" : "bg-transparent"
                    }`}
                  >
                    <span className="flex h-7 w-7 flex-none items-center justify-center rounded-[7px] bg-soft2">
                      <c.icon size={15} strokeWidth={1.9} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">{c.label}</span>
                      {c.detail && <span className="block truncate text-xs font-medium text-mut2">{c.detail}</span>}
                    </span>
                    <span className="font-mono text-[11.5px] text-mut2">{c.hint}</span>
                  </button>
                );
              })}
            </div>
          ))}
          {!groups.length && (
            <div className="px-3 py-6 text-center text-[13.5px] text-mut">Type to search your data and pages, or ask {AI_NAME}.</div>
          )}
        </div>
        <div className="hidden gap-4 border-t border-line bg-soft px-4 py-2.5 font-mono text-[11.5px] text-mut2 wide:flex">
          <span>↑↓ move</span>
          <span>↵ open</span>
          <span>⌘K toggle</span>
        </div>
      </div>
    </div>
  );
}
