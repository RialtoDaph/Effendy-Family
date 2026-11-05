"use client";

import { ASK_EVENT, ASK_HANDOFF } from "@/lib/ask";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
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
import { useAiName, useAppData } from "@/components/app-data";
import { useFinance } from "@/components/finance-data";
import { useMoney } from "@/components/money-data";
import { useMoneyForms } from "@/components/money-forms";
import { useLabel } from "@/components/nav-label";
import { useTime } from "@/components/time-data";
import { useTheme } from "@/components/theme";
import { searchData, type HitKind } from "@/lib/search";
import { HOME, MODULE_ORDER, MODULES, QUICK_ADD, TOOLS, hrefOf } from "@/lib/nav";
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
  const aiName = useAiName();
  const router = useRouter();
  const { runQuickAdd } = useShell();
  const { setTheme } = useTheme();
  const { userId } = useAppData();
  const money = useMoney();
  const fin = useFinance();
  const time = useTime();
  const { openForm } = useMoneyForms();
  const t = useTranslations();
  const label = useLabel();
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => inputRef.current?.focus(), []);

  const groups = useMemo(() => {
    const go = (id: string) => () => {
      onClose();
      router.push(hrefOf(id));
    };
    const hintGo = t("ui.hint_go");
    const jump: Cmd[] = [{ label: label(HOME.key), icon: HOME.icon, hint: hintGo, run: go("home") }];
    for (const k of MODULE_ORDER) {
      const M = MODULES[k];
      jump.push({ label: label(M.key), icon: M.icon, hint: hintGo, run: go(M.tabs[0].id) });
      for (const tab of M.tabs) jump.push({ label: `${label(M.key)} › ${label(tab.key)}`, icon: CircleDot, hint: hintGo, run: go(tab.id) });
    }
    for (const tool of TOOLS) jump.push({ label: label(tool.key), icon: tool.icon, hint: hintGo, run: go(tool.id) });

    const add: Cmd[] = QUICK_ADD.map((item) => ({
      label: t("ui.add_item", { item: label(item.label) }),
      icon: item.icon,
      hint: t("ui.hint_new"),
      run: () => {
        onClose();
        if (item.href) router.push(item.href);
        runQuickAdd(item);
      },
    }));
    const prefs: Cmd[] = (
      [
        ["light", t("ui.theme_light")],
        ["dark", t("ui.theme_dark")],
        ["auto", t("ui.theme_auto")],
      ] as const
    ).map(([v, text]) => ({
      label: text,
      icon: Settings,
      hint: t("ui.hint_theme"),
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
    // Your own data first (works offline and without Clopar), then pages, then Ask.
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
      hint: t("ui.hint_open"),
      run: () => {
        onClose();
        openForm(h.form as Parameters<typeof openForm>[0], h.id);
      },
    }));
    if (hits.length) out.push({ label: t("ui.in_your_data"), items: hits });
    const sections: [string, Cmd[], number][] = [
      [t("copy.jump_to"), f(jump), 8],
      [t("copy.quick_add"), f(add), 9],
      [t("nav.settings"), f(prefs), 9],
    ];
    for (const [title, items, max] of sections) {
      if (items.length) out.push({ label: title, items: query ? items.slice(0, 6) : items.slice(0, max) });
    }
    if (query) out.push({ label: t("nav.ask"), items: [{ label: t("ui.ask_query", { name: aiName, query: q.trim() }), icon: Sparkles, hint: t("ui.hint_ask"), run: ask }] });
    return out;
  }, [q, onClose, router, runQuickAdd, setTheme, userId, money, fin, time, openForm, t, label, aiName]);

  // With no match, ↵ asks Clopar (README → Command palette).
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
        aria-label={t("copy.search")}
        onClick={(e) => e.stopPropagation()}
        className="flex w-full max-w-[620px] flex-col overflow-hidden rounded-[14px] border border-line bg-card shadow-palette"
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
            placeholder={t("ui.search_placeholder", { name: aiName })}
            className="h-14 min-w-0 flex-1 border-0 bg-transparent text-base text-ink outline-none"
          />
          <button
            onClick={onClose}
            className="flex-none rounded-md border border-line bg-soft px-[7px] py-[3px] font-mono text-[11px] text-mut"
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
            <div className="px-3 py-6 text-center text-[13.5px] text-mut">{t("ui.search_empty", { name: aiName })}</div>
          )}
        </div>
        <div className="hidden gap-4 border-t border-line bg-soft px-4 py-2.5 font-mono text-[11.5px] text-mut2 wide:flex">
          <span>{t("ui.key_move")}</span>
          <span>{t("ui.key_open")}</span>
          <span>{t("ui.key_toggle")}</span>
        </div>
      </div>
    </div>
  );
}
