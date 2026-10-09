"use client";

import { useAppData } from "@/components/app-data";
import { useFinance, type FinanceTable } from "@/components/finance-data";
import { FormSheet, type Field, type FormValues } from "@/components/sheet";
import { useToast } from "@/components/toast";
import { received, rpFull } from "@/lib/finance";
import { GOAL_ICONS, iconFor } from "@/lib/icons";
import { parseAmount } from "@/lib/money";

export type FinanceFormKind = "debt" | "sub" | "remit" | "business" | "bizmonth" | "deadline" | "deduction" | "asset";

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
  const { members, userId } = useAppData();
  const fin = useFinance();
  const toast = useToast();

  const who = [...members.map((m) => ({ value: m.id, label: m.display_name })), { value: "family", label: "Family" }];
  const toId = (v: unknown) => (v && v !== "family" ? String(v) : null);
  const num = (v: unknown) => (String(v ?? "").trim() ? parseAmount(v) : 0);
  const bad = (...vals: unknown[]) => vals.some((v) => String(v ?? "").trim() && !(parseAmount(v) >= 0));

  async function finish(table: FinanceTable, values: Record<string, unknown>, rowId: string | undefined, msg: string) {
    const err = await fin.save(table, values, rowId);
    if (err) return err;
    toast(msg);
    onClose();
  }

  async function del(table: FinanceTable, rowId: string, question: string) {
    if (!confirm(question)) return;
    const err = await fin.remove(table, rowId);
    if (err) toast(err);
    else {
      toast("Deleted");
      onClose();
    }
  }

  switch (kind) {
    case "debt": {
      const d = fin.debts.find((x) => x.id === id);
      return (
        <FormSheet
          title={d ? "Edit debt" : "Add debt"}
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
            { kind: "text", key: "name", label: "Name", placeholder: "e.g. Furniture loan", required: true },
            { kind: "chips", key: "icon", label: "Icon", options: DEBT_ICONS.map((i) => ({ value: i, label: "", icon: iconFor(i) })) },
            { kind: "text", key: "lender", label: "Lender", placeholder: "e.g. Sparkasse" },
            { kind: "amount", key: "balance", label: "Still owed", placeholder: "0", required: true },
            { kind: "amount", key: "original", label: "Borrowed at the start", placeholder: "0" },
            { kind: "number", key: "rate", label: "Interest per year (%)", placeholder: "0" },
            { kind: "amount", key: "payment", label: "Paid each month", placeholder: "0", required: true },
            { kind: "chips", key: "member", label: "Whose debt", options: who },
            VISIBILITY,
          ]}
          onClose={onClose}
          onDelete={d ? () => del("debts", d.id, `Delete “${d.name}”?`) : undefined}
          onSave={(v) => {
            if (bad(v.balance, v.original, v.rate, v.payment)) return "Amounts must be numbers (0 or more).";
            if (num(v.rate) >= 100) return "Interest must be below 100%.";
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
              d ? "Saved" : "Debt added",
            );
          }}
        />
      );
    }

    case "sub": {
      const s = fin.subscriptions.find((x) => x.id === id);
      return (
        <FormSheet
          title={s ? "Edit subscription" : "Add subscription"}
          editing={!!s}
          initial={
            s
              ? { name: s.name, price: String(s.monthly_price), for: s.for_whom ?? "family", status: s.status, visibility: s.visibility }
              : { for: "family", status: "active", visibility: "family", ...preset }
          }
          fields={[
            { kind: "text", key: "name", label: "Name", placeholder: "e.g. Netflix", required: true },
            { kind: "amount", key: "price", label: "Price per month", placeholder: "0.00", required: true },
            { kind: "chips", key: "for", label: "For", options: who },
            {
              kind: "chips",
              key: "status",
              label: "Status",
              options: [
                { value: "active", label: "Still active" },
                { value: "cancelled", label: "Stopped" },
              ],
            },
            VISIBILITY,
          ]}
          onClose={onClose}
          onDelete={s ? () => del("subscriptions", s.id, `Delete “${s.name}”?`) : undefined}
          onSave={(v) => {
            if (bad(v.price)) return "Price must be a number.";
            return finish(
              "subscriptions",
              {
                name: String(v.name).trim(),
                monthly_price: num(v.price),
                for_whom: toId(v.for),
                status: v.status,
                cancelled_on: v.status === "cancelled" ? (s?.cancelled_on ?? new Date().toISOString().slice(0, 10)) : null,
                visibility: v.visibility,
              },
              s?.id,
              s ? "Saved" : "Subscription added",
            );
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
          title={r ? "Edit transfer" : "Log a transfer home"}
          editing={!!r}
          initial={init}
          fields={[
            { kind: "text", key: "to", label: "To", placeholder: "e.g. Mama", required: true },
            { kind: "amount", key: "eur", label: "Sent (EUR)", placeholder: "0", required: true },
            { kind: "amount", key: "fee", label: "Fee (EUR)", placeholder: "0" },
            { kind: "number", key: "rate", label: "Rate: 1 € = Rp", placeholder: String(fin.rate), required: true },
            {
              kind: "chips",
              key: "provider",
              label: "Sent with",
              options: ["Wise", "Bank (SWIFT)", "Western Union", "Other"].map((p) => ({ value: p, label: p })),
            },
            { kind: "text", key: "purpose", label: "Purpose", placeholder: "e.g. Monthly support" },
            { kind: "date", key: "date", label: "Date", required: true },
            VISIBILITY,
            { kind: "note", key: "n", label: "", text: "Rupiah received = (EUR − fee) × rate. It is saved with the transfer." },
          ]}
          onClose={onClose}
          onDelete={r ? () => del("remittances", r.id, `Delete this transfer to ${r.to_name}?`) : undefined}
          onSave={(v) => {
            const eur = parseAmount(v.eur);
            const rate = parseAmount(v.rate);
            const fee = num(v.fee);
            if (!(eur > 0)) return "Please enter the amount sent.";
            if (!(rate > 0)) return "Please enter the rate.";
            if (!(fee >= 0) || fee >= eur) return "The fee must be less than the amount.";
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
              r ? "Saved" : `Logged · ${rpFull(received(eur, fee, rate))} arrives`,
            );
          }}
        />
      );
    }

    case "business": {
      const b = fin.businesses.find((x) => x.id === id);
      return (
        <FormSheet
          title={b ? "Edit business" : "Add business"}
          editing={!!b}
          initial={
            b
              ? { name: b.name, member: b.member_id ?? "family", vat: b.vat_mode, visibility: b.visibility }
              : { member: userId, vat: "none", visibility: "family", ...preset }
          }
          fields={[
            { kind: "text", key: "name", label: "Name", required: true },
            { kind: "chips", key: "member", label: "Run by", options: who },
            {
              kind: "chips",
              key: "vat",
              label: "VAT (Umsatzsteuer)",
              options: [
                { value: "none", label: "None (Kleinunternehmer)" },
                { value: "quarterly", label: "Quarterly" },
                { value: "monthly", label: "Monthly" },
              ],
            },
            VISIBILITY,
          ]}
          onClose={onClose}
          onDelete={b ? () => del("businesses", b.id, `Delete “${b.name}” and all its months?`) : undefined}
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
              b ? "Saved" : "Business added",
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
          title={m ? "Edit month" : "Add a month"}
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
                    label: "Business",
                    required: true,
                    options: fin.businesses.map((b) => ({ value: b.id, label: b.name })),
                  } as Field,
                  { kind: "text", key: "month", label: "Month (YYYY-MM)", placeholder: defMonth, required: true } as Field,
                ]),
            { kind: "amount", key: "revenue", label: "Revenue", placeholder: "0", required: true },
            { kind: "amount", key: "costs", label: "Costs", placeholder: "0" },
            { kind: "amount", key: "tax", label: "Set aside for tax", placeholder: "0" },
            {
              kind: "file",
              key: "file",
              label: "Monthly report (PDF, CSV, Excel)",
              accept: ".pdf,.csv,.xls,.xlsx,application/pdf,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
              current: file?.name,
            },
            VISIBILITY,
          ]}
          onClose={onClose}
          onDelete={m ? () => del("business_months", m.id, `Delete ${m.month}?`) : undefined}
          onSave={async (v) => {
            if (bad(v.revenue, v.costs, v.tax)) return "Amounts must be numbers (0 or more).";
            if (!m && !/^\d{4}-(0[1-9]|1[0-2])$/.test(String(v.month).trim())) return "Month must look like 2026-09.";
            let fileId = m?.file_id ?? null;
            if (v.file instanceof File) {
              const up = await fin.upload(v.file, "business_report", String(v.visibility));
              if ("error" in up) return up.error;
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
              m ? "Saved" : "Month added",
            );
          }}
        />
      );
    }

    case "deadline": {
      const t = fin.taxDeadlines.find((x) => x.id === id);
      return (
        <FormSheet
          title={t ? "Edit deadline" : "Add tax deadline"}
          editing={!!t}
          initial={
            t
              ? { title: t.title, date: t.due_date, amount: t.amount == null ? "" : String(t.amount), kind: t.kind, visibility: t.visibility }
              : { kind: "other", visibility: "family", ...preset }
          }
          fields={[
            { kind: "text", key: "title", label: "What", placeholder: "e.g. Income tax prepayment Q4", required: true },
            { kind: "date", key: "date", label: "Due", required: true },
            { kind: "amount", key: "amount", label: "Amount (optional)", placeholder: "0" },
            {
              kind: "chips",
              key: "kind",
              label: "Kind",
              options: [
                { value: "prepayment", label: "Prepayment" },
                { value: "return", label: "Tax return" },
                { value: "vat", label: "VAT" },
                { value: "other", label: "Other" },
              ],
            },
            VISIBILITY,
          ]}
          onClose={onClose}
          onDelete={t ? () => del("tax_deadlines", t.id, `Delete “${t.title}”?`) : undefined}
          onSave={(v) => {
            if (bad(v.amount)) return "Amount must be a number.";
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
              t ? "Saved" : "Deadline added",
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
          title={d ? "Edit deduction" : "Add deduction"}
          editing={!!d}
          initial={
            d
              ? { title: d.title, amount: String(d.amount), collected: d.collected, visibility: d.visibility }
              : { collected: false, visibility: "family", ...preset }
          }
          fields={[
            { kind: "text", key: "title", label: "What", placeholder: "e.g. Work laptop, commute, donations", required: true },
            { kind: "amount", key: "amount", label: "Amount", placeholder: "0" },
            { kind: "toggle", key: "collected", label: "Proof", toggleLabel: "Receipts are collected" },
            VISIBILITY,
          ]}
          onClose={onClose}
          onDelete={d ? () => del("tax_deductions", d.id, `Delete “${d.title}”?`) : undefined}
          onSave={(v) => {
            if (bad(v.amount)) return "Amount must be a number.";
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
              d ? "Saved" : "Deduction added",
            );
          }}
        />
      );
    }

    case "asset": {
      const a = fin.assets.find((x) => x.id === id);
      return (
        <FormSheet
          title={a ? "Update value" : "Add savings or investment"}
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
            { kind: "text", key: "name", label: "Name", placeholder: "e.g. ETF savings plan", required: true },
            { kind: "chips", key: "icon", label: "Icon", options: [...new Set([...ASSET_ICONS, ...GOAL_ICONS])].slice(0, 10).map((i) => ({ value: i, label: "", icon: iconFor(i) })) },
            { kind: "text", key: "location", label: "Where", placeholder: "e.g. Trade Republic · FTSE All-World" },
            {
              kind: "chips",
              key: "currency",
              label: "Currency",
              options: [
                { value: "EUR", label: "Euro" },
                { value: "IDR", label: "Rupiah" },
              ],
            },
            { kind: "number", key: "value", label: "Value today (in that currency)", placeholder: "0", required: true },
            { kind: "text", key: "note", label: "Note (optional)", placeholder: "e.g. can sell within 2 days" },
            VISIBILITY,
          ]}
          onClose={onClose}
          onDelete={a ? () => del("assets", a.id, `Delete “${a.name}”?`) : undefined}
          onSave={(v) => {
            if (bad(v.value)) return "Value must be a number.";
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
              a ? "Saved" : "Added",
            );
          }}
        />
      );
    }
  }
}
