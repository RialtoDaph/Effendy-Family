"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, Plus, Search } from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { useAppData } from "@/components/app-data";
import { useMoney } from "@/components/money-data";
import { useMoneyForms } from "@/components/money-forms";
import { LogoTile } from "@/components/logo";
import { useOnline, usePendingCount, useServiceWorker } from "@/components/pwa";
import { THEME_OPTIONS, useTheme } from "@/components/theme";
import { useToast } from "@/components/toast";
import {
  BOTTOM_TABS,
  HOME,
  MODULE_ORDER,
  MODULES,
  TOOLS,
  bottomTabOf,
  hrefOf,
  moduleOf,
  type QuickAddItem,
} from "@/lib/nav";
import { Avatar } from "./avatar";
import { CommandPalette } from "./command-palette";
import { QuickAddSheet } from "./quick-add";

type ShellUI = {
  openQuickAdd: () => void;
  openCommand: () => void;
  runQuickAdd: (item: QuickAddItem) => void;
};

const ShellContext = createContext<ShellUI>({
  openQuickAdd: () => {},
  openCommand: () => {},
  runQuickAdd: () => {},
});

export const useShell = () => useContext(ShellContext);

export function useScreen() {
  const path = usePathname() ?? "/";
  return path === "/" ? "home" : path.split("/")[1];
}

export function AppShell({ children }: { children: ReactNode }) {
  const screen = useScreen();
  const toast = useToast();
  const { openForm } = useMoneyForms();
  const [quickAdd, setQuickAdd] = useState(false);
  const [command, setCommand] = useState(false);
  useServiceWorker();

  // ⌘K / Ctrl+K toggles the command palette anywhere.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCommand((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const runQuickAdd = useCallback(
    (item: QuickAddItem) => {
      setQuickAdd(false);
      if (item.form) openForm(item.form);
      else if (!item.href) toast(`${item.label}: coming in phase ${item.phase}.`);
    },
    [toast, openForm],
  );

  const ui: ShellUI = {
    openQuickAdd: () => setQuickAdd(true),
    openCommand: () => setCommand(true),
    runQuickAdd,
  };

  return (
    <ShellContext value={ui}>
      <Sidebar screen={screen} />
      <MobileHeader />
      <MobileTabBar screen={screen} />
      <main className="px-[14px] pb-[calc(120px+env(safe-area-inset-bottom))] pt-[18px] wide:pb-14 wide:pl-[288px] wide:pr-10 wide:pt-8">
        <div className="mx-auto flex max-w-[1120px] flex-col gap-4">{children}</div>
      </main>
      <button
        data-noprint
        onClick={() => setQuickAdd(true)}
        aria-label="Add"
        className="fixed bottom-[calc(92px+env(safe-area-inset-bottom))] right-[18px] z-40 flex h-[58px] w-[58px] items-center justify-center rounded-full border-0 bg-acc text-onacc shadow-[0_4px_16px_rgba(0,0,0,.18)] hover:bg-acc2 wide:bottom-6 wide:right-7"
      >
        <Plus size={26} strokeWidth={2.5} />
      </button>
      {quickAdd && <QuickAddSheet onClose={() => setQuickAdd(false)} />}
      {command && <CommandPalette onClose={() => setCommand(false)} />}
    </ShellContext>
  );
}

/* Desktop sidebar ----------------------------------------------------------- */

function NavRow({
  href,
  label,
  icon: Icon,
  active,
  tag,
}: {
  href: string;
  label: string;
  icon: typeof Bell;
  active: boolean;
  tag?: number;
}) {
  return (
    <Link
      href={href}
      className={`flex min-h-10 w-full items-center gap-2.5 rounded-[9px] px-2.5 pl-3 text-left text-[13.5px] font-semibold transition-colors ${
        active ? "bg-inv text-white" : "text-mut hover:bg-soft2"
      }`}
    >
      <Icon size={16} strokeWidth={2} />
      <span className="flex-1">{label}</span>
      {!!tag && (
        <span className="rounded-full bg-tint px-[7px] py-[3px] text-[11px] font-extrabold uppercase tracking-[.08em] text-acct">
          {tag}
        </span>
      )}
    </Link>
  );
}

function NavLabel({ children }: { children: ReactNode }) {
  return (
    <div className="px-2.5 pb-1.5 pt-3.5 font-mono text-[11px] font-bold uppercase tracking-[.14em] text-mut2">
      {children}
    </div>
  );
}

function Sidebar({ screen }: { screen: string }) {
  const { openCommand, openQuickAdd } = useShell();
  const { me } = useAppData();
  const { pref, setTheme } = useTheme();
  const { alerts } = useMoney();
  const alertCount = alerts.filter((a) => a.sev !== "info").length;
  const mod = moduleOf(screen);

  return (
    <aside
      data-noprint
      className="fixed inset-y-0 left-0 z-30 hidden w-[248px] flex-col gap-4 overflow-y-auto border-r border-line bg-soft px-3.5 pb-3.5 pt-5 wide:flex"
    >
      <div className="flex items-center gap-2.5 px-2">
        <LogoTile />
        <div>
          <div className="text-[14.5px] font-extrabold leading-none tracking-[-0.01em]">effendy family</div>
          <div className="mt-1 text-[11px] text-mut2">RIDEFF Life · Life Together</div>
        </div>
      </div>
      <div className="flex gap-1.5">
        <button
          onClick={openCommand}
          className="flex min-h-10 min-w-0 flex-1 items-center gap-2 whitespace-nowrap rounded-[10px] border border-line bg-card px-2.5 text-left text-[13px] text-mut hover:border-line2"
        >
          <span className="h-[7px] w-[7px] flex-none rounded-full bg-acc" />
          <span className="flex-1 truncate">Search or ask</span>
          <span className="rounded-[5px] border border-line px-[5px] py-px text-[11px]">⌘K</span>
        </button>
        <button
          onClick={openQuickAdd}
          aria-label="Quick add"
          title="Quick add"
          className="flex h-[38px] w-[38px] flex-none items-center justify-center rounded-[10px] border-0 bg-acc text-onacc"
        >
          <Plus size={16} strokeWidth={2.4} />
        </button>
      </div>
      <nav className="flex flex-1 flex-col gap-px">
        <NavRow href="/" label={HOME.label} icon={HOME.icon} active={screen === "home"} />
        <NavLabel>Modules</NavLabel>
        {MODULE_ORDER.map((k) => (
          <NavRow
            key={k}
            href={hrefOf(MODULES[k].tabs[0].id)}
            label={MODULES[k].name}
            icon={MODULES[k].icon}
            active={mod === k}
          />
        ))}
        <NavLabel>Tools</NavLabel>
        {TOOLS.map((t) => (
          <NavRow
            key={t.id}
            href={hrefOf(t.id)}
            label={t.label}
            icon={t.icon}
            active={screen === t.id}
            tag={t.id === "alerts" ? alertCount : undefined}
          />
        ))}
      </nav>
      <div className="grid grid-cols-3 gap-0.5 rounded-[10px] bg-soft2 p-[3px]">
        {THEME_OPTIONS.map((o) => {
          const on = pref === o.value;
          return (
            <button
              key={o.value}
              onClick={() => setTheme(o.value)}
              aria-label={o.label}
              className={`flex min-h-10 items-center justify-center gap-[5px] rounded-lg border-0 text-[11.5px] font-bold ${
                on ? "bg-card text-ink shadow-[0_1px_3px_rgba(0,0,0,.12)]" : "bg-transparent text-mut"
              }`}
            >
              <o.icon size={13} strokeWidth={2} />
              {o.label}
            </button>
          );
        })}
      </div>
      <Link
        href="/settings"
        className="flex items-center gap-2.5 rounded-xl border border-line bg-card p-2 text-left text-ink"
      >
        <Avatar member={me} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[12.5px] font-bold">Signed in as {me?.display_name ?? "…"}</div>
          <div className="mt-0.5 text-[11px] text-mut2">Account &amp; settings</div>
        </div>
      </Link>
    </aside>
  );
}

/* Mobile header + bottom tabs ---------------------------------------------- */

const roundBtn =
  "flex h-10 w-10 flex-none items-center justify-center rounded-full border border-line bg-card text-ink";

function MobileHeader() {
  const { openCommand } = useShell();
  const { me } = useAppData();
  const { alerts } = useMoney();
  const alertCount = alerts.filter((a) => a.sev !== "info").length;
  const online = useOnline();
  const waiting = usePendingCount();
  const { pref, cycle } = useTheme();
  const ThemeIcon = THEME_OPTIONS.find((o) => o.value === pref)!.icon;

  return (
    <header
      data-noprint
      className="sticky top-0 z-30 flex items-center gap-2 border-b border-line bg-bg px-3 pb-2.5 pt-[calc(10px+env(safe-area-inset-top))] wide:hidden"
    >
      <LogoTile />
      <div className="min-w-0 flex-1 truncate text-[15px] font-extrabold tracking-[-0.01em]">effendy family</div>
      {(!online || waiting > 0) && (
        <span className="flex-none rounded-full bg-soft2 px-[9px] py-1 text-[11px] font-extrabold text-mut">
          {online ? "Syncing" : "Offline"}
          {waiting > 0 && ` · ${waiting}`}
        </span>
      )}
      <button onClick={openCommand} aria-label="Search" className={roundBtn}>
        <Search size={17} strokeWidth={2} />
      </button>
      <Link href="/alerts" aria-label="Alerts" className={`relative ${roundBtn}`}>
        <Bell size={17} strokeWidth={2} />
        {alertCount > 0 && (
          <span className="absolute -right-[3px] -top-[3px] flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-bad px-[5px] text-[11px] font-extrabold text-white">
            {alertCount}
          </span>
        )}
      </Link>
      <button onClick={cycle} aria-label={`Theme: ${pref}`} className={roundBtn}>
        <ThemeIcon size={17} strokeWidth={2} />
      </button>
      <Link href="/settings" aria-label="Account" className={`${roundBtn} p-[3px]`}>
        <Avatar member={me} />
      </Link>
    </header>
  );
}

function MobileTabBar({ screen }: { screen: string }) {
  const current = bottomTabOf(screen);
  return (
    <nav
      data-noprint
      className="fixed inset-x-2.5 bottom-[calc(10px+env(safe-area-inset-bottom))] z-30 grid grid-cols-5 gap-1 rounded-[10px] border border-line bg-card p-1.5 shadow-[0_10px_30px_rgba(0,0,0,.10)] wide:hidden"
    >
      {BOTTOM_TABS.map((t) => {
        const on = current === t.key;
        return (
          <Link
            key={t.key}
            href={t.href}
            className={`flex min-h-[52px] flex-col items-center justify-center gap-1 whitespace-nowrap rounded-[10px] text-[11px] font-bold ${
              on ? "bg-inv text-white" : "text-mut"
            }`}
          >
            <t.icon size={20} strokeWidth={2} />
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
