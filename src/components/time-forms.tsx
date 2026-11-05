"use client";

import { useTranslations } from "next-intl";
import { useAppData } from "@/components/app-data";
import { useMoney } from "@/components/money-data";
import { FormSheet, useVisibilityField, type Field, type FormValues } from "@/components/sheet";
import { useTime, type TimeTable } from "@/components/time-data";
import { useToast } from "@/components/toast";
import { iconFor } from "@/lib/icons";
import { QUEUED } from "@/lib/offline-queue";
import { parseAmount } from "@/lib/money";
import { supabase } from "@/lib/supabase";
import { hm, weekStart } from "@/lib/time";
import { useDates } from "@/lib/use-dates";

export type TimeFormKind =
  | "event"
  | "shift"
  | "prio"
  | "ygoal"
  | "progress"
  | "litem"
  | "lmin"
  | "gym"
  | "journal"
  | "idea"
  | "datenight"
  | "career"
  | "wage";

export const TIME_FORM_KINDS: TimeFormKind[] = ["event", "shift", "prio", "ygoal", "progress", "litem", "lmin", "gym", "journal", "idea", "datenight", "career", "wage"];

export type GymType = "Strength" | "Cardio" | "Class" | "Yoga" | "Pilates" | "Swim" | "Bike" | "Walk";

export const GYM_TYPES: { value: GymType; icon: string }[] = [
  { value: "Strength", icon: "dumbbell" },
  { value: "Cardio", icon: "activity" },
  { value: "Class", icon: "flower-2" },
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
  const tt = useTranslations("time");
  const tm = useTranslations("money");
  const dates = useDates();
  const VISIBILITY = useVisibilityField();
  const { members, userId, settings, reload } = useAppData();
  const { today } = useMoney();
  const time = useTime();
  const toast = useToast();

  const who: Field = {
    kind: "chips",
    key: "who",
    label: tt("for"),
    options: [...members.map((m) => ({ value: m.id, label: m.display_name })), { value: "together", label: tt("together") }],
  };
  const whoId = (v: unknown) => (v && v !== "together" ? String(v) : null);
  const whoValue = (v: string | null) => v ?? "together";
  const vis = (module: string, fallback = "family") => settings?.default_visibility?.[module] ?? fallback;

  async function finish(table: TimeTable, values: Record<string, unknown>, rowId: string | undefined, msg: string) {
    const err = await time.save(table, values, rowId);
    if (err && err !== QUEUED) return err;
    toast(err === QUEUED ? tm("queued") : msg);
    onClose();
  }

  async function del(table: TimeTable, rowId: string, question: string) {
    if (!confirm(question)) return;
    const err = await time.remove(table, rowId);
    if (err && err !== QUEUED) toast(err);
    else {
      toast(err === QUEUED ? tm("queued") : tm("deleted"));
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
            title: shift ? tt("bar_shift") : "",
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
            { kind: "date", key: "date", label: tm("date"), required: true },
            { kind: "time", key: "start", label: tt("starts"), required: true },
            { kind: "time", key: "end", label: tt("ends_midnight"), required: true },
            { kind: "text", key: "title", label: tm("name"), required: true },
            { kind: "text", key: "note", label: tm("note_optional") },
            { kind: "note", key: "n", label: tt("reminder_label"), text: tt("shift_reminder_note") },
          ]
        : [
            { kind: "text", key: "title", label: tt("what"), placeholder: tt("ph_event"), required: true },
            { kind: "date", key: "date", label: tm("date"), required: true },
            { kind: "time", key: "start", label: tt("starts_optional") },
            { kind: "time", key: "end", label: tt("ends_optional") },
            who,
            {
              kind: "chips",
              key: "remind",
              label: tt("remind_me"),
              options: [
                { value: "", label: tt("no") },
                { value: "15", label: tt("before_15") },
                { value: "60", label: tt("before_60") },
                { value: "1440", label: tt("before_1440") },
              ],
            },
            VISIBILITY,
            { kind: "text", key: "note", label: tm("note_optional") },
          ];
      return (
        <FormSheet
          title={e ? (shift ? tt("edit_shift") : tt("edit_event")) : shift ? tt("add_shift") : tt("add_to_week")}
          editing={!!e}
          initial={initial}
          fields={fields}
          onClose={onClose}
          onDelete={e ? () => del("events", e.id, tm("delete", { name: `${e.title}, ${dates.day(e.date)}` })) : undefined}
          onSave={(v) => {
            if (!shift && v.remind && !v.start) return tt("reminder_needs_start");
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
              e ? tm("saved") : shift ? tt("shift_added") : tt("added_to_week"),
            );
          }}
        />
      );
    }

    case "prio": {
      const p = time.priorities.find((x) => x.id === id);
      return (
        <FormSheet
          title={p ? tt("edit_priority") : tt("add_priority")}
          editing={!!p}
          initial={p ? { title: p.title, who: whoValue(p.who) } : { who: "together", ...preset }}
          fields={[{ kind: "text", key: "title", label: tt("what_matters"), placeholder: tt("ph_priority"), required: true }, who]}
          onClose={onClose}
          onDelete={p ? () => del("week_priorities", p.id, tm("delete", { name: p.title })) : undefined}
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
              p ? tm("saved") : tt("priority_added"),
            )
          }
        />
      );
    }

    case "ygoal": {
      const g = time.yearlyGoals.find((x) => x.id === id);
      return (
        <FormSheet
          title={g ? tt("edit_ygoal") : tt("add_ygoal")}
          editing={!!g}
          initial={
            g
              ? { name: g.name, icon: g.icon, target: String(g.target), unit: g.unit, done: String(g.done), step: g.step ?? "", who: whoValue(g.who), visibility: g.visibility }
              : { icon: "target", who: userId, done: "0", visibility: vis("ygoals"), ...preset }
          }
          fields={[
            { kind: "text", key: "name", label: tt("goal"), placeholder: tt("ph_goal"), required: true },
            { kind: "chips", key: "icon", label: tm("icon"), options: GOAL_ICONS.map((i) => ({ value: i, label: "", icon: iconFor(i) })) },
            { kind: "number", key: "target", label: tt("target_number"), placeholder: "30", required: true },
            { kind: "text", key: "unit", label: tt("unit"), placeholder: tt("ph_unit") },
            { kind: "number", key: "done", label: tt("done_so_far") },
            { kind: "text", key: "step", label: tt("week_step"), placeholder: tt("ph_step") },
            who,
            VISIBILITY,
          ]}
          onClose={onClose}
          onDelete={g ? () => del("yearly_goals", g.id, tt("delete_goal", { name: g.name })) : undefined}
          onSave={(v) => {
            const target = num(v.target);
            const done = num(v.done || "0");
            if (!(target > 0)) return tt("target_above_0");
            if (!(done >= 0)) return tt("done_0_or_more");
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
              g ? tm("saved") : tm("goal_added"),
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
          title={tt("progress_title", { name: g.name })}
          initial={{ amount: "1", date: today.iso }}
          fields={[
            { kind: "number", key: "amount", label: g.unit ? tt("how_much_unit", { unit: g.unit }) : tt("how_much"), required: true },
            { kind: "date", key: "date", label: tm("date"), required: true },
            { kind: "note", key: "n", label: "", text: tt("minus_note") },
          ]}
          onClose={onClose}
          onSave={(v) => {
            const amount = num(v.amount);
            if (!Number.isFinite(amount) || amount === 0) return tt("enter_not_0");
            return finish("goal_progress", { goal_id: g.id, amount, date: v.date }, undefined, tt("progress_saved"));
          }}
        />
      );
    }

    case "litem": {
      const it = time.learningItems.find((x) => x.id === id);
      const tracks = [...new Set(time.learningItems.map((x) => x.track))];
      return (
        <FormSheet
          title={it ? tt("edit_item") : tt("add_to_learn_title")}
          editing={!!it}
          initial={
            it
              ? { title: it.title, track: it.track, type: it.type, who: whoValue(it.who), pct: String(it.pct), next: it.next ?? "", visibility: it.visibility }
              : { type: "course", who: userId, pct: "0", track: tracks[0] ?? "", visibility: vis("learning"), ...preset }
          }
          fields={[
            { kind: "text", key: "title", label: tt("title"), placeholder: tt("ph_item"), required: true },
            { kind: "chips", key: "type", label: tm("type"), options: [{ value: "book", label: tt("type_book") }, { value: "course", label: tt("type_course") }, { value: "other", label: tt("type_other") }] },
            { kind: "text", key: "track", label: tt("topic"), placeholder: tt("ph_topic"), required: true },
            who,
            { kind: "number", key: "pct", label: tt("progress_pct") },
            { kind: "text", key: "next", label: tt("next_optional"), placeholder: tt("ph_next") },
            VISIBILITY,
          ]}
          onClose={onClose}
          onDelete={it ? () => del("learning_items", it.id, tm("delete", { name: it.title })) : undefined}
          onSave={(v) => {
            const pct = Math.round(num(v.pct || "0"));
            if (!(pct >= 0 && pct <= 100)) return tt("progress_range");
            return finish(
              "learning_items",
              { title: text(v.title), type: v.type, track: text(v.track), who: whoId(v.who), pct, next: text(v.next) || null, visibility: v.visibility },
              it?.id,
              it ? tm("saved") : tm("added"),
            );
          }}
        />
      );
    }

    case "lmin":
      return (
        <FormSheet
          title={tt("log_learning")}
          initial={{ minutes: "30", date: today.iso, item: "", visibility: vis("learning"), ...preset }}
          fields={[
            {
              kind: "chips",
              key: "minutes",
              label: tt("minutes"),
              options: ["15", "30", "45", "60", "90", "120"].map((m) => ({ value: m, label: `${m} ${tt("min")}` })),
            },
            { kind: "date", key: "date", label: tm("date"), required: true },
            {
              kind: "chips",
              key: "item",
              label: tt("on_optional"),
              options: [{ value: "", label: "—" }, ...time.learningItems.filter((i) => i.pct < 100).map((i) => ({ value: i.id, label: i.title }))],
            },
          ]}
          onClose={onClose}
          onSave={(v) =>
            finish(
              "learning_minutes",
              { minutes: Number(v.minutes), date: v.date, item_id: v.item || null, visibility: v.visibility },
              undefined,
              tt("minutes_logged", { n: Number(v.minutes) }),
            )
          }
        />
      );

    case "gym": {
      const s = time.gym.find((x) => x.id === id);
      return (
        <FormSheet
          title={s ? tt("edit_session") : tt("log_session")}
          editing={!!s}
          initial={s ? { type: s.type, date: s.date, time: hm(s.time) } : { type: "Strength", date: today.iso, time: "", ...preset }}
          fields={[
            { kind: "chips", key: "type", label: tm("type"), options: GYM_TYPES.map((t) => ({ value: t.value, label: tt(`gym_${t.value}`), icon: iconFor(t.icon) })) },
            { kind: "date", key: "date", label: tm("date"), required: true },
            { kind: "time", key: "time", label: tt("time_optional") },
          ]}
          onClose={onClose}
          onDelete={s ? () => del("gym_sessions", s.id, tt("delete_session")) : undefined}
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
              s ? tm("saved") : tt("session_logged"),
            )
          }
        />
      );
    }

    case "journal": {
      const j = time.journal.find((x) => x.id === id);
      return (
        <FormSheet
          title={j ? tt("edit_journal") : tt("new_journal")}
          editing={!!j}
          initial={j ? { text: j.text, date: j.date } : { date: today.iso, ...preset }}
          fields={[
            { kind: "textarea", key: "text", label: tm("today"), placeholder: tt("how_was_today"), required: true, rows: 7 },
            { kind: "date", key: "date", label: tm("date"), required: true },
          ]}
          onClose={onClose}
          onDelete={j ? () => del("journal_entries", j.id, tt("delete_note")) : undefined}
          onSave={(v) => finish("journal_entries", { text: text(v.text), date: v.date, visibility: "private" }, j?.id, j ? tm("saved") : tt("journal_saved"))}
        />
      );
    }

    case "idea": {
      const d = time.dateIdeas.find((x) => x.id === id);
      return (
        <FormSheet
          title={d ? tt("edit_idea") : tt("add_idea")}
          editing={!!d}
          initial={d ? { name: d.name, short: d.short ?? "", cost: d.cost == null ? "" : String(d.cost), icon: d.icon } : { icon: "heart", ...preset }}
          fields={[
            { kind: "text", key: "name", label: tt("idea"), placeholder: tt("ph_idea"), required: true },
            { kind: "text", key: "short", label: tt("short_note"), placeholder: tt("ph_short") },
            { kind: "amount", key: "cost", label: tt("about_how_much"), placeholder: "0" },
            { kind: "chips", key: "icon", label: tm("icon"), options: IDEA_ICONS.map((i) => ({ value: i, label: "", icon: iconFor(i) })) },
          ]}
          onClose={onClose}
          onDelete={d ? () => del("date_ideas", d.id, tm("delete", { name: d.name })) : undefined}
          onSave={(v) => {
            const cost = text(v.cost) ? num(v.cost) : null;
            if (cost != null && !(cost >= 0)) return tt("cost_number");
            return finish("date_ideas", { name: text(v.name), short: text(v.short) || null, cost, icon: v.icon || "heart" }, d?.id, d ? tm("saved") : tt("idea_added"));
          }}
        />
      );
    }

    case "career": {
      const c = time.careerSteps.find((x) => x.id === id);
      const plans = [...new Set(time.careerSteps.map((x) => x.plan))];
      return (
        <FormSheet
          title={c ? tt("edit_step") : tt("add_step")}
          editing={!!c}
          initial={
            c
              ? { title: c.title, plan: c.plan, timing: c.timing ?? "", status: c.status, visibility: c.visibility }
              : { plan: plans[0] ?? "", status: "next", visibility: vis("career"), ...preset }
          }
          fields={[
            { kind: "text", key: "plan", label: tt("plan"), placeholder: tt("ph_plan"), required: true },
            { kind: "text", key: "title", label: tt("step"), placeholder: tt("ph_career_step"), required: true },
            { kind: "text", key: "timing", label: tt("when_optional"), placeholder: tt("ph_when") },
            {
              kind: "chips",
              key: "status",
              label: tm("status"),
              options: [
                { value: "done", label: tm("done") },
                { value: "now", label: tt("doing_now") },
                { value: "next", label: tt("next") },
              ],
            },
            VISIBILITY,
          ]}
          onClose={onClose}
          onDelete={c ? () => del("career_steps", c.id, tm("delete", { name: c.title })) : undefined}
          onSave={(v) =>
            finish(
              "career_steps",
              {
                title: text(v.title),
                plan: text(v.plan),
                timing: text(v.timing) || null,
                status: v.status,
                visibility: v.visibility,
                ...(c ? {} : { sort: time.careerSteps.filter((x) => x.plan === text(v.plan)).length }),
              },
              c?.id,
              c ? tm("saved") : tt("step_added"),
            )
          }
        />
      );
    }

    case "wage":
      return (
        <FormSheet
          title={tt("wage_title")}
          initial={{ wage: settings?.shift_wage == null ? "" : String(settings.shift_wage) }}
          fields={[
            { kind: "amount", key: "wage", label: tt("wage_label"), placeholder: "0", required: true },
            { kind: "note", key: "n", label: "", text: tt("wage_note") },
          ]}
          onClose={onClose}
          onSave={async (v) => {
            const wage = num(v.wage);
            if (!(wage >= 0)) return tt("cost_number");
            const { error } = await supabase().from("member_settings").update({ shift_wage: wage }).eq("member_id", userId);
            if (error) return tm("could_not_save", { message: error.message });
            await reload();
            toast(tm("saved"));
            onClose();
          }}
        />
      );

    case "datenight": {
      const d = time.dateNights.find((x) => x.id === id);
      const past = d ? d.date <= today.iso : false;
      return (
        <FormSheet
          title={d ? (past ? tt("how_was_it") : tt("edit_date")) : tt("plan_date")}
          editing={!!d}
          initial={
            d
              ? { name: d.name, date: d.date, cost: d.cost == null ? "" : String(d.cost), rating: d.rating ? String(d.rating) : "", note: d.note ?? "", icon: d.icon }
              : { date: today.iso, start: "19:00", icon: "heart", rating: "", ...preset }
          }
          fields={[
            { kind: "text", key: "name", label: tt("what"), placeholder: tt("ph_date"), required: true },
            { kind: "date", key: "date", label: tm("date"), required: true },
            ...(d ? [] : [{ kind: "time", key: "start", label: tt("time_adds_week") } as Field]),
            { kind: "amount", key: "cost", label: tt("cost_optional"), placeholder: "0" },
            ...(d && past
              ? [
                  {
                    kind: "chips",
                    key: "rating",
                    label: tt("rating"),
                    options: [{ value: "", label: "—" }, ...[1, 2, 3, 4, 5].map((n) => ({ value: String(n), label: "★".repeat(n) }))],
                  } as Field,
                ]
              : []),
            { kind: "text", key: "note", label: tm("note_optional") },
          ]}
          onClose={onClose}
          onDelete={d ? () => del("date_nights", d.id, tm("delete", { name: d.name })) : undefined}
          onSave={async (v) => {
            const cost = text(v.cost) ? num(v.cost) : null;
            if (cost != null && !(cost >= 0)) return tt("cost_number");
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
                title: tt("date_event_title", { name: text(v.name) }),
                date: v.date,
                start_time: text(v.start) || null,
                who: null,
                remind_min: text(v.start) ? 60 : null,
              });
              if (!ev || ev === QUEUED) values.event_id = eventId;
              if (preset?.idea_id) values.idea_id = preset.idea_id;
            }
            return finish("date_nights", values, d?.id, d ? tm("saved") : tt("date_planned"));
          }}
        />
      );
    }
  }
}
