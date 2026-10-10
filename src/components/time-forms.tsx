"use client";

import { useAppData } from "@/components/app-data";
import { useMoney } from "@/components/money-data";
import { FormSheet, type Field, type FormValues } from "@/components/sheet";
import { useTime, type TimeTable } from "@/components/time-data";
import { useToast } from "@/components/toast";
import { iconFor } from "@/lib/icons";
import { QUEUED, QUEUED_MSG } from "@/lib/offline-queue";
import { parseAmount } from "@/lib/money";
import { hm, weekStart } from "@/lib/time";

export type TimeFormKind = "event" | "shift" | "prio" | "ygoal" | "progress" | "litem" | "lmin" | "gym" | "journal" | "idea" | "datenight";

export const TIME_FORM_KINDS: TimeFormKind[] = ["event", "shift", "prio", "ygoal", "progress", "litem", "lmin", "gym", "journal", "idea", "datenight"];

const VISIBILITY: Field = {
  kind: "chips",
  key: "visibility",
  label: "Visible to",
  options: [
    { value: "family", label: "Family" },
    { value: "private", label: "Only me" },
  ],
};

export const GYM_TYPES: { value: string; icon: string }[] = [
  { value: "Strength", icon: "dumbbell" },
  { value: "Cardio", icon: "activity" },
  { value: "Yoga", icon: "flower-2" },
  { value: "Pilates", icon: "flower-2" },
  { value: "Swim", icon: "waves" },
  { value: "Bike", icon: "bike" },
  { value: "Walk", icon: "footprints" },
];

const GOAL_ICONS = ["target", "graduation-cap", "briefcase", "dumbbell", "heart", "book-open", "palette", "piggy-bank", "plane", "users"];
const IDEA_ICONS = ["heart", "utensils", "coffee", "film", "mountain", "music", "waves", "gift"];

const num = (v: unknown) => (String(v ?? "").trim() ? parseAmount(v) : NaN);
const text = (v: unknown) => String(v ?? "").trim();

export function TimeForm({ kind, id, preset, onClose }: { kind: TimeFormKind; id?: string; preset?: FormValues; onClose: () => void }) {
  const { members, userId, settings } = useAppData();
  const { today } = useMoney();
  const time = useTime();
  const toast = useToast();

  const who: Field = {
    kind: "chips",
    key: "who",
    label: "For",
    options: [...members.map((m) => ({ value: m.id, label: m.display_name })), { value: "together", label: "Together" }],
  };
  const whoId = (v: unknown) => (v && v !== "together" ? String(v) : null);
  const whoValue = (v: string | null) => v ?? "together";
  const vis = (module: string, fallback = "family") => settings?.default_visibility?.[module] ?? fallback;

  async function finish(table: TimeTable, values: Record<string, unknown>, rowId: string | undefined, msg: string) {
    const err = await time.save(table, values, rowId);
    if (err && err !== QUEUED) return err;
    toast(err === QUEUED ? QUEUED_MSG : msg);
    onClose();
  }

  async function del(table: TimeTable, rowId: string, question: string) {
    if (!confirm(question)) return;
    const err = await time.remove(table, rowId);
    if (err && err !== QUEUED) toast(err);
    else {
      toast(err === QUEUED ? QUEUED_MSG : "Deleted");
      onClose();
    }
  }

  switch (kind) {
    case "event":
    case "shift": {
      const e = time.events.find((x) => x.id === id);
      const shift = (e?.kind ?? kind) === "shift";
      const initial: FormValues = e
        ? {
            title: e.title,
            date: e.date,
            start: hm(e.start_time),
            end: hm(e.end_time),
            who: whoValue(e.who),
            remind: String(e.remind_min ?? ""),
            visibility: e.visibility,
            note: e.note ?? "",
          }
        : {
            title: shift ? "Bar shift" : "",
            date: today.iso,
            start: shift ? "18:00" : "",
            end: shift ? "01:00" : "",
            who: shift ? userId : "together",
            remind: "",
            visibility: vis("events"),
            ...preset,
          };
      const fields: Field[] = shift
        ? [
            { kind: "date", key: "date", label: "Date", required: true },
            { kind: "time", key: "start", label: "Starts", required: true },
            { kind: "time", key: "end", label: "Ends (after midnight is fine)", required: true },
            { kind: "text", key: "title", label: "Name", required: true },
            { kind: "text", key: "note", label: "Note (optional)" },
            { kind: "note", key: "n", label: "Reminder", text: "You get a reminder 2 hours before (Settings → Reminders → Bar shifts)." },
          ]
        : [
            { kind: "text", key: "title", label: "What", placeholder: "e.g. Tax papers", required: true },
            { kind: "date", key: "date", label: "Date", required: true },
            { kind: "time", key: "start", label: "Starts (optional)" },
            { kind: "time", key: "end", label: "Ends (optional)" },
            who,
            {
              kind: "chips",
              key: "remind",
              label: "Remind me",
              options: [
                { value: "", label: "No" },
                { value: "15", label: "15 min before" },
                { value: "60", label: "1 hour before" },
                { value: "1440", label: "1 day before" },
              ],
            },
            VISIBILITY,
            { kind: "text", key: "note", label: "Note (optional)" },
          ];
      return (
        <FormSheet
          title={e ? (shift ? "Edit shift" : "Edit event") : shift ? "Add bar shift" : "Add to the week"}
          editing={!!e}
          initial={initial}
          fields={fields}
          onClose={onClose}
          onDelete={e ? () => del("events", e.id, `Delete “${e.title}” on ${e.date}?`) : undefined}
          onSave={(v) => {
            if (!shift && v.remind && !v.start) return "A reminder needs a start time.";
            return finish(
              "events",
              {
                kind: shift ? "shift" : "event",
                title: text(v.title),
                date: v.date,
                start_time: text(v.start) || null,
                end_time: text(v.end) || null,
                who: shift ? userId : whoId(v.who),
                remind_min: shift ? null : v.remind ? Number(v.remind) : null,
                visibility: shift ? "family" : v.visibility,
                note: text(v.note) || null,
              },
              e?.id,
              e ? "Saved" : shift ? "Shift added" : "Added to the week",
            );
          }}
        />
      );
    }

    case "prio": {
      const p = time.priorities.find((x) => x.id === id);
      return (
        <FormSheet
          title={p ? "Edit priority" : "Add a priority"}
          editing={!!p}
          initial={p ? { title: p.title, who: whoValue(p.who) } : { who: "together", ...preset }}
          fields={[{ kind: "text", key: "title", label: "What matters this week", placeholder: "e.g. Send VAT pre-return", required: true }, who]}
          onClose={onClose}
          onDelete={p ? () => del("week_priorities", p.id, `Delete “${p.title}”?`) : undefined}
          onSave={(v) =>
            finish(
              "week_priorities",
              p
                ? { title: text(v.title), who: whoId(v.who) }
                : {
                    title: text(v.title),
                    who: whoId(v.who),
                    week_start: String(preset?.week_start ?? weekStart(today.iso)),
                    sort: Number(preset?.sort ?? 0),
                  },
              p?.id,
              p ? "Saved" : "Priority added",
            )
          }
        />
      );
    }

    case "ygoal": {
      const g = time.yearlyGoals.find((x) => x.id === id);
      return (
        <FormSheet
          title={g ? "Edit yearly goal" : "Add a yearly goal"}
          editing={!!g}
          initial={
            g
              ? { name: g.name, icon: g.icon, target: String(g.target), unit: g.unit, done: String(g.done), step: g.step ?? "", who: whoValue(g.who), visibility: g.visibility }
              : { icon: "target", who: userId, done: "0", visibility: vis("ygoals"), ...preset }
          }
          fields={[
            { kind: "text", key: "name", label: "Goal", placeholder: "e.g. 30 ECTS this year", required: true },
            { kind: "chips", key: "icon", label: "Icon", options: GOAL_ICONS.map((i) => ({ value: i, label: "", icon: iconFor(i) })) },
            { kind: "number", key: "target", label: "Target number", placeholder: "e.g. 30", required: true },
            { kind: "text", key: "unit", label: "Unit", placeholder: "e.g. ECTS, orders, sessions" },
            { kind: "number", key: "done", label: "Done so far" },
            { kind: "text", key: "step", label: "This week's step (optional)", placeholder: "e.g. 6 study hours" },
            who,
            VISIBILITY,
          ]}
          onClose={onClose}
          onDelete={g ? () => del("yearly_goals", g.id, `Delete “${g.name}” and its progress?`) : undefined}
          onSave={(v) => {
            const target = num(v.target);
            const done = num(v.done || "0");
            if (!(target > 0)) return "The target must be a number above 0.";
            if (!(done >= 0)) return "Done so far must be 0 or more.";
            return finish(
              "yearly_goals",
              {
                name: text(v.name),
                icon: v.icon || "target",
                target,
                unit: text(v.unit),
                done,
                step: text(v.step) || null,
                who: whoId(v.who),
                visibility: v.visibility,
                ...(g ? {} : { year: today.y }),
              },
              g?.id,
              g ? "Saved" : "Goal added",
            );
          }}
        />
      );
    }

    case "progress": {
      const g = time.yearlyGoals.find((x) => x.id === preset?.goal_id);
      if (!g) return null;
      return (
        <FormSheet
          title={`Progress · ${g.name}`}
          initial={{ amount: "1", date: today.iso }}
          fields={[
            { kind: "number", key: "amount", label: `How much${g.unit ? ` (${g.unit})` : ""}`, required: true },
            { kind: "date", key: "date", label: "Date", required: true },
            { kind: "note", key: "n", label: "", text: "Use a minus to correct a mistake, e.g. -1." },
          ]}
          onClose={onClose}
          onSave={(v) => {
            const amount = num(v.amount);
            if (!Number.isFinite(amount) || amount === 0) return "Enter a number (not 0).";
            return finish("goal_progress", { goal_id: g.id, amount, date: v.date }, undefined, "Progress saved");
          }}
        />
      );
    }

    case "litem": {
      const it = time.learningItems.find((x) => x.id === id);
      const tracks = [...new Set(time.learningItems.map((x) => x.track))];
      return (
        <FormSheet
          title={it ? "Edit book or course" : "Add a book or course"}
          editing={!!it}
          initial={
            it
              ? { title: it.title, track: it.track, type: it.type, who: whoValue(it.who), pct: String(it.pct), next: it.next ?? "", visibility: it.visibility }
              : { type: "course", who: userId, pct: "0", track: tracks[0] ?? "", visibility: vis("learning"), ...preset }
          }
          fields={[
            { kind: "text", key: "title", label: "Title", placeholder: "e.g. The Psychology of Money", required: true },
            { kind: "chips", key: "type", label: "Type", options: [{ value: "book", label: "Book" }, { value: "course", label: "Course" }, { value: "other", label: "Other" }] },
            { kind: "text", key: "track", label: "Topic", placeholder: "e.g. Finance & investing", required: true },
            who,
            { kind: "number", key: "pct", label: "Progress (%)" },
            { kind: "text", key: "next", label: "Next (optional)", placeholder: "e.g. chapter 8" },
            VISIBILITY,
          ]}
          onClose={onClose}
          onDelete={it ? () => del("learning_items", it.id, `Delete “${it.title}”?`) : undefined}
          onSave={(v) => {
            const pct = Math.round(num(v.pct || "0"));
            if (!(pct >= 0 && pct <= 100)) return "Progress must be between 0 and 100.";
            return finish(
              "learning_items",
              { title: text(v.title), type: v.type, track: text(v.track), who: whoId(v.who), pct, next: text(v.next) || null, visibility: v.visibility },
              it?.id,
              it ? "Saved" : "Added",
            );
          }}
        />
      );
    }

    case "lmin":
      return (
        <FormSheet
          title="Log learning time"
          initial={{ minutes: "30", date: today.iso, item: "", visibility: vis("learning"), ...preset }}
          fields={[
            {
              kind: "chips",
              key: "minutes",
              label: "Minutes",
              options: ["15", "30", "45", "60", "90", "120"].map((m) => ({ value: m, label: `${m} min` })),
            },
            { kind: "date", key: "date", label: "Date", required: true },
            {
              kind: "chips",
              key: "item",
              label: "On (optional)",
              options: [{ value: "", label: "—" }, ...time.learningItems.filter((i) => i.pct < 100).map((i) => ({ value: i.id, label: i.title }))],
            },
          ]}
          onClose={onClose}
          onSave={(v) =>
            finish(
              "learning_minutes",
              { minutes: Number(v.minutes), date: v.date, item_id: v.item || null, visibility: v.visibility },
              undefined,
              `${v.minutes} minutes logged`,
            )
          }
        />
      );

    case "gym": {
      const s = time.gym.find((x) => x.id === id);
      return (
        <FormSheet
          title={s ? "Edit gym session" : "Log a gym session"}
          editing={!!s}
          initial={s ? { type: s.type, date: s.date, time: hm(s.time) } : { type: "Strength", date: today.iso, time: "", ...preset }}
          fields={[
            { kind: "chips", key: "type", label: "Type", options: GYM_TYPES.map((t) => ({ value: t.value, label: t.value, icon: iconFor(t.icon) })) },
            { kind: "date", key: "date", label: "Date", required: true },
            { kind: "time", key: "time", label: "Time (optional)" },
          ]}
          onClose={onClose}
          onDelete={s ? () => del("gym_sessions", s.id, "Delete this session?") : undefined}
          onSave={(v) =>
            finish(
              "gym_sessions",
              {
                type: v.type,
                icon: GYM_TYPES.find((t) => t.value === v.type)?.icon ?? "dumbbell",
                date: v.date,
                time: text(v.time) || null,
                ...(s ? {} : { visibility: vis("gym") }),
              },
              s?.id,
              s ? "Saved" : "Session logged",
            )
          }
        />
      );
    }

    case "journal": {
      const j = time.journal.find((x) => x.id === id);
      return (
        <FormSheet
          title={j ? "Edit journal note" : "Journal note"}
          editing={!!j}
          initial={j ? { text: j.text, date: j.date, visibility: j.visibility } : { date: today.iso, visibility: vis("journal", "private"), ...preset }}
          fields={[
            { kind: "textarea", key: "text", label: "Today", placeholder: "How was today?", required: true, rows: 7 },
            { kind: "date", key: "date", label: "Date", required: true },
            VISIBILITY,
          ]}
          onClose={onClose}
          onDelete={j ? () => del("journal_entries", j.id, "Delete this note?") : undefined}
          onSave={(v) => finish("journal_entries", { text: text(v.text), date: v.date, visibility: v.visibility }, j?.id, j ? "Saved" : "Saved to your journal")}
        />
      );
    }

    case "idea": {
      const d = time.dateIdeas.find((x) => x.id === id);
      return (
        <FormSheet
          title={d ? "Edit idea" : "Add a date idea"}
          editing={!!d}
          initial={d ? { name: d.name, short: d.short ?? "", cost: d.cost == null ? "" : String(d.cost), icon: d.icon } : { icon: "heart", ...preset }}
          fields={[
            { kind: "text", key: "name", label: "Idea", placeholder: "e.g. Altmühltal sunset walk", required: true },
            { kind: "text", key: "short", label: "Short note (optional)", placeholder: "e.g. Picnic on the Jura cliffs" },
            { kind: "amount", key: "cost", label: "About how much (optional)", placeholder: "0" },
            { kind: "chips", key: "icon", label: "Icon", options: IDEA_ICONS.map((i) => ({ value: i, label: "", icon: iconFor(i) })) },
          ]}
          onClose={onClose}
          onDelete={d ? () => del("date_ideas", d.id, `Delete “${d.name}”?`) : undefined}
          onSave={(v) => {
            const cost = text(v.cost) ? num(v.cost) : null;
            if (cost != null && !(cost >= 0)) return "The cost must be a number.";
            return finish("date_ideas", { name: text(v.name), short: text(v.short) || null, cost, icon: v.icon || "heart" }, d?.id, d ? "Saved" : "Idea added");
          }}
        />
      );
    }

    case "datenight": {
      const d = time.dateNights.find((x) => x.id === id);
      const past = d ? d.date <= today.iso : false;
      return (
        <FormSheet
          title={d ? (past ? "How was it?" : "Edit date night") : "Plan a date night"}
          editing={!!d}
          initial={
            d
              ? { name: d.name, date: d.date, cost: d.cost == null ? "" : String(d.cost), rating: d.rating ? String(d.rating) : "", note: d.note ?? "", icon: d.icon }
              : { date: today.iso, start: "19:00", icon: "heart", rating: "", ...preset }
          }
          fields={[
            { kind: "text", key: "name", label: "What", placeholder: "e.g. Trattoria + castle walk", required: true },
            { kind: "date", key: "date", label: "Date", required: true },
            ...(d ? [] : [{ kind: "time", key: "start", label: "Time (adds it to the week)" } as Field]),
            { kind: "amount", key: "cost", label: "Cost (optional)", placeholder: "0" },
            ...(d && past
              ? [
                  {
                    kind: "chips",
                    key: "rating",
                    label: "Rating",
                    options: [{ value: "", label: "—" }, ...[1, 2, 3, 4, 5].map((n) => ({ value: String(n), label: "★".repeat(n) }))],
                  } as Field,
                ]
              : []),
            { kind: "text", key: "note", label: "Note (optional)" },
          ]}
          onClose={onClose}
          onDelete={d ? () => del("date_nights", d.id, `Delete “${d.name}”?`) : undefined}
          onSave={async (v) => {
            const cost = text(v.cost) ? num(v.cost) : null;
            if (cost != null && !(cost >= 0)) return "The cost must be a number.";
            const values: Record<string, unknown> = {
              name: text(v.name),
              date: v.date,
              cost,
              rating: v.rating ? Number(v.rating) : null,
              note: text(v.note) || null,
              icon: v.icon || "heart",
            };
            if (!d) {
              // Also put it on the week board for both of you, with a reminder an hour before.
              const eventId = crypto.randomUUID();
              const ev = await time.save("events", {
                id: eventId,
                title: `Date night: ${text(v.name)}`,
                date: v.date,
                start_time: text(v.start) || null,
                who: null,
                remind_min: text(v.start) ? 60 : null,
              });
              if (!ev || ev === QUEUED) values.event_id = eventId;
              if (preset?.idea_id) values.idea_id = preset.idea_id;
            }
            return finish("date_nights", values, d?.id, d ? "Saved" : "Date night planned");
          }}
        />
      );
    }
  }
}
