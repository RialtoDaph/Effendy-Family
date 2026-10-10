// Bank CSV import (README → Bank import): detect delimiter and encoding, map
// the columns once per bank, read every row into date / amount / payee /
// purpose, fingerprint rows so nothing is imported twice, and suggest a
// category (your own rules and past choices first, then known shop names).

export const BANKS = [
  { id: "sparkasse", name: "Sparkasse", currency: "EUR" },
  { id: "tfbank", name: "TF Bank", currency: "EUR" },
  { id: "revolut", name: "Revolut", currency: "EUR" },
  { id: "bca", name: "BCA", currency: "IDR" },
  { id: "paypal", name: "PayPal", currency: "EUR" },
  { id: "wise", name: "Wise", currency: "EUR" },
  { id: "other", name: "Other bank", currency: "EUR" },
] as const;
export type BankId = (typeof BANKS)[number]["id"];

export type DateOrder = "dmy" | "mdy" | "ymd";
export type Decimal = "," | ".";

export type Mapping = {
  delimiter: string;
  headerRow: number; // index of the header line (rows before it are skipped)
  date: number;
  amount: number; // signed amount, or "money out" when `credit` is set
  credit?: number; // "money in" column for banks with two amount columns
  fee?: number; // subtracted from the amount (Revolut, PayPal)
  payee: number;
  payeeAlt?: number[]; // used when the payee cell is empty (Wise: Merchant, Description)
  purpose?: number;
  status?: number; // rows that are pending / declined are skipped
  currency?: number; // column with the currency code
  defaultCurrency: string; // when there is no currency column
  dateOrder: DateOrder;
  decimal: Decimal;
};

export type ParsedRow = {
  line: number;
  date: string; // YYYY-MM-DD
  amount: number; // in the row's currency, negative = money out
  currency: string;
  payee: string;
  purpose: string;
};

export type Skipped = { line: number; reason: string };

/* Reading the file -------------------------------------------------------- */

/** UTF-8 if it is valid UTF-8, otherwise Windows-1252 (a superset of ISO-8859-1). */
export function decode(buf: ArrayBuffer | Uint8Array) {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    text = new TextDecoder("windows-1252").decode(bytes);
  }
  return text.replace(/^﻿/, "");
}

/** Splits CSV text into rows of cells (quotes, doubled quotes, line breaks in quotes). */
export function parseCsv(text: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else quoted = false;
      } else cell += ch;
    } else if (ch === '"' && cell.trim() === "") {
      quoted = true;
      cell = "";
    } else if (ch === delimiter) {
      row.push(cell.trim());
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell.trim());
      rows.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  if (cell !== "" || row.length) {
    row.push(cell.trim());
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c !== ""));
}

/** The delimiter that gives the most rows with the same, larger-than-one cell count. */
export function detectDelimiter(text: string) {
  const sample = text.split(/\r?\n/).slice(0, 40).join("\n");
  let best = { d: ",", score: -1 };
  for (const d of [";", ",", "\t", "|"]) {
    const counts = parseCsv(sample, d).map((r) => r.length);
    const freq = new Map<number, number>();
    for (const c of counts) if (c > 1) freq.set(c, (freq.get(c) ?? 0) + 1);
    const top = Math.max(0, ...[...freq.entries()].map(([cols, n]) => n * Math.min(cols, 12)));
    if (top > best.score) best = { d, score: top };
  }
  return best.d;
}

/* Guessing the columns ---------------------------------------------------- */

const HEADS: Record<"date" | "amount" | "credit" | "fee" | "payee" | "purpose" | "status" | "currency", RegExp[]> = {
  date: [/^buchungstag$/, /^buchungsdatum$/, /^completed date$/, /^date$/, /^datum$/, /^tanggal/, /^transaction date$/, /^booking date$/, /^started date$/, /^valuta/, /date/, /datum/],
  amount: [/^betrag/, /^amount$/, /^netto$/, /^net$/, /^jumlah$/, /^umsatz/, /^soll$/, /^debit$/, /^ausgang/, /amount/, /betrag/],
  credit: [/^haben$/, /^credit$/, /^eingang/],
  fee: [/^fee$/, /^gebühr$/, /^gebuehr$/, /^fees$/],
  payee: [
    /^beguenstigter\/zahlungspflichtiger$/,
    /^begünstigter\/zahlungspflichtiger$/,
    /^name zahlungsbeteiligter$/,
    /^zahlungsempfänger$/,
    /^payee name$/,
    /^merchant$/,
    /^name$/,
    /^description$/,
    /^beschreibung$/,
    /^empfänger/,
    /^payee/,
    /^keterangan$/,
    /name|empf|payee|merchant/,
  ],
  purpose: [
    /^verwendungszweck$/,
    /^payment reference$/,
    /^reference$/,
    /^buchungstext$/,
    /^betreff$/,
    /^description$/,
    /^keterangan$/,
    /zweck|reference|referenz/,
    /^typ$/,
    /^type$/,
  ],
  status: [/^state$/, /^status$/, /^info$/],
  currency: [/^currency$/, /^währung$/, /^waehrung$/, /^wahrung$/, /^mata uang$/],
};

const norm = (s: string) => s.toLowerCase().replace(/["']/g, "").trim();
/** Excel marks text cells with a leading apostrophe (BCA does this). */
const unquote = (s: string) => s.replace(/^'/, "").trim();

function findCol(header: string[], key: keyof typeof HEADS, taken: Set<number>) {
  const h = header.map(norm);
  for (const re of HEADS[key]) {
    const i = h.findIndex((c, idx) => !taken.has(idx) && re.test(c));
    if (i >= 0) return i;
  }
  return -1;
}

/** The first row that looks like a header: has a date-like and an amount-like name. */
export function findHeaderRow(rows: string[][]) {
  for (let i = 0; i < Math.min(rows.length, 30); i++) {
    const taken = new Set<number>();
    if (rows[i].length > 1 && findCol(rows[i], "date", taken) >= 0 && findCol(rows[i], "amount", taken) >= 0) return i;
  }
  return 0;
}

const DATE_RE = /^(\d{1,4})[./-](\d{1,2})(?:[./-](\d{2,4}))?/;

/** Day-first unless the values prove otherwise. */
export function guessDateOrder(values: string[]): DateOrder {
  let dayFirst = false;
  let monthFirst = false;
  for (const v of values) {
    const m = v.trim().match(DATE_RE);
    if (!m) continue;
    if (m[1].length === 4) return "ymd";
    if (+m[1] > 12) dayFirst = true;
    if (+m[2] > 12) monthFirst = true;
  }
  return monthFirst && !dayFirst ? "mdy" : "dmy";
}

/** "," when values end in ",dd" (German style), otherwise ".". */
export function guessDecimal(values: string[]): Decimal {
  let comma = 0;
  let dot = 0;
  for (const v of values) {
    const s = v.replace(/[^\d.,]/g, "");
    if (/,\d{1,2}$/.test(s)) comma++;
    else if (/\.\d{1,2}$/.test(s)) dot++;
    else if (/\.\d{3}$/.test(s) && !s.includes(",")) comma++; // 1.234 = thousands with a dot
  }
  return comma > dot ? "," : ".";
}

/** A first guess at the columns. The person checks it once per bank. */
export function guessMapping(text: string, bank: BankId): Mapping {
  const delimiter = detectDelimiter(text);
  const rows = parseCsv(text, delimiter);
  const headerRow = findHeaderRow(rows);
  const header = rows[headerRow] ?? [];
  const taken = new Set<number>();
  const pick = (k: keyof typeof HEADS) => {
    const i = findCol(header, k, taken);
    if (i >= 0) taken.add(i);
    return i;
  };
  // Order matters: specific columns first so "description" is not used twice.
  const date = pick("date");
  const amount = pick("amount");
  const credit = pick("credit");
  const fee = pick("fee");
  const status = pick("status");
  const currency = pick("currency");
  const payee = pick("payee");
  const purpose = pick("purpose");
  const payeeAlt: number[] = [];
  for (const re of HEADS.payee) {
    header.forEach((c, i) => {
      if (!taken.has(i) && !payeeAlt.includes(i) && !/mail|konto|account|iban/.test(norm(c)) && re.test(norm(c))) payeeAlt.push(i);
    });
  }
  const body = rows.slice(headerRow + 1, headerRow + 60);
  const def = BANKS.find((b) => b.id === bank)?.currency ?? "EUR";
  return {
    delimiter,
    headerRow,
    date: Math.max(date, 0),
    amount: Math.max(amount, 0),
    credit: credit >= 0 ? credit : undefined,
    fee: fee >= 0 ? fee : undefined,
    payee: payee >= 0 ? payee : Math.max(purpose, 0),
    payeeAlt: payeeAlt.length ? payeeAlt : undefined,
    purpose: purpose >= 0 && purpose !== payee ? purpose : undefined,
    status: status >= 0 ? status : undefined,
    currency: currency >= 0 ? currency : undefined,
    defaultCurrency: def,
    dateOrder: guessDateOrder(body.map((r) => unquote(r[Math.max(date, 0)] ?? ""))),
    decimal: guessDecimal(body.map((r) => unquote(r[Math.max(amount, 0)] ?? ""))),
  };
}

/* Reading values ---------------------------------------------------------- */

/** "-1.234,56", "1,234.56 DB", "€ 12,50", "12.50-", "(12.50)" → number, or null. */
export function parseAmount(raw: string, decimal: Decimal): number | null {
  let s = raw.trim();
  if (!s) return null;
  let sign = 1;
  if (/\bDB\b|\bD\b$/i.test(s)) sign = -1; // BCA: DB = debit
  s = s.replace(/\b(DB|CR|D|K)\b/gi, "");
  if (/^\(.*\)$/.test(s)) {
    sign = -sign;
    s = s.slice(1, -1);
  }
  if (/-\s*$/.test(s)) {
    sign = -sign;
    s = s.replace(/-\s*$/, "");
  }
  if (/[-−–](?=\s*[\d.,])/.test(s)) sign = -sign;
  s = s.replace(/[^\d.,]/g, "");
  if (!/\d/.test(s)) return null;
  if (decimal === ",") s = s.replace(/\./g, "").replace(",", ".");
  else s = s.replace(/,/g, "");
  const n = Number(s);
  return Number.isFinite(n) ? sign * Math.round(n * 100) / 100 : null;
}

/** A date in the given order → YYYY-MM-DD, or null. Two-digit years are 20xx. */
export function parseDate(raw: string, order: DateOrder, fallbackYear?: number): string | null {
  const m = raw.trim().match(DATE_RE);
  if (!m) return null;
  let [y, mo, d]: number[] = [];
  if (order === "ymd" || m[1].length === 4) [y, mo, d] = [+m[1], +m[2], +(m[3] ?? 0)];
  else if (order === "mdy") [mo, d, y] = [+m[1], +m[2], m[3] ? +m[3] : fallbackYear ?? NaN];
  else [d, mo, y] = [+m[1], +m[2], m[3] ? +m[3] : fallbackYear ?? NaN];
  if (y < 100) y += 2000;
  if (!y || !mo || !d || mo > 12 || d > 31) return null;
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCMonth() !== mo - 1) return null;
  return `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

const SKIP_STATUS = /pending|revert|declin|fail|cancel|ausstehend|storniert|abgelehnt|offen|vorgemerkt/i;

/** A year written somewhere above the table (BCA: "Periode : 01/01/2026 - 31/01/2026"). */
function yearAbove(rows: string[][], headerRow: number) {
  for (let i = headerRow - 1; i >= 0; i--) {
    const m = rows[i].join(" ").match(/\b(20\d{2})\b/);
    if (m) return +m[1];
  }
  return undefined;
}

export function readRows(text: string, map: Mapping): { rows: ParsedRow[]; skipped: Skipped[] } {
  const all = parseCsv(text, map.delimiter);
  const year = yearAbove(all, map.headerRow);
  const rows: ParsedRow[] = [];
  const skipped: Skipped[] = [];
  for (let i = map.headerRow + 1; i < all.length; i++) {
    const r = all[i];
    const line = i + 1;
    const cell = (c?: number) => (c == null ? "" : unquote(r[c] ?? ""));
    if (r.length < 2) continue;
    if (map.status != null && SKIP_STATUS.test(cell(map.status))) {
      skipped.push({ line, reason: `Not booked yet (${cell(map.status)})` });
      continue;
    }
    const date = parseDate(cell(map.date), map.dateOrder, year);
    if (!date) {
      // Totals or notes below the table are not transactions.
      if (cell(map.date)) skipped.push({ line, reason: `No date (“${cell(map.date).slice(0, 20)}”)` });
      continue;
    }
    let amount: number | null;
    if (map.credit != null) {
      const out = parseAmount(cell(map.amount), map.decimal);
      const inn = parseAmount(cell(map.credit), map.decimal);
      amount = out == null && inn == null ? null : (inn ?? 0) - Math.abs(out ?? 0);
    } else {
      // BCA puts DB / CR in the unnamed column right after the amount.
      const side = cell(map.amount + 1);
      amount = parseAmount(`${cell(map.amount)}${/^(DB|CR)$/i.test(side) ? ` ${side}` : ""}`, map.decimal);
    }
    const fee = map.fee != null ? parseAmount(cell(map.fee), map.decimal) : null;
    if (amount != null && fee) amount = Math.round((amount - Math.abs(fee)) * 100) / 100;
    if (amount == null || amount === 0) {
      skipped.push({ line, reason: "No amount" });
      continue;
    }
    const payee =
      [map.payee, ...(map.payeeAlt ?? []), map.purpose].map((c) => cleanPayee(cell(c))).find(Boolean) ?? "Unknown";
    const purpose = map.purpose != null && map.purpose !== map.payee ? cell(map.purpose) : "";
    const currency = (cell(map.currency) || map.defaultCurrency).toUpperCase().slice(0, 3);
    rows.push({ line, date, amount, currency, payee, purpose: purpose.replace(/\s+/g, " ").slice(0, 300) });
  }
  return { rows, skipped };
}

function cleanPayee(s: string) {
  return s
    .replace(/\s+/g, " ")
    .replace(/^(kartenzahlung|lastschrift|überweisung|ueberweisung|sepa[- ]?\w*|visa|mastercard)\s*[:/-]?\s*/i, "")
    .trim()
    .slice(0, 80);
}

/* Duplicates -------------------------------------------------------------- */

/**
 * README: a hash of date + amount + payee + purpose. Identical rows in one
 * file (two coffees on the same day) get a running number so both are kept,
 * and importing the same file again finds them all as already imported.
 */
export async function rowHashes(bank: string, rows: ParsedRow[]) {
  const seen = new Map<string, number>();
  const out: string[] = [];
  for (const r of rows) {
    const base = [bank, r.date, Math.round(r.amount * 100), r.currency, r.payee.toLowerCase(), r.purpose.toLowerCase()].join("|");
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${base}#${n}`));
    out.push(
      Array.from(new Uint8Array(bytes))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join(""),
    );
  }
  return out;
}

/* Categories -------------------------------------------------------------- */

/** "REWE Markt GmbH 12345 Eichstaett" → "rewe markt gmbh". */
export function merchantKey(payee: string) {
  return payee
    .toLowerCase()
    .replace(/^(paypal|sumup|sq|zettle|izettle)\s*\*\s*/i, "")
    .replace(/[^a-zäöüß&+ ]+/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .slice(0, 3)
    .join(" ");
}

// Known shop names → one of the sample category names.
const KEYWORDS: [RegExp, string][] = [
  [/\b(rewe|edeka|aldi|lidl|netto|penny|kaufland|norma|tegut|globus|dm[- ]drogerie|rossmann|müller drogerie|alnatura|denns|indomaret|alfamart|superindo)\b/i, "Groceries"],
  [/\b(amazon|amzn|zalando|otto|ebay|temu|shein|aliexpress|mediamarkt|saturn|ikea|tokopedia|shopee)\b/i, "Online shopping"],
  [/\b(restaurant|ristorante|trattoria|pizzeria|cafe|café|bäckerei|baeckerei|backhaus|mcdonald|burger king|kfc|subway|lieferando|wolt|uber \*?eats|döner|doener|imbiss|starbucks|gofood|grabfood)\b/i, "Eating out"],
  [/\b(db vertrieb|deutsche bahn|bahn|mvv|vgn|flixbus|aral|shell|esso|totalenergies|jet|tankstelle|uber|bolt|sixt|parkhaus|parken|deutschlandticket|gojek|grab)\b/i, "Transport"],
  [/\b(netflix|spotify|disney|dazn|youtube|prime video|wow|sky deutschland|crunchyroll|audible)\b/i, "Streaming"],
  [/\b(miete|stadtwerke|strom|e\.on|eon|vattenfall|telekom|vodafone|o2|1&1|rundfunk|beitragsservice|wohnbau|nebenkosten|pln)\b/i, "Rent & utilities"],
  [/\b(versicherung|allianz|huk|techniker|tk|aok|barmer|dak|apotheke|arzt|zahnarzt|haftpflicht|ergo|bpjs)\b/i, "Insurance & health"],
  [/\b(adobe|google|canva|notion|github|microsoft|figma|ionos|strato|openai|anthropic|squarespace|wix|shopify)\b/i, "Business tools"],
  [/\b(tabak|lotto|kiosk|getränke|getraenke|späti|spaeti)\b/i, "Tobacco & drinks"],
  [/\b(douglas|h&m|primark|friseur|thalia|hugendubel|tk maxx|deichmann)\b/i, "Personal & gifts"],
];

// Money moving between your own accounts is not spending (the card bill, a top-up).
const TRANSFER =
  /\b(tf bank|revolut|wise|transferwise|paypal|kreditkarte|credit card|übertrag|uebertrag|umbuchung|top[- ]?up|topup|aufladung|bankgutschrift|general card deposit|allgemeine abbuchung|einzahlung|withdrawal|abhebung|geldautomat|atm)\b/i;

export type Cat = { id: string; name: string };
export type Suggestion = { categoryId: string | null; confidence: "rule" | "past" | "name" | "none"; options: string[]; transfer: boolean };

export function suggestCategory(
  row: Pick<ParsedRow, "payee" | "purpose" | "amount">,
  cats: Cat[],
  rules: Map<string, string>, // merchantKey → category id
  past: Map<string, string>, // merchantKey → category id from earlier transactions
  popular: string[], // category ids, most used first
  bank?: string,
): Suggestion {
  const key = merchantKey(row.payee);
  const text = `${row.payee} ${row.purpose}`;
  // "Between your accounts" means another of your banks is named, not this one.
  const own = bank?.replace(/[^a-z ]/gi, "").trim();
  const transfer = TRANSFER.test(own ? text.replace(new RegExp(`\\b${own}\\b`, "gi"), "") : text);
  const options = popular.slice(0, 3);
  if (row.amount > 0) return { categoryId: null, confidence: "none", options: [], transfer };
  const ruled = rules.get(key) ?? rules.get(key.split(" ")[0]);
  if (ruled && cats.some((c) => c.id === ruled)) return { categoryId: ruled, confidence: "rule", options, transfer };
  const before = past.get(key);
  if (before && cats.some((c) => c.id === before)) return { categoryId: before, confidence: "past", options, transfer };
  for (const [re, name] of KEYWORDS) {
    if (re.test(text)) {
      const cat = cats.find((c) => c.name.toLowerCase() === name.toLowerCase());
      if (cat) return { categoryId: cat.id, confidence: "name", options, transfer };
    }
  }
  return { categoryId: null, confidence: "none", options, transfer };
}

/** EUR amount for budget totals. IDR uses the saved rate; other currencies are not converted. */
export function toEur(amount: number, currency: string, idrPerEur: number) {
  if (currency === "EUR") return amount;
  if (currency === "IDR") return Math.round((amount / idrPerEur) * 100) / 100;
  return null;
}
