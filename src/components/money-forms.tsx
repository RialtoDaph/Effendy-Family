"use client";

import { useTranslations } from "next-intl";
import { TIME_FORM_KINDS, TimeForm, type TimeFormKind } from "@/components/time-forms";
import { ReceiptScan } from "@/components/receipt-scan";
import { QUEUED } from "@/lib/offline-queue";
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { useAppData } from "@/components/app-data";
import { FinanceForm, type FinanceFormKind } from "@/components/finance-forms";
import { useMoney, type MoneyTable } from "@/components/money-data";
import { FormSheet, useVisibilityField, type Field, type FormValues } from "@/components/sheet";
import { useToast } from "@/components/toast";
import { CATEGORY_ICONS, GOAL_ICONS, iconFor } from "@/lib/icons";
import { parseAmount, type Category, type Goal, type Income, type Recurring, type Transaction } from "@/lib/money";

type FormKind = "tx" | "cat" | "income" | "recur" | "goal" | "scan" | FinanceFormKind | TimeFormKind;
type Open = { kind: FormKind; id?: string; preset?: FormValues };

type MoneyForms = {
  openForm: (kind: FormKind, id?: string, preset?: FormValues) => void;
};

const MoneyFormsContext = createContext<MoneyForms>({ openForm: () => {} });
export const useMoneyForms = () => useContext(MoneyFormsContext);

export function MoneyFormsProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState<Open | null>(null);
  const openForm = useCallback((kind: FormKind, id?: string, preset?: FormValues) => setOpen({ kind, id, preset }), []);
  const value = useMemo(() => ({ openForm }), [openForm]);
  return (
    <MoneyFormsContext value={value}>
      {children}
      {open?.kind === "scan" ? (
        <ReceiptScan onClose={() => setOpen(null)} onRead={(preset) => setOpen({ kind: "tx", preset })} />
      ) : (
        open && <MoneyForm key={`${open.kind}-${open.id ?? "new"}`} open={open} onClose={() => setOpen(null)} />
      )}
    </MoneyFormsContext>
  );
}

function MoneyForm({ open, onClose }: { open: Open; onClose: () => void }) {
  if (TIME_FORM_KINDS.includes(open.kind as TimeFormKind)) {
    return <TimeForm kind={open.kind as TimeFormKind} id={open.id} preset={open.preset} onClose={onClose} />;
  }
  return <MoneyFormBody open={open} onClose={onClose} />;
}

function MoneyFormBody({ open, onClose }: { open: Open; onClose: () => void }) {
  if (!["tx", "cat", "income", "recur", "goal"].includes(open.kind)) {
    return <FinanceForm kind={open.kind as FinanceFormKind} id={open.id} preset={open.preset} onClose={onClose} />;
  }
  return <CoreMoneyForm open={open} onClose={onClose} />;
}

function CoreMoneyForm({ open, onClose }: { open: Open; onClose: () => void }) {
  const tm = useTranslations("money");
  const VISIBILITY = useVisibilityField();
  const { members, settings, userId } = useAppData();
  const money = useMoney();
  const toast = useToast();

  const who = [
    ...members.map((m) => ({ value: m.id, label: m.display_name })),
    { value: "family", label: tm("family") },
  ];
  const catOptions = money.categories.map((c) => ({ value: c.id, label: c.name, icon: iconFor(c.icon) }));
  const defaultVis = (module: string) => settings?.default_visibility?.[module] ?? "family";
  const toId = (v: unknown) => (v && v !== "family" ? String(v) : null);

  async function finish(table: MoneyTable, values: Record<string, unknown>, id: string | undefined, msg: string) {
    const err = await money.save(table, values, id);
    if (err && err !== QUEUED) return err;
    toast(err === QUEUED ? tm("queued") : msg);
    onClose();
  }

  async function del(table: MoneyTable, id: string, question: string) {
    if (!confirm(question)) return;
    const err = await money.remove(table, id);
    if (err && err !== QUEUED) toast(err);
    else {
      toast(err === QUEUED ? tm("queued") : tm("deleted"));
      onClose();
    }
  }

  const amountOk = (v: unknown, allowZero = false) => {
    const n = parseAmount(v);
    return Number.isFinite(n) && (allowZero ? n >= 0 : n > 0);
  };

  switch (open.kind) {
    case "tx": {
      const t = money.transactions.find((x) => x.id === open.id) as Transaction | undefined;
      const initial: FormValues = t
        ? {
            kind: t.amount < 0 ? "out" : "in",
            amount: String(Math.abs(t.amount)),
            payee: t.payee,
            category: t.category_id ?? "",
            date: t.date,
            paid_by: t.paid_by ?? "family",
            visibility: t.visibility,
            note: t.note ?? "",
          }
        : { kind: "out", date: money.today.iso, paid_by: userId, visibility: defaultVis("transactions"), ...open.preset };
      return (
        <FormSheet
          title={t ? tm("edit_transaction") : tm("add_transaction")}
          editing={!!t}
          initial={initial}
          fields={[
            { kind: "chips", key: "kind", label: tm("type"), options: [{ value: "out", label: tm("money_out") }, { value: "in", label: tm("money_in") }] },
            { kind: "amount", key: "amount", label: tm("amount"), placeholder: "0.00", required: true },
            { kind: "text", key: "payee", label: tm("shop_or_who_paid"), placeholder: tm("e_g_rewe"), required: true },
            { kind: "chips", key: "category", label: tm("category"), options: catOptions },
            { kind: "date", key: "date", label: tm("date"), required: true },
            { kind: "chips", key: "paid_by", label: tm("paid_by"), options: who },
            VISIBILITY,
            { kind: "text", key: "note", label: tm("note_optional") },
          ]}
          onClose={onClose}
          onDelete={t ? () => del("transactions", t.id, tm("delete_4", { payee: t.payee })) : undefined}
          onSave={(v) => {
            if (!amountOk(v.amount)) return tm("please_enter_an_amount_above_0");
            const n = parseAmount(v.amount);
            return finish(
              "transactions",
              {
                amount: v.kind === "in" ? n : -n,
                payee: String(v.payee).trim(),
                category_id: v.category || null,
                date: v.date,
                paid_by: toId(v.paid_by),
                visibility: v.visibility,
                note: String(v.note ?? "").trim() || null,
                ...(!t && v.receipt_file_id ? { receipt_file_id: v.receipt_file_id, source: "receipt" } : {}),
              },
              t?.id,
              t ? tm("saved") : tm("transaction_added"),
            );
          }}
        />
      );
    }

    case "cat": {
      const c = money.categories.find((x) => x.id === open.id) as Category | undefined;
      return (
        <FormSheet
          title={c ? tm("edit_category") : tm("add_category")}
          editing={!!c}
          initial={
            c
              ? { name: c.name, icon: c.icon, limit: String(c.monthly_limit), type: c.is_fixed ? "fixed" : "flex" }
              : { icon: "tag", type: "flex", ...open.preset }
          }
          fields={[
            { kind: "text", key: "name", label: tm("name"), placeholder: tm("e_g_groceries"), required: true },
            { kind: "chips", key: "icon", label: tm("icon"), options: CATEGORY_ICONS.map((i) => ({ value: i, label: "", icon: iconFor(i) })) },
            { kind: "amount", key: "limit", label: tm("monthly_limit"), placeholder: "0", required: true },
            {
              kind: "chips",
              key: "type",
              label: tm("type"),
              options: [
                { value: "fixed", label: tm("fixed_rent_insurance") },
                { value: "flex", label: tm("flexible_day_to_day") },
              ],
            },
          ]}
          onClose={onClose}
          onDelete={
            c
              ? () => del("categories", c.id, tm("delete_its_transactions_stay_without_a_cat", { name: c.name }))
              : undefined
          }
          onSave={(v) => {
            if (!amountOk(v.limit, true)) return tm("please_enter_a_monthly_limit_0_or_more");
            return finish(
              "categories",
              {
                name: String(v.name).trim(),
                icon: v.icon || "tag",
                monthly_limit: parseAmount(v.limit),
                is_fixed: v.type === "fixed",
                ...(c ? {} : { sort: money.categories.length + 1 }),
              },
              c?.id,
              c ? tm("saved") : tm("category_added"),
            );
          }}
        />
      );
    }

    case "income": {
      const i = money.incomes.find((x) => x.id === open.id) as Income | undefined;
      return (
        <FormSheet
          title={i ? tm("edit_income") : tm("add_income")}
          editing={!!i}
          initial={
            i
              ? { name: i.name, member: i.member_id ?? "family", kind: i.kind, amount: String(i.monthly_amount), visibility: i.visibility }
              : { member: userId, kind: "Salary", visibility: defaultVis("incomes"), ...open.preset }
          }
          fields={[
            { kind: "text", key: "name", label: tm("name"), placeholder: tm("e_g_bar_salary_net"), required: true },
            { kind: "chips", key: "member", label: tm("whose_income"), options: who },
            {
              kind: "chips",
              key: "kind",
              label: tm("kind"),
              options: [
                { value: "Salary", label: tm("salary") },
                { value: "Business", label: tm("business") },
                { value: "Other", label: tm("other") },
              ],
            },
            { kind: "amount", key: "amount", label: tm("per_month_net_average"), placeholder: "0", required: true },
            VISIBILITY,
          ]}
          onClose={onClose}
          onDelete={i ? () => del("incomes", i.id, tm("delete", { name: i.name })) : undefined}
          onSave={(v) => {
            if (!amountOk(v.amount, true)) return tm("please_enter_an_amount_0_or_more");
            return finish(
              "incomes",
              {
                name: String(v.name).trim(),
                member_id: toId(v.member),
                kind: v.kind,
                monthly_amount: parseAmount(v.amount),
                visibility: v.visibility,
              },
              i?.id,
              i ? tm("saved") : tm("income_added"),
            );
          }}
        />
      );
    }

    case "recur": {
      const r = money.recurring.find((x) => x.id === open.id) as Recurring | undefined;
      return (
        <FormSheet
          title={r ? tm("edit_recurring") : tm("add_recurring_payment")}
          editing={!!r}
          initial={
            r
              ? {
                  name: r.name,
                  kind: r.amount < 0 ? "out" : "in",
                  amount: String(Math.abs(r.amount)),
                  category: r.category_id ?? "",
                  day: String(r.day_of_month),
                  paid_by: r.paid_by ?? "family",
                  visibility: r.visibility,
                  active: r.active,
                }
              : { kind: "out", paid_by: "family", visibility: defaultVis("recurring"), active: true, ...open.preset }
          }
          fields={[
            { kind: "text", key: "name", label: tm("name"), placeholder: tm("e_g_rent"), required: true },
            { kind: "chips", key: "kind", label: tm("type"), options: [{ value: "out", label: tm("goes_out") }, { value: "in", label: tm("comes_in") }] },
            { kind: "amount", key: "amount", label: tm("amount"), placeholder: "0.00", required: true },
            { kind: "chips", key: "category", label: tm("category"), options: catOptions },
            { kind: "number", key: "day", label: tm("day_of_the_month_1_28"), placeholder: "1", required: true },
            { kind: "chips", key: "paid_by", label: tm("paid_by"), options: who },
            VISIBILITY,
            { kind: "toggle", key: "active", label: tm("status"), toggleLabel: tm("on_add_it_every_month") },
          ]}
          onClose={onClose}
          onDelete={r ? () => del("recurring", r.id, tm("delete_past_transactions_stay", { name: r.name })) : undefined}
          onSave={(v) => {
            if (!amountOk(v.amount)) return tm("please_enter_an_amount_above_0");
            const day = Number(String(v.day).trim());
            if (!Number.isInteger(day) || day < 1 || day > 28) return tm("day_must_be_a_whole_number_from_1_to_28");
            const n = parseAmount(v.amount);
            const cat = money.categories.find((c) => c.id === v.category);
            return finish(
              "recurring",
              {
                name: String(v.name).trim(),
                amount: v.kind === "in" ? n : -n,
                category_id: v.category || null,
                icon: cat?.icon ?? "repeat",
                day_of_month: day,
                paid_by: toId(v.paid_by),
                visibility: v.visibility,
                active: !!v.active,
              },
              r?.id,
              r ? tm("saved") : tm("recurring_payment_added"),
            );
          }}
        />
      );
    }

    case "goal": {
      const g = money.goals.find((x) => x.id === open.id) as Goal | undefined;
      const isEf = !!g?.is_emergency_fund;
      const fields: Field[] = [
        { kind: "text", key: "name", label: tm("name"), placeholder: tm("e_g_family_car"), required: true },
        { kind: "chips", key: "icon", label: tm("icon"), options: GOAL_ICONS.map((i) => ({ value: i, label: "", icon: iconFor(i) })) },
        ...(isEf ? [] : [{ kind: "amount", key: "target", label: tm("target"), placeholder: "0", required: true } as Field]),
        { kind: "amount", key: "current", label: tm("saved_so_far"), placeholder: "0" },
        { kind: "amount", key: "monthly", label: tm("put_in_each_month"), placeholder: "0" },
        ...(isEf ? [] : [{ kind: "date", key: "deadline", label: tm("ready_by_optional") } as Field, VISIBILITY]),
      ];
      return (
        <FormSheet
          title={isEf ? tm("update_emergency_fund") : g ? tm("edit_goal") : tm("add_goal")}
          editing={!!g}
          initial={
            g
              ? {
                  name: g.name,
                  icon: g.icon,
                  target: String(g.target),
                  current: String(g.current),
                  monthly: String(g.monthly),
                  deadline: g.deadline ?? "",
                  visibility: g.visibility,
                }
              : { icon: "target", ...open.preset }
          }
          fields={fields}
          onClose={onClose}
          onDelete={g && !isEf ? () => del("goals", g.id, tm("delete", { name: g.name })) : undefined}
          onSave={(v) => {
            for (const k of ["target", "current", "monthly"]) {
              if (String(v[k] ?? "").trim() && !amountOk(v[k], true)) return tm("amounts_must_be_numbers_0_or_more");
            }
            const num = (k: string) => (String(v[k] ?? "").trim() ? parseAmount(v[k]) : 0);
            return finish(
              "goals",
              {
                name: String(v.name).trim(),
                icon: v.icon || "target",
                current: num("current"),
                monthly: num("monthly"),
                ...(isEf ? {} : { target: num("target"), deadline: v.deadline || null, visibility: v.visibility }),
              },
              g?.id,
              g ? tm("saved") : tm("goal_added"),
            );
          }}
        />
      );
    }
  }
}
