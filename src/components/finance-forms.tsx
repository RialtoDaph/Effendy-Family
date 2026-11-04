"use client";

import { useTranslations } from "next-intl";
import { QUEUED } from "@/lib/offline-queue";
import { useAppData } from "@/components/app-data";
import { useFinance, type FinanceTable } from "@/components/finance-data";
import { useMoney } from "@/components/money-data";
import { FormSheet, useVisibilityField, type Field, type FormValues } from "@/components/sheet";
import { useToast } from "@/components/toast";
import { received, rpFull } from "@/lib/finance";
import { GOAL_ICONS, iconFor } from "@/lib/icons";
import { parseAmount } from "@/lib/money";

export type FinanceFormKind = "debt" | "sub" | "remit" | "business" | "bizmonth" | "deadline" | "deduction" | "asset";

const DEBT_ICONS = ["credit-card", "house", "car", "smartphone", "graduation-cap", "heart", "briefcase", "wallet"];
const ASSET_ICONS = ["trending-up", "piggy-bank", "wallet", "house", "briefcase", "gift", "target", "life-buoy"];

export function FinanceForm({
  kind,
  id,
  preset,
  onClose,
}: {
  kind: FinanceFormKind;
  id?: string;
  preset?: FormValues;
  onClose: () => void;
}) {
  const tm = useTranslations("money");
  const { members, userId } = useAppData();
  const fin = useFinance();
  const money = useMoney();
  const toast = useToast();
  const VISIBILITY = useVisibilityField();

  const who = [...members.map((m) => ({ value: m.id, label: m.display_name })), { value: "family", label: tm("family") }];
  const toId = (v: unknown) => (v && v !== "family" ? String(v) : null);
  const num = (v: unknown) => (String(v ?? "").trim() ? parseAmount(v) : 0);
  const bad = (...vals: unknown[]) => vals.some((v) => String(v ?? "").trim() && !(parseAmount(v) >= 0));

  async function finish(table: FinanceTable, values: Record<string, unknown>, rowId: string | undefined, msg: string) {
    const err = await fin.save(table, values, rowId);
    if (err && err !== QUEUED) return err;
    toast(err === QUEUED ? tm("queued") : msg);
    onClose();
  }

  async function del(table: FinanceTable, rowId: string, question: string) {
    if (!confirm(question)) return;
    const err = await fin.remove(table, rowId);
    if (err && err !== QUEUED) toast(err);
    else {
      toast(err === QUEUED ? tm("queued") : tm("deleted"));
      onClose();
    }
  }

  switch (kind) {
    case "debt": {
      const d = fin.debts.find((x) => x.id === id);
      return (
        <FormSheet
          title={d ? tm("edit_debt") : tm("add_debt_title")}
          editing={!!d}
          initial={
            d
              ? {
                  name: d.name,
                  icon: d.icon,
                  lender: d.lender ?? "",
                  balance: String(d.balance),
                  original: String(d.original),
                  rate: String(d.rate_pct),
                  payment: String(d.monthly_payment),
                  member: d.member_id ?? "family",
                  visibility: d.visibility,
                }
              : { icon: "credit-card", member: "family", visibility: "family", ...preset }
          }
          fields={[
            { kind: "text", key: "name", label: tm("name"), placeholder: tm("e_g_furniture_loan"), required: true },
            { kind: "chips", key: "icon", label: tm("icon"), options: DEBT_ICONS.map((i) => ({ value: i, label: "", icon: iconFor(i) })) },
            { kind: "text", key: "lender", label: tm("lender"), placeholder: tm("e_g_sparkasse") },
            { kind: "amount", key: "balance", label: tm("still_owed"), placeholder: "0", required: true },
            { kind: "amount", key: "original", label: tm("borrowed_at_the_start"), placeholder: "0" },
            { kind: "number", key: "rate", label: tm("interest_per_year"), placeholder: "0" },
            { kind: "amount", key: "payment", label: tm("paid_each_month"), placeholder: "0", required: true },
            { kind: "chips", key: "member", label: tm("whose_debt"), options: who },
            VISIBILITY,
          ]}
          onClose={onClose}
          onDelete={d ? () => del("debts", d.id, tm("delete", { name: d.name })) : undefined}
          onSave={(v) => {
            if (bad(v.balance, v.original, v.rate, v.payment)) return tm("amounts_must_be_numbers_0_or_more");
            if (num(v.rate) >= 100) return tm("interest_must_be_below_100");
            return finish(
              "debts",
              {
                name: String(v.name).trim(),
                icon: v.icon || "credit-card",
                lender: String(v.lender ?? "").trim() || null,
                balance: num(v.balance),
                original: Math.max(num(v.original), num(v.balance)),
                rate_pct: num(v.rate),
                monthly_payment: num(v.payment),
                member_id: toId(v.member),
                visibility: v.visibility,
              },
              d?.id,
              d ? tm("saved") : tm("debt_added"),
            );
          }}
        />
      );
    }

    case "sub": {
      const s = fin.subscriptions.find((x) => x.id === id);
      return (
        <FormSheet
          title={s ? tm("edit_subscription") : tm("add_subscription_title")}
          editing={!!s}
          initial={
            s
              ? {
                  name: s.name,
                  price: String(s.monthly_price),
                  day: String(s.day_of_month),
                  category: s.category_id ?? "",
                  for: s.for_whom ?? "family",
                  status: s.status,
                  last_used: s.last_used_at ?? "",
                  visibility: s.visibility,
                }
              : { for: "family", status: "active", visibility: "family", day: String(money.today.d > 28 ? 28 : money.today.d), ...preset }
          }
          fields={[
            { kind: "text", key: "name", label: tm("name"), placeholder: tm("e_g_netflix"), required: true },
            { kind: "amount", key: "price", label: tm("price_per_month"), placeholder: "0.00", required: true },
            { kind: "number", key: "day", label: tm("charged_on_day_of_the_month_1_28"), placeholder: "1", required: true },
            {
              kind: "chips",
              key: "category",
              label: tm("budget_category"),
              options: money.categories.map((c) => ({ value: c.id, label: c.name, icon: iconFor(c.icon) })),
            },
            { kind: "chips", key: "for", label: tm("for"), options: who },
            {
              kind: "chips",
              key: "status",
              label: tm("status"),
              options: [
                { value: "active", label: tm("still_active") },
                { value: "cancelled", label: tm("stopped") },
              ],
            },
            { kind: "date", key: "last_used", label: tm("last_used") },
            VISIBILITY,
          ]}
          onClose={onClose}
          onDelete={
            s
              ? async () => {
                  if (!confirm(tm("delete_its_monthly_payment_stops_too_past", { name: s.name }))) return;
                  const err = await money.remove("recurring", s.id);
                  if (err && err !== QUEUED) toast(err);
                  else {
                    toast(err === QUEUED ? tm("queued") : tm("deleted"));
                    onClose();
                  }
                }
              : undefined
          }
          onSave={async (v) => {
            if (bad(v.price)) return tm("price_must_be_a_number");
            const day = Number(String(v.day ?? "").trim());
            if (!Number.isInteger(day) || day < 1 || day > 28) return tm("day_must_be_a_whole_number_from_1_to_28");
            const err = await money.save(
              "recurring",
              {
                name: String(v.name).trim(),
                amount: -num(v.price),
                icon: money.categories.find((c) => c.id === v.category)?.icon ?? "repeat",
                day_of_month: day,
                category_id: v.category || null,
                paid_by: toId(v.for),
                active: v.status === "active",
                is_subscription: true,
                last_used_at: v.last_used || null,
                cancelled_on: v.status === "cancelled" ? (s?.cancelled_on ?? money.today.iso) : null,
                visibility: v.visibility,
              },
              s?.id,
            );
            if (err && err !== QUEUED) return err;
            toast(err === QUEUED ? tm("queued") : s ? tm("saved_its_monthly_payment_is_updated_too") : tm("subscription_added_it_is_booked_every_mont"));
            onClose();
          }}
        />
      );
    }

    case "remit": {
      const r = fin.remittances.find((x) => x.id === id);
      const init: FormValues = r
        ? {
            to: r.to_name,
            eur: String(r.eur),
            fee: String(r.fee_eur),
            rate: String(r.rate_idr_per_eur),
            provider: r.provider,
            purpose: r.purpose ?? "",
            date: r.date,
            visibility: r.visibility,
          }
        : {
            provider: "Wise",
            rate: String(fin.rate),
            date: new Date().toISOString().slice(0, 10),
            visibility: "family",
            ...preset,
          };
      return (
        <FormSheet
          title={r ? tm("edit_transfer") : tm("log_a_transfer_home")}
          editing={!!r}
          initial={init}
          fields={[
            { kind: "text", key: "to", label: tm("to"), placeholder: tm("e_g_mama"), required: true },
            { kind: "amount", key: "eur", label: tm("sent_eur"), placeholder: "0", required: true },
            { kind: "amount", key: "fee", label: tm("fee_eur"), placeholder: "0" },
            { kind: "number", key: "rate", label: tm("rate_1_rp"), placeholder: String(fin.rate), required: true },
            {
              kind: "chips",
              key: "provider",
              label: tm("sent_with"),
              options: ["Wise", "Bank (SWIFT)", "Western Union", "Other"].map((p) => ({ value: p, label: p === "Other" ? tm("other") : p })),
            },
            { kind: "text", key: "purpose", label: tm("purpose"), placeholder: tm("e_g_monthly_support") },
            { kind: "date", key: "date", label: tm("date"), required: true },
            VISIBILITY,
            { kind: "note", key: "n", label: "", text: tm("rupiah_received_eur_fee_rate_it_is_saved_w") },
          ]}
          onClose={onClose}
          onDelete={r ? () => del("remittances", r.id, tm("delete_this_transfer_to", { to_name: r.to_name })) : undefined}
          onSave={(v) => {
            const eur = parseAmount(v.eur);
            const rate = parseAmount(v.rate);
            const fee = num(v.fee);
            if (!(eur > 0)) return tm("please_enter_the_amount_sent");
            if (!(rate > 0)) return tm("please_enter_the_rate");
            if (!(fee >= 0) || fee >= eur) return tm("the_fee_must_be_less_than_the_amount");
            return finish(
              "remittances",
              {
                to_name: String(v.to).trim(),
                eur,
                fee_eur: fee,
                rate_idr_per_eur: rate,
                idr_received: received(eur, fee, rate),
                provider: v.provider || "Other",
                purpose: String(v.purpose ?? "").trim() || null,
                date: v.date,
                visibility: v.visibility,
              },
              r?.id,
              r ? tm("saved") : tm("logged_arrives", { amount: rpFull(received(eur, fee, rate)) }),
            );
          }}
        />
      );
    }

    case "business": {
      const b = fin.businesses.find((x) => x.id === id);
      return (
        <FormSheet
          title={b ? tm("edit_business") : tm("add_business_title")}
          editing={!!b}
          initial={
            b
              ? { name: b.name, member: b.member_id ?? "family", vat: b.vat_mode, visibility: b.visibility }
              : { member: userId, vat: "none", visibility: "family", ...preset }
          }
          fields={[
            { kind: "text", key: "name", label: tm("name"), required: true },
            { kind: "chips", key: "member", label: tm("run_by"), options: who },
            {
              kind: "chips",
              key: "vat",
              label: tm("vat_umsatzsteuer"),
              options: [
                { value: "none", label: tm("none_kleinunternehmer") },
                { value: "quarterly", label: tm("quarterly") },
                { value: "monthly", label: tm("monthly") },
              ],
            },
            VISIBILITY,
          ]}
          onClose={onClose}
          onDelete={b ? () => del("businesses", b.id, tm("delete_and_all_its_months", { name: b.name })) : undefined}
          onSave={(v) =>
            finish(
              "businesses",
              {
                name: String(v.name).trim(),
                member_id: toId(v.member),
                vat_mode: v.vat,
                visibility: v.visibility,
                ...(b ? {} : { sort: fin.businesses.length + 1 }),
              },
              b?.id,
              b ? tm("saved") : tm("business_added"),
            )
          }
        />
      );
    }

    case "bizmonth": {
      const m = fin.businessMonths.find((x) => x.id === id);
      const file = m?.file_id ? fin.files.find((f) => f.id === m.file_id) : undefined;
      const businessId = m?.business_id ?? String(preset?.business ?? fin.businesses[0]?.id ?? "");
      const now = new Date();
      const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const defMonth = `${lastMonth.getFullYear()}-${String(lastMonth.getMonth() + 1).padStart(2, "0")}`;
      return (
        <FormSheet
          title={m ? tm("edit_month") : tm("add_a_month_title")}
          editing={!!m}
          initial={
            m
              ? {
                  business: m.business_id,
                  month: m.month,
                  revenue: String(m.revenue),
                  costs: String(m.costs),
                  tax: String(m.tax_set_aside),
                  visibility: m.visibility,
                }
              : { business: businessId, month: defMonth, visibility: "family", ...preset }
          }
          fields={[
            ...(m
              ? []
              : [
                  {
                    kind: "chips",
                    key: "business",
                    label: tm("business"),
                    required: true,
                    options: fin.businesses.map((b) => ({ value: b.id, label: b.name })),
                  } as Field,
                  { kind: "text", key: "month", label: tm("month_yyyy_mm"), placeholder: defMonth, required: true } as Field,
                ]),
            { kind: "amount", key: "revenue", label: tm("revenue"), placeholder: "0", required: true },
            { kind: "amount", key: "costs", label: tm("costs"), placeholder: "0" },
            { kind: "amount", key: "tax", label: tm("set_aside_for_tax"), placeholder: "0" },
            {
              kind: "file",
              key: "file",
              label: tm("monthly_report_pdf_csv_excel"),
              accept: ".pdf,.csv,.xls,.xlsx,application/pdf,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
              current: file?.name,
            },
            VISIBILITY,
          ]}
          onClose={onClose}
          onDelete={m ? () => del("business_months", m.id, tm("delete_2", { month: m.month })) : undefined}
          onSave={async (v) => {
            if (bad(v.revenue, v.costs, v.tax)) return tm("amounts_must_be_numbers_0_or_more");
            if (!m && !/^\d{4}-(0[1-9]|1[0-2])$/.test(String(v.month).trim())) return tm("month_must_look_like_2026_09");
            let fileId = m?.file_id ?? null;
            if (v.file instanceof File) {
              const up = await fin.upload(v.file, "business_report", String(v.visibility));
              if (up.error || !up.id) return up.error ?? tm("upload_failed");
              fileId = up.id;
            }
            return finish(
              "business_months",
              {
                ...(m ? {} : { business_id: v.business, month: String(v.month).trim() }),
                revenue: num(v.revenue),
                costs: num(v.costs),
                tax_set_aside: num(v.tax),
                file_id: fileId,
                visibility: v.visibility,
              },
              m?.id,
              m ? tm("saved") : tm("month_added"),
            );
          }}
        />
      );
    }

    case "deadline": {
      const t = fin.taxDeadlines.find((x) => x.id === id);
      return (
        <FormSheet
          title={t ? tm("edit_deadline") : tm("add_tax_deadline")}
          editing={!!t}
          initial={
            t
              ? { title: t.title, date: t.due_date, amount: t.amount == null ? "" : String(t.amount), kind: t.kind, visibility: t.visibility }
              : { kind: "other", visibility: "family", ...preset }
          }
          fields={[
            { kind: "text", key: "title", label: tm("what"), placeholder: tm("e_g_income_tax_prepayment_q4"), required: true },
            { kind: "date", key: "date", label: tm("due"), required: true },
            { kind: "amount", key: "amount", label: tm("amount_optional"), placeholder: "0" },
            {
              kind: "chips",
              key: "kind",
              label: tm("kind"),
              options: [
                { value: "prepayment", label: tm("prepayment") },
                { value: "return", label: tm("tax_return") },
                { value: "vat", label: "VAT" },
                { value: "other", label: tm("other") },
              ],
            },
            VISIBILITY,
          ]}
          onClose={onClose}
          onDelete={t ? () => del("tax_deadlines", t.id, tm("delete_3", { title: t.title })) : undefined}
          onSave={(v) => {
            if (bad(v.amount)) return tm("amount_must_be_a_number");
            return finish(
              "tax_deadlines",
              {
                title: String(v.title).trim(),
                due_date: v.date,
                amount: String(v.amount ?? "").trim() ? num(v.amount) : null,
                kind: v.kind,
                visibility: v.visibility,
              },
              t?.id,
              t ? tm("saved") : tm("deadline_added"),
            );
          }}
        />
      );
    }

    case "deduction": {
      const d = fin.taxDeductions.find((x) => x.id === id);
      const year = Number(preset?.year ?? new Date().getFullYear());
      return (
        <FormSheet
          title={d ? tm("edit_deduction") : tm("add_deduction")}
          editing={!!d}
          initial={
            d
              ? { title: d.title, amount: String(d.amount), collected: d.collected, visibility: d.visibility }
              : { collected: false, visibility: "family", ...preset }
          }
          fields={[
            { kind: "text", key: "title", label: tm("what"), placeholder: tm("e_g_work_laptop_commute_donations"), required: true },
            { kind: "amount", key: "amount", label: tm("amount"), placeholder: "0" },
            { kind: "toggle", key: "collected", label: tm("proof"), toggleLabel: tm("receipts_are_collected") },
            VISIBILITY,
          ]}
          onClose={onClose}
          onDelete={d ? () => del("tax_deductions", d.id, tm("delete_3", { title: d.title })) : undefined}
          onSave={(v) => {
            if (bad(v.amount)) return tm("amount_must_be_a_number");
            return finish(
              "tax_deductions",
              {
                title: String(v.title).trim(),
                amount: num(v.amount),
                collected: !!v.collected,
                visibility: v.visibility,
                ...(d ? {} : { year }),
              },
              d?.id,
              d ? tm("saved") : tm("deduction_added"),
            );
          }}
        />
      );
    }

    case "asset": {
      const a = fin.assets.find((x) => x.id === id);
      return (
        <FormSheet
          title={a ? tm("update_value") : tm("add_savings_or_investment")}
          editing={!!a}
          initial={
            a
              ? {
                  name: a.name,
                  icon: a.icon,
                  location: a.location ?? "",
                  currency: a.orig_currency,
                  value: String(a.orig_value),
                  note: a.note ?? "",
                  visibility: a.visibility,
                }
              : { icon: "piggy-bank", currency: "EUR", visibility: "family", ...preset }
          }
          fields={[
            { kind: "text", key: "name", label: tm("name"), placeholder: tm("e_g_etf_savings_plan"), required: true },
            { kind: "chips", key: "icon", label: tm("icon"), options: [...new Set([...ASSET_ICONS, ...GOAL_ICONS])].slice(0, 10).map((i) => ({ value: i, label: "", icon: iconFor(i) })) },
            { kind: "text", key: "location", label: tm("where"), placeholder: tm("e_g_trade_republic_ftse_all_world") },
            {
              kind: "chips",
              key: "currency",
              label: tm("currency"),
              options: [
                { value: "EUR", label: tm("euro") },
                { value: "IDR", label: tm("rupiah") },
              ],
            },
            { kind: "number", key: "value", label: tm("value_today_in_that_currency"), placeholder: "0", required: true },
            { kind: "text", key: "note", label: tm("note_optional"), placeholder: tm("e_g_can_sell_within_2_days") },
            VISIBILITY,
          ]}
          onClose={onClose}
          onDelete={a ? () => del("assets", a.id, tm("delete", { name: a.name })) : undefined}
          onSave={(v) => {
            if (bad(v.value)) return tm("value_must_be_a_number");
            return finish(
              "assets",
              {
                name: String(v.name).trim(),
                icon: v.icon || "piggy-bank",
                location: String(v.location ?? "").trim() || null,
                orig_currency: v.currency,
                orig_value: num(v.value),
                note: String(v.note ?? "").trim() || null,
                visibility: v.visibility,
              },
              a?.id,
              a ? tm("saved") : tm("added"),
            );
          }}
        />
      );
    }
  }
}
