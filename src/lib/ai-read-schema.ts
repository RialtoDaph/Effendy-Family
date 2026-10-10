// What Claude returns when it reads a receipt or a PDF statement. Shared by
// the server route (as JSON schema) and the app (as types).

export type ReceiptResult = {
  merchant: string;
  date: string | null; // YYYY-MM-DD
  total: number; // positive, what was paid
  currency: string;
  category: string | null; // one of the household's category names
  items: { name: string; amount: number }[];
  confidence: "high" | "medium" | "low";
};

export type StatementResult = {
  bank: string | null;
  currency: string;
  transactions: { date: string; amount: number; payee: string; purpose: string }[];
  warnings: string[];
};

export const RECEIPT_PROMPT = `You read shop receipts for a family budget app in Germany.
Return the shop name as people say it (e.g. "Rewe", "dm", "Trattoria Roma"), the purchase date, and the total actually paid (after discounts, including tax).
List the items with their prices as printed; leave the list empty if they are unreadable.
Pick the category from the list given by the user that fits the whole purchase best, or null if none fits.
Set confidence to "low" when the total or date is hard to read.`;

export const STATEMENT_PROMPT = `You read bank and card statements (German, English or Indonesian) for a family budget app.
Return every booked transaction exactly once, in the order printed. Skip opening and closing balances, subtotals, and pending or reserved amounts.
amount is negative for money going out and positive for money coming in, in the statement's currency.
payee is the other party (shop, person or company) without card numbers or reference codes; purpose is the rest of the booking text, shortened.
Dates are YYYY-MM-DD; when the statement prints a date without a year, take the year from the statement period.
Add a short warning for anything you could not read reliably.`;

const str = { type: "string" } as const;
const num = { type: "number" } as const;

export function receiptSchema(categoryNames: string[]) {
  return {
    type: "object",
    additionalProperties: false,
    required: ["merchant", "date", "total", "currency", "category", "items", "confidence"],
    properties: {
      merchant: str,
      date: { type: ["string", "null"], description: "YYYY-MM-DD" },
      total: num,
      currency: { ...str, description: "ISO code, e.g. EUR" },
      category: categoryNames.length ? { anyOf: [{ type: "string", enum: categoryNames }, { type: "null" }] } : { type: "null" },
      items: {
        type: "array",
        items: { type: "object", additionalProperties: false, required: ["name", "amount"], properties: { name: str, amount: num } },
      },
      confidence: { type: "string", enum: ["high", "medium", "low"] },
    },
  };
}

export function statementSchema() {
  return {
    type: "object",
    additionalProperties: false,
    required: ["bank", "currency", "transactions", "warnings"],
    properties: {
      bank: { type: ["string", "null"] },
      currency: { ...str, description: "ISO code of the account, e.g. EUR or IDR" },
      transactions: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["date", "amount", "payee", "purpose"],
          properties: { date: { ...str, description: "YYYY-MM-DD" }, amount: num, payee: str, purpose: str },
        },
      },
      warnings: { type: "array", items: str },
    },
  };
}
