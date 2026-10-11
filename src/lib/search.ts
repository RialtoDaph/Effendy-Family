// Search box (⌘K): finds your own data, not only pages. Works offline and
// without Rialna, on what this phone has loaded (already limited by Private/Family).

import type { Asset, Debt, Subscription } from "./finance";
import { eur, shortDate, type Category, type Goal, type Income, type Recurring, type Transaction } from "./money";
import type { CalEvent, DateIdea, JournalEntry, LearningItem, YearlyGoal } from "./time";

export type HitKind =
  | "transaction"
  | "recurring"
  | "income"
  | "goal"
  | "category"
  | "subscription"
  | "debt"
  | "asset"
  | "event"
  | "ygoal"
  | "learning"
  | "idea"
  | "journal";

/** `form` is the form kind opened in money-forms / time-forms / finance-forms. */
export type Hit = { kind: HitKind; id: string; label: string; detail: string; form: string };

export type SearchData = {
  viewerId: string;
  transactions: Transaction[];
  recurring: Recurring[];
  incomes: Income[];
  goals: Goal[];
  categories: Category[];
  subscriptions: Subscription[];
  debts: Debt[];
  assets: Asset[];
  events: CalEvent[];
  yearlyGoals: YearlyGoal[];
  learningItems: LearningItem[];
  dateIdeas: DateIdea[];
  journal: JournalEntry[];
};

const fold = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ß/g, "ss");

/** Every word of the query must appear; a match at the start of the name ranks first. */
export function searchData(query: string, d: SearchData, limit = 12): Hit[] {
  const words = fold(query).split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const scored: { hit: Hit; score: number }[] = [];
  const add = (hit: Hit, ...text: (string | null | undefined)[]) => {
    const hay = fold(text.filter(Boolean).join(" "));
    if (!words.every((w) => hay.includes(w))) return;
    const name = fold(hit.label);
    const score = name.startsWith(words[0]) ? 0 : name.includes(words[0]) ? 1 : 2;
    scored.push({ hit, score });
  };

  for (const r of d.recurring) add({ kind: "recurring", id: r.id, label: r.name, detail: `Every month · ${eur(r.amount)} on day ${r.day_of_month}`, form: "recur" }, r.name);
  for (const i of d.incomes) add({ kind: "income", id: i.id, label: i.name, detail: `Income · ${eur(i.monthly_amount)} a month`, form: "income" }, i.name, i.kind);
  for (const g of d.goals) add({ kind: "goal", id: g.id, label: g.name, detail: `Goal · ${eur(g.current)} of ${eur(g.target)}`, form: "goal" }, g.name);
  for (const c of d.categories) add({ kind: "category", id: c.id, label: c.name, detail: `Budget category · ${eur(c.monthly_limit)} a month`, form: "cat" }, c.name);
  for (const s of d.subscriptions) add({ kind: "subscription", id: s.id, label: s.name, detail: `Subscription · ${eur(s.monthly_price)} a month${s.status === "cancelled" ? " · stopped" : ""}`, form: "sub" }, s.name);
  for (const x of d.debts) add({ kind: "debt", id: x.id, label: x.name, detail: `Debt · ${eur(x.balance)} left`, form: "debt" }, x.name, x.lender);
  for (const a of d.assets) add({ kind: "asset", id: a.id, label: a.name, detail: `Asset${a.location ? ` · ${a.location}` : ""}`, form: "asset" }, a.name, a.location, a.note);
  for (const g of d.yearlyGoals) add({ kind: "ygoal", id: g.id, label: g.name, detail: `Yearly goal · ${g.done} of ${g.target} ${g.unit}`.trim(), form: "ygoal" }, g.name, g.step);
  for (const l of d.learningItems) add({ kind: "learning", id: l.id, label: l.title, detail: `${l.track} · ${l.pct}%`, form: "litem" }, l.title, l.track, l.next);
  for (const i of d.dateIdeas) add({ kind: "idea", id: i.id, label: i.name, detail: `Date idea${i.short ? ` · ${i.short}` : ""}`, form: "idea" }, i.name, i.short);
  for (const e of d.events)
    add(
      { kind: "event", id: e.id, label: e.title, detail: `${e.kind === "shift" ? "Shift" : "Calendar"} · ${shortDate(e.date)}${e.start_time ? ` ${e.start_time.slice(0, 5)}` : ""}`, form: e.kind },
      e.title,
      e.note,
    );
  // Only your own journal notes can be opened from search.
  for (const j of d.journal)
    if (j.owner_id === d.viewerId) add({ kind: "journal", id: j.id, label: j.text.slice(0, 60), detail: `Journal · ${shortDate(j.date)}`, form: "journal" }, j.text);

  // Transactions last, newest first, at most 5, so one shop does not fill the list.
  let txCount = 0;
  for (const t of d.transactions) {
    if (txCount >= 5) break;
    const before = scored.length;
    add({ kind: "transaction", id: t.id, label: t.payee, detail: `${shortDate(t.date)} · ${eur(t.amount)}`, form: "tx" }, t.payee, t.note);
    if (scored.length > before) txCount++;
  }

  return scored
    .map((s, i) => ({ ...s, i }))
    .sort((a, b) => a.score - b.score || a.i - b.i)
    .slice(0, limit)
    .map((s) => s.hit);
}
