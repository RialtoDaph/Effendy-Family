// The Life Map's graph: Life Score in the middle, four areas around it, the
// household's items around each area. Pure data, the 3D scene draws it.

import { scoreState, type LifeScore, type PillarKey, type ScoreState } from "./life-score";
import type { Category, Goal, Recurring, Today, Visibility } from "./money";
import { spentByCategory } from "./money";
import { addDays, type CalEvent, type GymSession, type LearningItem } from "./time";
import type { Debt } from "./finance";

export type NodeKind = "core" | "hub" | "sub" | "debt" | "cat" | "goal" | "event" | "learn" | "gym";
export type NodeState = ScoreState | "acc";
export type MapNode = {
  id: string;
  kind: NodeKind;
  hub?: PillarKey;
  label: string;
  val?: number | null;
  st: NodeState;
  r: number;
  pos: [number, number, number];
  ph: number;
  fields: [string, string][];
  /** The form that edits this item. */
  act?: [string, string];
};
export type MapGraph = { nodes: MapNode[]; edges: [string, string][] };

export const HUBS: PillarKey[] = ["money", "time", "health", "goals"];
const HUB_PLACE: Record<PillarKey, [number, number]> = { money: [0, 16], time: [90, -16], health: [180, 16], goals: [270, -16] };

type Owned = { visibility: Visibility; owner_id: string };

export function buildMap(input: {
  score: LifeScore;
  viewerId: string;
  today: Today;
  subscriptions: Recurring[];
  debts: Debt[];
  categories: Category[];
  transactions: Parameters<typeof spentByCategory>[0];
  goals: Goal[];
  events: CalEvent[];
  learning: LearningItem[];
  gym: GymSession[];
  /** Labels and formatters in the app's language. */
  text: {
    hub: (k: PillarKey) => string;
    coreLabel: string;
    score: string;
    perMonth: string;
    balance: string;
    rate: string;
    spent: string;
    saved: string;
    progress: string;
    when: string;
    eur: (n: number) => string;
    day: (iso: string) => string;
  };
}): MapGraph {
  const { score, viewerId, today, text: x } = input;
  // RLS already keeps a partner's private rows away; the map checks once more.
  const seen = <T extends Owned>(rows: T[]) => rows.filter((r) => r.visibility === "family" || r.owner_id === viewerId);

  const nodes: MapNode[] = [
    {
      id: "core",
      kind: "core",
      label: x.coreLabel,
      val: score.total,
      r: 7.5,
      st: "acc",
      pos: [0, 0, 0],
      ph: 0,
      fields: [[x.score, score.total === null ? "—" : `${score.total} / 100`]],
    },
  ];

  for (const p of score.pillars) {
    const [angle, y] = HUB_PLACE[p.k];
    const rad = (angle * Math.PI) / 180;
    const s = p.score ?? 50;
    const dist = 64 + (100 - s) * 0.45;
    nodes.push({
      id: `h-${p.k}`,
      kind: "hub",
      hub: p.k,
      label: x.hub(p.k),
      val: p.score,
      r: 3.6 + s / 22,
      st: scoreState(p.score),
      pos: [Math.cos(rad) * dist, y, Math.sin(rad) * dist],
      ph: 0,
      fields: [[x.score, p.score === null ? "—" : `${p.score} / 100`]],
    });
  }

  const leaf = (hub: PillarKey, n: Pick<MapNode, "id" | "kind" | "label" | "st" | "fields" | "act"> & { r?: number }) =>
    nodes.push({ ...n, hub, r: n.r ?? 2.2, pos: [0, 0, 0], ph: 0 });

  seen(input.subscriptions)
    .slice(0, 7)
    .forEach((s) => leaf("money", { id: `s-${s.id}`, kind: "sub", label: s.name, st: s.active ? "ok" : "neu", fields: [[x.perMonth, x.eur(-s.amount)]], act: ["sub", s.id] }));

  seen(input.debts)
    .slice(0, 4)
    .forEach((d) =>
      leaf("money", {
        id: `d-${d.id}`,
        kind: "debt",
        label: d.name,
        st: "warn",
        fields: [
          [x.balance, x.eur(d.balance)],
          [x.rate, `${d.rate_pct}%`],
        ],
        act: ["debt", d.id],
        r: 2.2 + Math.min(2, d.balance / 3000),
      }),
    );

  const spent = spentByCategory(input.transactions, today.ym);
  input.categories
    .filter((c) => !c.is_fixed && c.monthly_limit > 0 && (spent.get(c.id) ?? 0) / c.monthly_limit > 0.7)
    .slice(0, 4)
    .forEach((c) => {
      const s = spent.get(c.id) ?? 0;
      leaf("money", { id: `c-${c.id}`, kind: "cat", label: c.name, st: s > c.monthly_limit ? "bad" : "warn", fields: [[x.spent, `${x.eur(s)} / ${x.eur(c.monthly_limit)}`]], act: ["cat", c.id], r: 2.6 });
    });

  seen(input.goals)
    .slice(0, 7)
    .forEach((g) => {
      const pct = g.target ? g.current / g.target : 0;
      leaf("goals", {
        id: `g-${g.id}`,
        kind: "goal",
        label: g.name,
        st: pct >= 1 || g.monthly > 0 ? "ok" : "warn",
        fields: [
          [x.saved, `${x.eur(g.current)} / ${x.eur(g.target)}`],
          [x.progress, `${Math.round(pct * 100)}%`],
        ],
        act: ["goal", g.id],
        r: 2.2 + Math.min(2.6, g.target / 6000),
      });
    });

  const weekEnd = addDays(today.iso, 6);
  seen(input.events)
    .filter((e) => e.date >= today.iso && e.date <= weekEnd)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 6)
    .forEach((e) =>
      leaf("time", { id: `e-${e.id}`, kind: "event", label: e.title, st: "neu", fields: [[x.when, `${x.day(e.date)}${e.start_time ? ` ${e.start_time.slice(0, 5)}` : ""}`]], act: [e.kind, e.id], r: 1.9 }),
    );

  seen(input.learning)
    .slice(0, 4)
    .forEach((l) => leaf("time", { id: `l-${l.id}`, kind: "learn", label: l.title, st: l.pct >= 50 ? "ok" : "warn", fields: [[x.progress, `${l.pct}%`]], act: ["litem", l.id], r: 2.1 }));

  seen(input.gym)
    .slice(0, 5)
    .forEach((g) => leaf("health", { id: `gy-${g.id}`, kind: "gym", label: g.type, st: "ok", fields: [[x.when, x.day(g.date)]], act: ["gym", g.id], r: 1.9 }));

  // Each area's items sit on a golden-angle shell around it.
  for (const k of HUBS) {
    const hub = nodes.find((n) => n.id === `h-${k}`)!;
    const list = nodes.filter((n) => n.hub === k && n.kind !== "hub");
    list.forEach((n, i) => {
      const ga = i * 2.39996;
      const rr = 22 + (i % 3) * 7 + n.r * 2.5 + list.length * 1.2;
      const el = Math.acos(1 - (2 * (i + 0.5)) / list.length);
      n.pos = [hub.pos[0] + Math.cos(ga) * Math.sin(el) * rr, hub.pos[1] + Math.cos(el) * rr * 0.8, hub.pos[2] + Math.sin(ga) * Math.sin(el) * rr];
      n.ph = i * 0.9;
    });
  }

  const edges: [string, string][] = [];
  for (const n of nodes) {
    if (n.kind === "hub") edges.push(["core", n.id]);
    else if (n.kind !== "core") edges.push([`h-${n.hub}`, n.id]);
  }
  HUBS.forEach((k, i) => edges.push([`h-${k}`, `h-${HUBS[(i + 1) % HUBS.length]}`]));
  return { nodes, edges };
}
