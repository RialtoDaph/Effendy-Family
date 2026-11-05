import {
  Bell,
  Beer,
  Calendar,
  CalendarDays,
  Camera,
  CircleHelp,
  CreditCard,
  Dumbbell,
  FileText,
  Heart,
  House,
  LayoutGrid,
  ListChecks,
  Map,
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

export const AI_NAME = "Clopar";

type Messages = typeof import("@/messages/en.json");

/** A message path such as "nav.budget"; see src/messages. */
export type LabelKey = `nav.${keyof Messages["nav"] & string}` | `copy.${keyof Messages["copy"] & string}` | `ui.${keyof Messages["ui"] & string}`;

export type ModuleKey = "money" | "time" | "invest" | "life";

type Tab = { id: string; label: string; key: LabelKey; phase: number; blurb: string };

export const MODULES: Record<ModuleKey, { name: string; key: LabelKey; icon: LucideIcon; tabs: Tab[] }> = {
  money: {
    name: "Money",
    key: "nav.money",
    icon: Wallet,
    tabs: [
      { id: "budget", label: "Budget", key: "nav.budget", phase: 1, blurb: "Monthly limits per category, flexible money left and your daily allowance." },
      { id: "debts", label: "Debts", key: "nav.debts", phase: 2, blurb: "Payoff order with avalanche or snowball, and your debt-free date." },
      { id: "import", label: "Bank import", key: "nav.bank_import", phase: 3, blurb: "Read CSV or PDF statements from any bank, without duplicates." },
      { id: "recur", label: "Recurring & subscriptions", key: "nav.recurring_subscriptions", phase: 1, blurb: "Rent, insurance, salaries and subscriptions that post themselves every month." },
      { id: "remit", label: "To Indonesia", key: "nav.to_indonesia", phase: 2, blurb: "Transfers home in EUR and Rupiah, with a provider comparison." },
      { id: "biz", label: "Business", key: "nav.business", phase: 2, blurb: "Monthly totals and the monthly report file for each business." },
      { id: "tax", label: "Taxes & refund", key: "nav.taxes_refund", phase: 2, blurb: "Tax pot, deadlines and the refund estimate." },
    ],
  },
  time: {
    name: "Time & goals",
    key: "nav.time_goals",
    icon: CalendarDays,
    tabs: [
      { id: "week", label: "This week", key: "nav.this_week", phase: 4, blurb: "Three priorities and a 7-day board for both of you." },
      { id: "shifts", label: "Shifts", key: "nav.shifts", phase: 4, blurb: "Bar shifts and hours, read straight from the roster." },
      { id: "ygoals", label: "Yearly goals", key: "nav.yearly_goals", phase: 4, blurb: "A 52-week strip per goal and this week's step." },
      { id: "learn", label: "Learning", key: "nav.learning", phase: 4, blurb: "Minutes per person, books and courses." },
    ],
  },
  invest: {
    name: "Invest & career",
    key: "nav.invest_career",
    icon: TrendingUp,
    tabs: [
      { id: "invest", label: "Overview", key: "nav.overview", phase: 2, blurb: "Net worth and what you own, in EUR and IDR." },
      { id: "sim", label: "10-year simulation", key: "nav.10_year_simulation", phase: 5, blurb: "Bad, middle and good scenarios for the next ten years." },
      { id: "career", label: "Career", key: "nav.career", phase: 5, blurb: "The Studio plan and its stages." },
    ],
  },
  life: {
    name: "Life",
    key: "nav.life",
    icon: Heart,
    tabs: [
      { id: "gym", label: "Gym", key: "nav.gym", phase: 4, blurb: "Sessions per person per week." },
      { id: "together", label: "Date nights", key: "nav.date_nights", phase: 4, blurb: "This Friday's plan and ideas around Eichstätt." },
      { id: "journal", label: "Journal", key: "nav.journal", phase: 4, blurb: "Private by default. Only you can read it." },
    ],
  },
};

export const MODULE_ORDER: ModuleKey[] = ["money", "time", "invest", "life"];

type Tool = { id: string; label: string; key: LabelKey; icon: LucideIcon; phase: number; blurb: string };

export const TOOLS: Tool[] = [
  { id: "alerts", label: "Alerts", key: "nav.alerts", icon: Bell, phase: 1, blurb: "What needs attention, what is coming up, and what is good to know." },
  { id: "report", label: "Monthly report", key: "nav.monthly_report", icon: FileText, phase: 5, blurb: "A print-ready summary of the month, saved as PDF." },
  { id: "ask", label: `Ask ${AI_NAME}`, key: "ui.ask_name", icon: Sparkles, phase: 5, blurb: "Ask about your money and plans. Answers come with numbers and a next step." },
  { id: "whatif", label: "What if", key: "nav.what_if", icon: SlidersHorizontal, phase: 5, blurb: "Move a slider and see what changes for your goals." },
  { id: "plan", label: "Plan & billing", key: "nav.plan_billing", icon: CreditCard, phase: 7, blurb: "" },
  { id: "settings", label: "Settings", key: "nav.settings", icon: Settings, phase: 0, blurb: "" },
  { id: "help", label: "Help", key: "ui.help", icon: CircleHelp, phase: 7, blurb: "" },
  { id: "setup", label: "Setup & data", key: "nav.setup_data", icon: ListChecks, phase: 1, blurb: "Put your real data in, step by step." },
];

export const HOME = { id: "home", label: "Home", key: "nav.home" as LabelKey, icon: House, phase: 1, blurb: "Your 10-second daily view: money left, this week, goals." };

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

export const BOTTOM_TABS: { key: string; label: LabelKey; icon: LucideIcon; href: string; orb?: boolean }[] = [
  { key: "home", label: "nav.home", icon: House, href: "/" },
  { key: "money", label: "nav.money", icon: Wallet, href: "/budget" },
  { key: "ask", label: "ui.ask_name", icon: Sparkles, href: "/ask", orb: true },
  { key: "map", label: "ui.map", icon: Map, href: "/map" },
  { key: "more", label: "nav.more", icon: LayoutGrid, href: "/more" },
];

export function bottomTabOf(screen: string): string {
  if (screen === "home") return "home";
  if (screen === "ask") return "ask";
  if (screen === "map") return "map";
  if (moduleOf(screen) === "money" || screen === "subs") return "money";
  return "more";
}

export type QuickAddItem = {
  key: string;
  label: LabelKey;
  icon: LucideIcon;
  phase: number;
  href?: string;
  /** Opens this money form (components/money-forms.tsx). */
  form?: "tx" | "scan" | "goal" | "recur" | "debt" | "sub" | "asset" | "remit" | "event" | "shift" | "gym" | "journal";
};

export const QUICK_ADD: QuickAddItem[] = [
  { key: "scan", label: "copy.scan_receipt", icon: Camera, phase: 3, form: "scan" },
  { key: "debt", label: "ui.debt", icon: CreditCard, phase: 2, form: "debt" },
  { key: "tx", label: "ui.transaction", icon: Receipt, phase: 1, form: "tx" },
  { key: "event", label: "ui.calendar_event", icon: Calendar, phase: 4, form: "event" },
  { key: "shift", label: "ui.bar_shift", icon: Beer, phase: 4, form: "shift" },
  { key: "goal", label: "copy.goal", icon: Target, phase: 1, form: "goal" },
  { key: "sub", label: "ui.subscription", icon: Repeat, phase: 2, form: "sub" },
  { key: "asset", label: "ui.investment_value", icon: TrendingUp, phase: 2, form: "asset" },
  { key: "gym", label: "ui.gym_session", icon: Dumbbell, phase: 4, form: "gym" },
  { key: "journal", label: "ui.journal_note", icon: NotebookPen, phase: 4, form: "journal" },
  { key: "recur", label: "ui.recurring_payment", icon: Repeat, phase: 1, form: "recur" },
  { key: "remit", label: "ui.transfer_home", icon: Send, phase: 2, form: "remit" },
];
