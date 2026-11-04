"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { FileUp } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { useAppData } from "@/components/app-data";
import { useFinance } from "@/components/finance-data";
import { useMoney } from "@/components/money-data";
import { useOnline } from "@/components/pwa";
import { useToast } from "@/components/toast";
import { Card, H2, Segmented } from "@/components/ui";
import {
  BANKS,
  decode,
  guessMapping,
  merchantKey,
  parseCsv,
  readRows,
  rowHashes,
  suggestCategory,
  toEur,
  type BankId,
  type Mapping,
  type ParsedRow,
  type Skipped,
  type Suggestion,
} from "@/lib/bank-import";
import { readStatement } from "@/lib/ai-read";
import { eur } from "@/lib/money";
import { useDates } from "@/lib/use-dates";
import { supabase } from "@/lib/supabase";
import { ModuleHeader } from "./module-tabs";

type Step = "pick" | "columns" | "check" | "done";

type Item = {
  row: ParsedRow;
  hash: string;
  eur: number | null;
  suggestion: Suggestion;
  categoryId: string | null;
  include: boolean;
  dup: boolean;
};

const primaryBtn = "min-h-12 rounded-full border-0 bg-acc px-5 text-sm font-bold text-onacc disabled:opacity-50";
const secondaryBtn = "min-h-11 rounded-full border border-line bg-card px-4 text-[13.5px] font-bold text-ink";
const selectCls = "min-h-11 w-full rounded-[10px] border border-line bg-card px-3 text-[14px] text-ink";

const chunk = <T,>(a: T[], n: number) => Array.from({ length: Math.ceil(a.length / n) }, (_, i) => a.slice(i * n, i * n + n));

export function BankImportScreen() {
  const tm = useTranslations("money");
  const { userId, settings } = useAppData();
  const money = useMoney();
  const { rate } = useFinance();
  const toast = useToast();
  const online = useOnline();

  const [step, setStep] = useState<Step>("pick");
  const [bank, setBank] = useState<BankId>("sparkasse");
  const [visibility, setVisibility] = useState<"family" | "private">(
    settings?.default_visibility?.transactions === "private" ? "private" : "family",
  );
  const [paidBy, setPaidBy] = useState<"me" | "family">("me");
  const [fileName, setFileName] = useState("");
  const [text, setText] = useState("");
  const [mapping, setMapping] = useState<Mapping | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [skipped, setSkipped] = useState<Skipped[]>([]);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ added: number; dup: number } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const nameOf = (b: (typeof BANKS)[number]) => (b.id === "other" ? tm("other_bank") : b.name);
  const bankName = nameOf(BANKS.find((b) => b.id === bank)!);

  async function onFile(f: File) {
    setFileName(f.name);
    setText("");
    if (f.type === "application/pdf" || /\.pdf$/i.test(f.name)) return readPdf(f);
    if (f.size > 5 * 1024 * 1024) return toast(tm("that_file_is_larger_than_5_mb"));
    const t = decode(await f.arrayBuffer());
    setText(t);
    setBusy(true);
    const { data } = await supabase().from("import_mappings").select("mapping").eq("bank", bank).maybeSingle();
    setBusy(false);
    const saved = data?.mapping as Mapping | undefined;
    if (saved && readRows(t, saved).rows.length > 0) {
      setMapping(saved);
      await prepare(t, saved);
    } else {
      setMapping(guessMapping(t, bank));
      setStep("columns");
    }
  }

  async function saveMapping(m: Mapping) {
    const sb = supabase();
    const { data } = await sb.from("import_mappings").update({ mapping: m, updated_at: new Date().toISOString() }).eq("bank", bank).select("id");
    if (!data?.length) await sb.from("import_mappings").insert({ bank, mapping: m });
  }

  /** PDF: Claude reads the statement on the server; you check every row as with CSV. */
  async function readPdf(f: File) {
    if (f.size > 4 * 1024 * 1024) return toast(tm("that_pdf_is_larger_than_4_mb_download_a_sh"));
    setBusy(true);
    const read = await readStatement(new File([f], f.name, { type: "application/pdf" }));
    if (read.error !== undefined) {
      setBusy(false);
      return toast(read.error);
    }
    const st = read.result;
    const currency = (st.currency || BANKS.find((b) => b.id === bank)!.currency).toUpperCase().slice(0, 3);
    const rows: ParsedRow[] = [];
    const sk: Skipped[] = [];
    st.transactions.forEach((t, i) => {
      const ok = /^\d{4}-\d{2}-\d{2}$/.test(t.date) && Number.isFinite(t.amount) && t.amount !== 0;
      if (!ok) sk.push({ line: i + 1, reason: tm("could_not_read", { v: t.payee || t.date }) });
      else
        rows.push({
          line: i + 1,
          date: t.date,
          amount: Math.round(t.amount * 100) / 100,
          currency,
          payee: t.payee.trim().slice(0, 80) || tm("unknown"),
          purpose: t.purpose.replace(/\s+/g, " ").trim().slice(0, 300),
        });
    });
    for (const w of st.warnings) sk.push({ line: 0, reason: tm("ai_note", { w: w }) });
    await prepareRows(rows, sk);
  }

  /** Reads all rows, finds what is already imported and suggests categories. */
  async function prepare(t: string, m: Mapping) {
    const { rows, skipped: sk } = readRows(t, m);
    await prepareRows(rows, sk);
  }

  async function prepareRows(rows: ParsedRow[], sk: Skipped[]) {
    setBusy(true);
    try {
      const sb = supabase();
      const hashes = await rowHashes(bank, rows);
      const existing = new Set<string>();
      for (const part of chunk(hashes, 150)) {
        const { data, error } = await sb.from("transactions").select("import_hash").in("import_hash", part);
        if (error) throw error;
        for (const d of data ?? []) existing.add(d.import_hash as string);
      }
      const [{ data: ruleRows }, { data: pastRows }] = await Promise.all([
        sb.from("merchant_rules").select("pattern,category_id"),
        sb.from("transactions").select("payee,category_id").not("category_id", "is", null).order("date", { ascending: false }).limit(1500),
      ]);
      const rules = new Map((ruleRows ?? []).map((r) => [r.pattern as string, r.category_id as string]));
      const past = new Map<string, string>();
      const counts = new Map<string, number>();
      for (const p of pastRows ?? []) {
        const k = merchantKey(p.payee as string);
        if (!past.has(k)) past.set(k, p.category_id as string);
        counts.set(p.category_id as string, (counts.get(p.category_id as string) ?? 0) + 1);
      }
      const flexFirst = [...money.categories].sort((a, b) => Number(a.is_fixed) - Number(b.is_fixed) || a.sort - b.sort);
      const popular = [
        ...[...counts.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id),
        ...flexFirst.map((c) => c.id),
      ].filter((id, i, a) => a.indexOf(id) === i && money.categories.some((c) => c.id === id));

      setItems(
        rows.map((row, i) => {
          const suggestion = suggestCategory(row, money.categories, rules, past, popular, bankName);
          const eurAmount = toEur(row.amount, row.currency, rate);
          const dup = existing.has(hashes[i]);
          return {
            row,
            hash: hashes[i],
            eur: eurAmount,
            suggestion,
            categoryId: suggestion.categoryId,
            dup,
            include: !dup && !suggestion.transfer && eurAmount != null && eurAmount !== 0,
          };
        }),
      );
      setSkipped(sk);
      setStep("check");
    } catch {
      toast(navigator.onLine ? tm("could_not_read_that_file") : tm("importing_needs_the_internet"));
    } finally {
      setBusy(false);
    }
  }

  async function importNow() {
    const chosen = items.filter((x) => x.include && !x.dup && x.eur != null);
    if (!chosen.length) return;
    setBusy(true);
    const sb = supabase();
    try {
      const values = chosen.map((x) => ({
        id: crypto.randomUUID(),
        date: x.row.date,
        amount: x.eur,
        payee: x.row.payee,
        category_id: x.eur! < 0 ? x.categoryId : null,
        paid_by: paidBy === "me" ? userId : null,
        visibility,
        source: "import",
        import_hash: x.hash,
        note:
          [x.row.purpose, x.row.currency === "IDR" ? tm("rp_at_rp", { toLocaleString: Math.abs(x.row.amount).toLocaleString("id-ID"), toLocaleString2: rate.toLocaleString("id-ID") }) : ""]
            .filter(Boolean)
            .join(" · ")
            .slice(0, 500) || null,
      }));
      let added = 0;
      for (const part of chunk(values, 200)) {
        const { data, error } = await sb
          .from("transactions")
          .upsert(part, { onConflict: "household_id,import_hash", ignoreDuplicates: true })
          .select("id");
        if (error) throw error;
        added += data?.length ?? 0;
      }
      // Learn from the categories you picked yourself.
      const learned = new Map<string, string>();
      for (const x of chosen) {
        if (x.eur! < 0 && x.categoryId && x.categoryId !== x.suggestion.categoryId) learned.set(merchantKey(x.row.payee), x.categoryId);
      }
      for (const [pattern, category_id] of learned) {
        if (!pattern) continue;
        const { data } = await sb.from("merchant_rules").update({ category_id, updated_at: new Date().toISOString() }).eq("pattern", pattern).select("id");
        if (!data?.length) await sb.from("merchant_rules").insert({ pattern, category_id });
      }
      setResult({ added, dup: chosen.length - added });
      setStep("done");
      toast(tm("tx_imported", { n: added }));
      await money.reload();
    } catch {
      toast(navigator.onLine ? tm("could_not_import_nothing_was_half_saved_tw") : tm("importing_needs_the_internet"));
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setStep("pick");
    setItems([]);
    setSkipped([]);
    setText("");
    setFileName("");
    setResult(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  return (
    <>
      <ModuleHeader module="money" active="import" />

      <div className="flex flex-wrap gap-1.5">
        {[tm("step_upload"), tm("step_check"), tm("step_done")].map((l, i) => {
          const at = step === "pick" ? 0 : step === "done" ? 2 : 1;
          return (
            <span key={l} className={`flex items-center gap-2 rounded-full py-1.5 pl-1.5 pr-3 text-[12.5px] font-bold ${i === at ? "bg-card" : ""} ${i <= at ? "text-ink" : "text-mut2"}`}>
              <span className={`flex h-[22px] w-[22px] items-center justify-center rounded-full text-[11px] font-bold ${i <= at ? "bg-acc text-onacc" : "bg-soft2 text-mut"}`}>
                {i < at ? "✓" : i + 1}
              </span>
              {l}
            </span>
          );
        })}
      </div>

      {step === "pick" && (
        <div className="grid items-start gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(100%,300px),1fr))]">
          <Card className="flex flex-col gap-4">
            <div>
              <H2 className="mb-1">{tm("which_account")}</H2>
              <div className="text-[13px] text-mut">{tm.rich("import_intro", { b: (chunks) => <b>{chunks}</b> })}</div>
            </div>
            <div className="flex flex-col gap-2">
              {BANKS.map((b) => (
                <button
                  key={b.id}
                  onClick={() => setBank(b.id)}
                  aria-pressed={bank === b.id}
                  className={`flex items-center gap-3 rounded-[10px] border-2 bg-card p-3.5 text-left ${bank === b.id ? "border-acc" : "border-line"}`}
                >
                  <span className="flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-soft2 text-sm font-bold text-ink">{nameOf(b)[0]}</span>
                  <span className="text-[14.5px] font-bold text-ink">{nameOf(b)}</span>
                </button>
              ))}
            </div>
            {bank === "bca" && <div className="text-xs text-mut">{tm("rupiah_are_changed_to_euro_at_your_saved_r", { toLocaleString: rate.toLocaleString("id-ID") })}</div>}
            <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(100%,160px),1fr))]">
              <div>
                <div className="mb-2 text-[12.5px] font-bold text-mut">{tm("visible_to")}</div>
                <Segmented
                  options={[
                    { value: "family", label: tm("family") },
                    { value: "private", label: tm("only_me") },
                  ]}
                  value={visibility}
                  onChange={setVisibility}
                />
              </div>
              <div>
                <div className="mb-2 text-[12.5px] font-bold text-mut">{tm("paid_by")}</div>
                <Segmented
                  options={[
                    { value: "me", label: tm("me") },
                    { value: "family", label: tm("family") },
                  ]}
                  value={paidBy}
                  onChange={setPaidBy}
                />
              </div>
            </div>
          </Card>
          <Card>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,.pdf,text/csv,text/comma-separated-values,application/vnd.ms-excel,application/pdf,.txt"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
            />
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const f = e.dataTransfer.files?.[0];
                if (f && online && !busy) onFile(f);
              }}
              className="flex flex-col items-center gap-2.5 rounded-xl border-2 border-dashed border-line bg-soft px-5 py-9 text-center"
            >
              <FileUp size={30} strokeWidth={1.7} />
              <div className="text-base font-bold">{tm("drop_statement")}</div>
              <div className="text-[13px] text-mut">{tm("csv_or_pdf_from", { bankName })}</div>
              <button
                onClick={() => fileRef.current?.click()}
                disabled={busy || !online}
                className="mt-1.5 h-[46px] rounded-full border-0 bg-acc px-[22px] text-sm font-bold text-onacc disabled:opacity-50"
              >
                {online ? (busy ? tm("reading_a_pdf_takes_up_to_a_minute") : tm("choose_file_arrow")) : tm("importing_needs_the_internet_2")}
              </button>
            </div>
            <p className="m-0 mt-3.5 text-[12.5px] leading-normal text-mut">{tm("csv_is_read_on_your_phone_a_pdf_is_read_by")}</p>
          </Card>
        </div>
      )}

      {step === "columns" && mapping && (
        <ColumnsStep
          text={text}
          fileName={fileName}
          bankName={bankName}
          mapping={mapping}
          onChange={setMapping}
          busy={busy}
          onBack={reset}
          onDone={async () => {
            await saveMapping(mapping);
            await prepare(text, mapping);
          }}
        />
      )}

      {step === "check" && (
        <CheckStep
          items={items}
          setItems={setItems}
          skipped={skipped}
          fileName={fileName}
          bankName={bankName}
          busy={busy}
          onBack={reset}
          onColumns={text ? () => setStep("columns") : undefined}
          onImport={importNow}
        />
      )}

      {step === "done" && result && (
        <Card className="flex flex-col gap-3">
          <H2>{tm("tx_imported", { n: result.added })}</H2>
          <div className="text-[13px] text-mut">
            {tm("import_done_from", { file: fileName })} {result.dup > 0 && tm("import_done_dup", { n: result.dup })} {tm("import_done_learned")}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Link href="/budget" className={`${secondaryBtn} flex items-center justify-center`}>
              {tm("see_budget")}
            </Link>
            <button onClick={reset} className={secondaryBtn}>
              {tm("import_another_file")}
            </button>
          </div>
        </Card>
      )}
    </>
  );
}

/* Step 2: which column is which (asked once per bank) ---------------------- */

function ColumnsStep({
  text,
  fileName,
  bankName,
  mapping,
  onChange,
  busy,
  onBack,
  onDone,
}: {
  text: string;
  fileName: string;
  bankName: string;
  mapping: Mapping;
  onChange: (m: Mapping) => void;
  busy: boolean;
  onBack: () => void;
  onDone: () => void;
}) {
  const tm = useTranslations("money");
  const dates = useDates();
  const all = useMemo(() => parseCsv(text, mapping.delimiter), [text, mapping.delimiter]);
  const header = all[mapping.headerRow] ?? [];
  const preview = useMemo(() => readRows(text, mapping), [text, mapping]);
  const cols = header.map((h, i) => ({ value: i, label: h || tm("column", { v: i + 1 }) }));

  const field = (label: string, key: "date" | "amount" | "payee" | "credit" | "fee" | "purpose" | "status" | "currency", optional = false) => (
    <label className="flex flex-col gap-1.5">
      <span className="text-[12.5px] font-bold text-mut">{label}</span>
      <select
        className={selectCls}
        value={mapping[key] ?? -1}
        onChange={(e) => {
          const v = Number(e.target.value);
          onChange({ ...mapping, [key]: v < 0 ? undefined : v });
        }}
      >
        {optional && <option value={-1}>{tm("none")}</option>}
        {cols.map((c) => (
          <option key={c.value} value={c.value}>
            {c.label}
          </option>
        ))}
      </select>
    </label>
  );

  return (
    <Card className="flex flex-col gap-4">
      <div>
        <H2>{tm("check_the_columns", { bankName: bankName })}</H2>
        <div className="mt-1 text-[13px] text-mut">
          {tm("asked_once_next_time_files_are_read_the_sa", { fileName: fileName, bankName: bankName })}
        </div>
      </div>
      <div className="flex items-center gap-2 text-[13px]">
        <span className="text-mut">{tm("table_starts_at_line")}</span>
        <button className={secondaryBtn} aria-label={tm("earlier_line")} onClick={() => onChange({ ...mapping, headerRow: Math.max(0, mapping.headerRow - 1) })}>
          −
        </button>
        <b>{mapping.headerRow + 1}</b>
        <button
          className={secondaryBtn}
          aria-label={tm("later_line")}
          onClick={() => onChange({ ...mapping, headerRow: Math.min(all.length - 1, mapping.headerRow + 1) })}
        >
          +
        </button>
      </div>
      <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(100%,220px),1fr))]">
        {field(tm("date"), "date")}
        {field(mapping.credit != null ? tm("money_out") : tm("amount"), "amount")}
        {field(tm("money_in_only_if_a_separate_column"), "credit", true)}
        {field(tm("shop_or_who_paid"), "payee")}
        {field(tm("purpose_reference"), "purpose", true)}
        {field(tm("fee_taken_off"), "fee", true)}
        {field(tm("status_pending_rows_are_skipped"), "status", true)}
        {field(tm("currency"), "currency", true)}
      </div>
      <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(100%,220px),1fr))]">
        <div>
          <div className="mb-2 text-[12.5px] font-bold text-mut">{tm("dates_look_like")}</div>
          <Segmented
            options={[
              { value: "dmy", label: "31.12.26" },
              { value: "mdy", label: "12/31/26" },
              { value: "ymd", label: "2026-12-31" },
            ]}
            value={mapping.dateOrder}
            onChange={(v) => onChange({ ...mapping, dateOrder: v })}
          />
        </div>
        <div>
          <div className="mb-2 text-[12.5px] font-bold text-mut">{tm("amounts_look_like")}</div>
          <Segmented
            options={[
              { value: ",", label: "1.234,56" },
              { value: ".", label: "1,234.56" },
            ]}
            value={mapping.decimal}
            onChange={(v) => onChange({ ...mapping, decimal: v })}
          />
        </div>
      </div>

      <div className="rounded-[10px] bg-soft p-3.5">
        <div className="mb-2 text-[12.5px] font-bold text-mut">
          {tm("preview_rows_read", { length: preview.rows.length })}{preview.skipped.length ? tm("skipped", { length: preview.skipped.length }) : ""}
        </div>
        {preview.rows.slice(0, 5).map((r) => (
          <div key={r.line} className="flex items-baseline gap-2 border-b border-line py-1.5 text-[13px] last:border-0">
            <span className="w-14 flex-none font-mono text-xs text-mut">{dates.short(r.date)}</span>
            <span className="min-w-0 flex-1 truncate font-semibold">{r.payee}</span>
            <span className={`flex-none font-mono text-[13px] font-bold ${r.amount < 0 ? "text-ink" : "text-ok"}`}>
              {r.currency === "EUR" ? eur(r.amount, 2) : `${r.currency} ${r.amount.toLocaleString("en")}`}
            </span>
          </div>
        ))}
        {!preview.rows.length && <div className="text-[13px] text-bad">{tm("no_rows_could_be_read_yet_change_the_colum")}</div>}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button onClick={onBack} className={secondaryBtn}>
          {tm("back")}
        </button>
        <button onClick={onDone} disabled={busy || !preview.rows.length} className={primaryBtn}>
          {busy ? tm("reading") : tm("use_these_columns")}
        </button>
      </div>
    </Card>
  );
}

/* Step 3: check rows, pick categories, import ------------------------------ */

function CheckStep({
  items,
  setItems,
  skipped,
  fileName,
  bankName,
  busy,
  onBack,
  onColumns,
  onImport,
}: {
  items: Item[];
  setItems: (f: (items: Item[]) => Item[]) => void;
  skipped: Skipped[];
  fileName: string;
  bankName: string;
  busy: boolean;
  onBack: () => void;
  onColumns?: () => void;
  onImport: () => void;
}) {
  const tm = useTranslations("money");
  const { categories } = useMoney();
  const [showAll, setShowAll] = useState(false);
  const [showSkipped, setShowSkipped] = useState(false);
  const catName = (id: string) => categories.find((c) => c.id === id)?.name ?? "";

  const update = (hash: string, patch: Partial<Item>) => setItems((list) => list.map((x) => (x.hash === hash ? { ...x, ...patch } : x)));

  const dups = items.filter((x) => x.dup);
  const transfers = items.filter((x) => !x.dup && x.suggestion.transfer);
  const noRate = items.filter((x) => !x.dup && x.eur == null);
  const chosen = items.filter((x) => x.include && !x.dup && x.eur != null);
  const flagged = chosen.filter((x) => x.eur! < 0 && !x.categoryId);
  const rest = items.filter((x) => !x.dup && !flagged.includes(x));
  const shown = showAll ? rest : rest.slice(0, 60);
  const total = chosen.reduce((a, x) => a + x.eur!, 0);

  return (
    <>
      <Card className="flex flex-col gap-3">
        <div>
          <H2>{tm("check_before_saving", { bankName: bankName })}</H2>
          <div className="mt-1 text-[13px] text-mut">{fileName}</div>
        </div>
        <div className="grid grid-cols-2 gap-2 text-[13px] wide:grid-cols-4">
          <Stat n={chosen.length} label={tm("to_import")} strong />
          <Stat n={dups.length} label={tm("already_imported")} />
          <Stat n={transfers.length} label={tm("between_your_accounts")} />
          <Stat n={skipped.length + noRate.length} label={tm("skipped_label")} />
        </div>
        {transfers.length > 0 && (
          <div className="text-xs text-mut">
            {tm("money_moving_between_your_own_accounts_car")}
          </div>
        )}
        {onColumns && (
          <button onClick={onColumns} className="self-start border-0 bg-transparent p-0 text-[13px] font-bold text-acct">
            {tm("something_looks_wrong_check_the_columns")}
          </button>
        )}
        {(skipped.length > 0 || noRate.length > 0) && (
          <button onClick={() => setShowSkipped((v) => !v)} className="self-start border-0 bg-transparent p-0 text-[13px] font-bold text-acct">
            {showSkipped ? tm("hide_skipped_rows") : tm("why_were_rows_skipped")}
          </button>
        )}
        {showSkipped && (
          <div className="rounded-[10px] bg-soft p-3 text-xs text-mut">
            {skipped.map((s) => (
              <div key={`${s.line}-${s.reason}`}>
                {s.line ? tm("line", { line: s.line }) : ""}
                {s.code ? tm(`skip_${s.code}`, { detail: s.detail ?? "" }) : s.reason}
              </div>
            ))}
            {noRate.map((x) => (
              <div key={x.hash}>
                {tm("line_is_not_changed_to_euro_automatically", { line: x.row.line, currency: x.row.currency })}
              </div>
            ))}
          </div>
        )}
      </Card>

      {flagged.length > 0 && (
        <Card className="flex flex-col gap-1">
          <H2>{tm("needs_a_category", { length: flagged.length })}</H2>
          <div className="mb-1 text-[13px] text-mut">{tm("your_choice_is_remembered_for_this_shop_ne")}</div>
          {flagged.map((x) => (
            <div key={x.hash} className="flex flex-col gap-2 border-b border-line py-3 last:border-0">
              <RowLine item={x} />
              <div className="flex flex-wrap gap-1.5">
                {x.suggestion.options.map((id) => (
                  <button
                    key={id}
                    onClick={() => update(x.hash, { categoryId: id })}
                    className="min-h-10 rounded-full border border-line bg-card px-3 text-[13px] font-bold text-ink"
                  >
                    {catName(id)}
                  </button>
                ))}
                <select
                  aria-label={tm("category_for", { payee: x.row.payee })}
                  className="min-h-10 rounded-full border border-line bg-card px-3 text-[13px] font-bold text-mut"
                  value=""
                  onChange={(e) => e.target.value && update(x.hash, { categoryId: e.target.value })}
                >
                  <option value="">{tm("other_2")}</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          ))}
        </Card>
      )}

      <Card className="flex flex-col gap-1">
        <H2>{tm("rows")}</H2>
        {shown.map((x) => (
          <div key={x.hash} className={`flex items-center gap-3 border-b border-line py-2.5 last:border-0 ${x.include ? "" : "opacity-55"}`}>
            <input
              type="checkbox"
              checked={x.include}
              disabled={x.eur == null}
              onChange={(e) => update(x.hash, { include: e.target.checked })}
              aria-label={tm("import", { payee: x.row.payee })}
              className="h-5 w-5 flex-none accent-[var(--acc)]"
            />
            <div className="min-w-0 flex-1">
              <RowLine item={x} />
              {x.eur != null && x.eur < 0 && x.include && (
                <select
                  aria-label={tm("category_for", { payee: x.row.payee })}
                  className="mt-1.5 min-h-9 max-w-full rounded-lg border border-line bg-card px-2 text-[12.5px] text-ink"
                  value={x.categoryId ?? ""}
                  onChange={(e) => update(x.hash, { categoryId: e.target.value || null })}
                >
                  <option value="">{tm("no_category")}</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              )}
              {x.suggestion.transfer && !x.include && <div className="mt-0.5 text-[11.5px] text-mut2">{tm("between_your_accounts_not_counted")}</div>}
            </div>
          </div>
        ))}
        {rest.length > shown.length && (
          <button onClick={() => setShowAll(true)} className="mt-2 min-h-11 border-0 bg-transparent text-[13px] font-bold text-acct">
            {tm("show_all_rows", { length: rest.length })}
          </button>
        )}
        {dups.length > 0 && <div className="pt-2 text-xs text-mut2">{tm("rows_from_this_file_are_already_in_the_app", { length: dups.length })}</div>}
      </Card>

      <div className="sticky bottom-[calc(84px+env(safe-area-inset-bottom))] z-20 mr-[72px] flex flex-col gap-2 rounded-[18px] border border-line bg-card p-3 shadow-[0_4px_16px_rgba(0,0,0,.08)] wide:bottom-4 wide:mr-[84px]">
        <div className="flex justify-between text-[13px]">
          <span className="text-mut">
            {tm("n_rows", { n: chosen.length })}
            {flagged.length ? ` · ${tm("n_without_category", { n: flagged.length })}` : ""}
          </span>
          <span className="font-mono font-bold">{eur(total, 2)}</span>
        </div>
        <div className="grid grid-cols-[auto_1fr] gap-2">
          <button onClick={onBack} className={secondaryBtn}>
            {tm("cancel")}
          </button>
          <button onClick={onImport} disabled={busy || !chosen.length} className={primaryBtn}>
            {busy ? tm("saving") : tm("import_2", { length: chosen.length })}
          </button>
        </div>
      </div>
    </>
  );
}

function Stat({ n, label, strong = false }: { n: number; label: string; strong?: boolean }) {
  return (
    <div className="rounded-xl border border-line bg-card p-4">
      <div className={`text-[30px] font-bold tabular-nums ${strong ? "text-acct" : ""}`}>{n}</div>
      <div className="text-xs text-mut">{label}</div>
    </div>
  );
}

function RowLine({ item }: { item: Item }) {
  const tm = useTranslations("money");
  const dates = useDates();
  const r = item.row;
  return (
    <div className="flex items-baseline gap-2">
      <span className="w-12 flex-none font-mono text-xs text-mut">{dates.short(r.date)}</span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13.5px] font-bold">{r.payee}</div>
        {r.purpose && <div className="truncate text-[11.5px] text-mut2">{r.purpose}</div>}
      </div>
      <div className="flex-none text-right">
        <div className={`font-mono text-[13.5px] font-bold ${r.amount < 0 ? "text-ink" : "text-ok"}`}>
          {item.eur != null ? eur(item.eur, 2) : `${r.currency} ${r.amount}`}
        </div>
        {r.currency !== "EUR" && <div className="font-mono text-[11px] text-mut2">{r.currency === "IDR" ? tm("rp", { toLocaleString: Math.abs(r.amount).toLocaleString("id-ID") }) : r.currency}</div>}
      </div>
    </div>
  );
}
