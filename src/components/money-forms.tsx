"use client";

import { ReceiptScan } from "@/components/receipt-scan";
import { QUEUED, QUEUED_MSG } from "@/lib/offline-queue";
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { useAppData } from "@/components/app-data";
import { FinanceForm, type FinanceFormKind } from "@/components/finance-forms";
import { useMoney, type MoneyTable } from "@/components/money-data";
import { FormSheet, type Field, type FormValues } from "@/components/sheet";
import { useToast } from "@/components/toast";
import { CATEGORY_ICONS, GOAL_ICONS, iconFor } from "@/lib/icons";
import { parseAmount, type Category, type Goal, type Income, type Recurring, type Transaction } from "@/lib/money";

type FormKind = "tx" | "cat" | "income" | "recur" | "goal" | "scan" | FinanceFormKind;
type Open = { kind: FormKind; id?: string; preset?: FormValues };

type MoneyForms = {
  openForm: (kind: FormKind, id?: string, preset?: FormValues) => void;
};

const MoneyFormsContext = createContext<MoneyForms>({ openForm: () => {} });
export const useMoneyForms = () => useContext(MoneyFormsContext);

const VISIBILITY: Field = {
  kind: "chips",
  key: "visibility",
  label: "Visible to",
  required: true,
  options: [
    { value: "family", label: "Family" },
    { value: "private", label: "Only me" },
  ],
};

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
  if (!["tx", "cat", "income", "recur", "goal"].includes(open.kind)) {
    return <FinanceForm kind={open.kind as FinanceFormKind} id={open.id} preset={open.preset} onClose={onClose} />;
  }
  return <CoreMoneyForm open={open} onClose={onClose} />;
}

function CoreMoneyForm({ open, onClose }: { open: Open; onClose: () => void }) {
  const { members, settings, userId } = useAppData();
  const money = useMoney();
  const toast = useToast();

  const who = [
    ...members.map((m) => ({ value: m.id, label: m.display_name })),
    { value: "family", label: "Family" },
  ];
  const catOptions = money.categories.map((c) => ({ value: c.id, label: c.name, icon: iconFor(c.icon) }));
  const defaultVis = (module: string) => settings?.default_visibility?.[module] ?? "family";
  const toId = (v: unknown) => (v && v !== "family" ? String(v) : null);

  async function finish(table: MoneyTable, values: Record<string, unknown>, id: string | undefined, msg: string) {
    const err = await money.save(table, values, id);
    if (err && err !== QUEUED) return err;
    toast(err === QUEUED ? QUEUED_MSG : msg);
    onClose();
  }

  async function del(table: MoneyTable, id: string, question: string) {
    if (!confirm(question)) return;
    const err = await money.remove(table, id);
    if (err && err !== QUEUED) toast(err);
    else {
      toast(err === QUEUED ? QUEUED_MSG : "Deleted");
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
          title={t ? "Edit transaction" : "Add transaction"}
          editing={!!t}
          initial={initial}
          fields={[
            { kind: "chips", key: "kind", label: "Type", options: [{ value: "out", label: "Money out" }, { value: "in", label: "Money in" }] },
            { kind: "amount", key: "amount", label: "Amount", placeholder: "0.00", required: true },
            { kind: "text", key: "payee", label: "Shop or who paid", placeholder: "e.g. Rewe", required: true },
            { kind: "chips", key: "category", label: "Category", options: catOptions },
            { kind: "date", key: "date", label: "Date", required: true },
            { kind: "chips", key: "paid_by", label: "Paid by", options: who },
            VISIBILITY,
            { kind: "text", key: "note", label: "Note (optional)" },
          ]}
          onClose={onClose}
          onDelete={t ? () => del("transactions", t.id, `Delete “${t.payee}”?`) : undefined}
          onSave={(v) => {
            if (!amountOk(v.amount)) return "Please enter an amount above 0.";
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
              t ? "Saved" : "Transaction added",
            );
          }}
        />
      );
    }

    case "cat": {
      const c = money.categories.find((x) => x.id === open.id) as Category | undefined;
      return (
        <FormSheet
          title={c ? "Edit category" : "Add category"}
          editing={!!c}
          initial={
            c
              ? { name: c.name, icon: c.icon, limit: String(c.monthly_limit), type: c.is_fixed ? "fixed" : "flex" }
              : { icon: "tag", type: "flex", ...open.preset }
          }
          fields={[
            { kind: "text", key: "name", label: "Name", placeholder: "e.g. Groceries", required: true },
            { kind: "chips", key: "icon", label: "Icon", options: CATEGORY_ICONS.map((i) => ({ value: i, label: "", icon: iconFor(i) })) },
            { kind: "amount", key: "limit", label: "Monthly limit", placeholder: "0", required: true },
            {
              kind: "chips",
              key: "type",
              label: "Type",
              options: [
                { value: "fixed", label: "Fixed (rent, insurance)" },
                { value: "flex", label: "Flexible (day to day)" },
              ],
            },
          ]}
          onClose={onClose}
          onDelete={
            c
              ? () => del("categories", c.id, `Delete “${c.name}”? Its transactions stay, without a category.`)
              : undefined
          }
          onSave={(v) => {
            if (!amountOk(v.limit, true)) return "Please enter a monthly limit (0 or more).";
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
              c ? "Saved" : "Category added",
            );
          }}
        />
      );
    }

    case "income": {
      const i = money.incomes.find((x) => x.id === open.id) as Income | undefined;
      return (
        <FormSheet
          title={i ? "Edit income" : "Add income"}
          editing={!!i}
          initial={
            i
              ? { name: i.name, member: i.member_id ?? "family", kind: i.kind, amount: String(i.monthly_amount), visibility: i.visibility }
              : { member: userId, kind: "Salary", visibility: defaultVis("incomes"), ...open.preset }
          }
          fields={[
            { kind: "text", key: "name", label: "Name", placeholder: "e.g. Bar salary (net)", required: true },
            { kind: "chips", key: "member", label: "Whose income", options: who },
            {
              kind: "chips",
              key: "kind",
              label: "Kind",
              options: [
                { value: "Salary", label: "Salary" },
                { value: "Business", label: "Business" },
                { value: "Other", label: "Other" },
              ],
            },
            { kind: "amount", key: "amount", label: "Per month (net, average)", placeholder: "0", required: true },
            VISIBILITY,
          ]}
          onClose={onClose}
          onDelete={i ? () => del("incomes", i.id, `Delete “${i.name}”?`) : undefined}
          onSave={(v) => {
            if (!amountOk(v.amount, true)) return "Please enter an amount (0 or more).";
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
              i ? "Saved" : "Income added",
            );
          }}
        />
      );
    }

    case "recur": {
      const r = money.recurring.find((x) => x.id === open.id) as Recurring | undefined;
      return (
        <FormSheet
          title={r ? "Edit recurring" : "Add recurring payment"}
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
            { kind: "text", key: "name", label: "Name", placeholder: "e.g. Rent", required: true },
            { kind: "chips", key: "kind", label: "Type", options: [{ value: "out", label: "Goes out" }, { value: "in", label: "Comes in" }] },
            { kind: "amount", key: "amount", label: "Amount", placeholder: "0.00", required: true },
            { kind: "chips", key: "category", label: "Category", options: catOptions },
            { kind: "number", key: "day", label: "Day of the month (1–28)", placeholder: "1", required: true },
            { kind: "chips", key: "paid_by", label: "Paid by", options: who },
            VISIBILITY,
            { kind: "toggle", key: "active", label: "Status", toggleLabel: "On: add it every month" },
          ]}
          onClose={onClose}
          onDelete={r ? () => del("recurring", r.id, `Delete “${r.name}”? Past transactions stay.`) : undefined}
          onSave={(v) => {
            if (!amountOk(v.amount)) return "Please enter an amount above 0.";
            const day = Number(String(v.day).trim());
            if (!Number.isInteger(day) || day < 1 || day > 28) return "Day must be a whole number from 1 to 28.";
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
              r ? "Saved" : "Recurring payment added",
            );
          }}
        />
      );
    }

    case "goal": {
      const g = money.goals.find((x) => x.id === open.id) as Goal | undefined;
      const isEf = !!g?.is_emergency_fund;
      const fields: Field[] = [
        { kind: "text", key: "name", label: "Name", placeholder: "e.g. Family car", required: true },
        { kind: "chips", key: "icon", label: "Icon", options: GOAL_ICONS.map((i) => ({ value: i, label: "", icon: iconFor(i) })) },
        ...(isEf ? [] : [{ kind: "amount", key: "target", label: "Target", placeholder: "0", required: true } as Field]),
        { kind: "amount", key: "current", label: "Saved so far", placeholder: "0" },
        { kind: "amount", key: "monthly", label: "Put in each month", placeholder: "0" },
        ...(isEf ? [] : [{ kind: "date", key: "deadline", label: "Ready by (optional)" } as Field, VISIBILITY]),
      ];
      return (
        <FormSheet
          title={isEf ? "Update emergency fund" : g ? "Edit goal" : "Add goal"}
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
          onDelete={g && !isEf ? () => del("goals", g.id, `Delete “${g.name}”?`) : undefined}
          onSave={(v) => {
            for (const k of ["target", "current", "monthly"]) {
              if (String(v[k] ?? "").trim() && !amountOk(v[k], true)) return "Amounts must be numbers (0 or more).";
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
              g ? "Saved" : "Goal added",
            );
          }}
        />
      );
    }
  }
}
