import {
  Bell,
  Beer,
  Calendar,
  CalendarDays,
  Camera,
  CreditCard,
  Dumbbell,
  FileText,
  Heart,
  House,
  LayoutGrid,
  ListChecks,
  NotebookPen,
  Receipt,
  Repeat,
  Send,
  Settings,
  SlidersHorizontal,
  Sparkles,
  Target,
  TrendingUp,
  Wallet,
  type LucideIcon,
} from "lucide-react";

export const AI_NAME = "Rialna";

export type ModuleKey = "money" | "time" | "invest" | "life";

type Tab = { id: string; label: string; phase: number; blurb: string };

export const MODULES: Record<ModuleKey, { name: string; icon: LucideIcon; tabs: Tab[] }> = {
  money: {
    name: "Money",
    icon: Wallet,
    tabs: [
      { id: "budget", label: "Budget", phase: 1, blurb: "Monthly limits per category, flexible money left and your daily allowance." },
      { id: "debts", label: "Debts", phase: 2, blurb: "Payoff order with avalanche or snowball, and your debt-free date." },
      { id: "import", label: "Bank import", phase: 3, blurb: "Read CSV or PDF statements from any bank, without duplicates." },
      { id: "recur", label: "Recurring", phase: 1, blurb: "Rent, insurance and salaries that post themselves every month." },
      { id: "subs", label: "Subscriptions", phase: 2, blurb: "What you pay for, and what you have not used in 45+ days." },
      { id: "remit", label: "To Indonesia", phase: 2, blurb: "Transfers home in EUR and Rupiah, with a provider comparison." },
      { id: "biz", label: "Business", phase: 2, blurb: "Monthly totals and the monthly report file for each business." },
      { id: "tax", label: "Taxes & refund", phase: 2, blurb: "Tax pot, deadlines and the refund estimate." },
    ],
  },
  time: {
    name: "Time & goals",
    icon: CalendarDays,
    tabs: [
      { id: "week", label: "This week", phase: 4, blurb: "Three priorities and a 7-day board for both of you." },
      { id: "shifts", label: "Shifts", phase: 4, blurb: "Bar shifts and hours, read straight from the roster." },
      { id: "ygoals", label: "Yearly goals", phase: 4, blurb: "A 52-week strip per goal and this week's step." },
      { id: "learn", label: "Learning", phase: 4, blurb: "Minutes per person, books and courses." },
    ],
  },
  invest: {
    name: "Invest & career",
    icon: TrendingUp,
    tabs: [
      { id: "invest", label: "Overview", phase: 2, blurb: "Net worth and what you own, in EUR and IDR." },
      { id: "sim", label: "10-year simulation", phase: 5, blurb: "Bad, middle and good scenarios for the next ten years." },
      { id: "career", label: "Career", phase: 5, blurb: "The Studio plan and its stages." },
    ],
  },
  life: {
    name: "Life",
    icon: Heart,
    tabs: [
      { id: "gym", label: "Gym", phase: 4, blurb: "Sessions per person per week." },
      { id: "together", label: "Date nights", phase: 4, blurb: "This Friday's plan and ideas around Eichstätt." },
      { id: "journal", label: "Journal", phase: 4, blurb: "Private by default. Only you can read it." },
    ],
  },
};

export const MODULE_ORDER: ModuleKey[] = ["money", "time", "invest", "life"];

type Tool = { id: string; label: string; icon: LucideIcon; phase: number; blurb: string };

export const TOOLS: Tool[] = [
  { id: "alerts", label: "Alerts", icon: Bell, phase: 1, blurb: "What needs attention, what is coming up, and what is good to know." },
  { id: "report", label: "Monthly report", icon: FileText, phase: 5, blurb: "A print-ready summary of the month, saved as PDF." },
  { id: "ask", label: `Ask ${AI_NAME}`, icon: Sparkles, phase: 5, blurb: "Ask about your money and plans. Answers come with numbers and a next step." },
  { id: "whatif", label: "What if", icon: SlidersHorizontal, phase: 5, blurb: "Move a slider and see what changes for your goals." },
  { id: "settings", label: "Settings", icon: Settings, phase: 0, blurb: "" },
  { id: "setup", label: "Setup & data", icon: ListChecks, phase: 1, blurb: "Put your real data in, step by step." },
];

export const HOME = { id: "home", label: "Home", icon: House, phase: 1, blurb: "Your 10-second daily view: money left, this week, goals." };

export function hrefOf(id: string) {
  return id === "home" ? "/" : `/${id}`;
}

export function moduleOf(screen: string): ModuleKey | undefined {
  return MODULE_ORDER.find((k) => MODULES[k].tabs.some((t) => t.id === screen));
}

export type ScreenInfo = {
  id: string;
  title: string;
  phase: number;
  blurb: string;
  module?: ModuleKey;
};

export function screenInfo(id: string): ScreenInfo | undefined {
  if (id === "home") return { id, title: HOME.label, phase: HOME.phase, blurb: HOME.blurb };
  const mod = moduleOf(id);
  if (mod) {
    const t = MODULES[mod].tabs.find((x) => x.id === id)!;
    return { id, title: t.label, phase: t.phase, blurb: t.blurb, module: mod };
  }
  const tool = TOOLS.find((t) => t.id === id);
  if (tool) return { id, title: tool.label, phase: tool.phase, blurb: tool.blurb };
  return undefined;
}

/** Screens with their own page under app/(app)/. */
export const BUILT_SCREENS = ["settings", "budget", "recur", "alerts", "setup"];

/** Screens served by app/(app)/[screen]/page.tsx. Keep public/sw.js PAGES in sync. */
export const PLACEHOLDER_SCREENS = [
  ...MODULE_ORDER.flatMap((k) => MODULES[k].tabs.map((t) => t.id)),
  ...TOOLS.map((t) => t.id),
].filter((id) => !BUILT_SCREENS.includes(id));

export const BOTTOM_TABS = [
  { key: "home", label: "Home", icon: House, href: "/" },
  { key: "money", label: "Money", icon: Wallet, href: "/budget" },
  { key: "ask", label: "Ask", icon: Sparkles, href: "/ask" },
  { key: "whatif", label: "What if", icon: SlidersHorizontal, href: "/whatif" },
  { key: "more", label: "More", icon: LayoutGrid, href: "/more" },
] as const;

export function bottomTabOf(screen: string): string {
  if (screen === "home") return "home";
  if (screen === "ask") return "ask";
  if (screen === "whatif") return "whatif";
  if (moduleOf(screen) === "money") return "money";
  return "more";
}

export type QuickAddItem = {
  key: string;
  label: string;
  icon: LucideIcon;
  phase: number;
  href?: string;
  /** Opens this money form (components/money-forms.tsx). */
  form?: "tx" | "goal" | "recur";
};

export const QUICK_ADD: QuickAddItem[] = [
  { key: "scan", label: "Scan receipt", icon: Camera, phase: 3 },
  { key: "debt", label: "Debt", icon: CreditCard, phase: 2 },
  { key: "tx", label: "Transaction", icon: Receipt, phase: 1, form: "tx" },
  { key: "event", label: "Calendar event", icon: Calendar, phase: 4 },
  { key: "shift", label: "Bar shift", icon: Beer, phase: 4 },
  { key: "goal", label: "Goal", icon: Target, phase: 1, form: "goal" },
  { key: "sub", label: "Subscription", icon: Repeat, phase: 2 },
  { key: "asset", label: "Investment value", icon: TrendingUp, phase: 2 },
  { key: "gym", label: "Gym session", icon: Dumbbell, phase: 4, href: "/gym" },
  { key: "journal", label: "Journal note", icon: NotebookPen, phase: 4, href: "/journal" },
  { key: "recur", label: "Recurring payment", icon: Repeat, phase: 1, form: "recur" },
  { key: "remit", label: "Transfer home", icon: Send, phase: 2 },
];
