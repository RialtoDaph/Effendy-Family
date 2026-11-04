"use client";

import { useTranslations } from "next-intl";
import { Camera } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useAppData } from "@/components/app-data";
import { useFinance } from "@/components/finance-data";
import { useMoney } from "@/components/money-data";
import { Sheet, type FormValues } from "@/components/sheet";
import { useToast } from "@/components/toast";
import { readReceipt, shrinkPhoto } from "@/lib/ai-read";
import { toEur } from "@/lib/bank-import";

/**
 * Scan receipt (README): photo → Claude reads shop, date, total, items and a
 * category → the normal transaction form opens filled in, so you always check
 * before saving. The photo is kept privately and linked to the transaction.
 */
export function ReceiptScan({ onClose, onRead }: { onClose: () => void; onRead: (preset: FormValues) => void }) {
  const tm = useTranslations("money");
  const { settings, userId } = useAppData();
  const money = useMoney();
  const fin = useFinance();
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => () => void (preview && URL.revokeObjectURL(preview)), [preview]);

  async function onPhoto(original: File) {
    setError("");
    setBusy(true);
    setPreview(URL.createObjectURL(original));
    const photo = await shrinkPhoto(original);
    const read = await readReceipt(photo);
    if (read.error !== undefined) {
      setBusy(false);
      setError(read.error);
      return;
    }
    const r = read.result;
    const visibility = settings?.default_visibility?.transactions === "private" ? "private" : "family";
    const saved = await fin.upload(photo, "receipt", visibility);
    if (saved.error) toast(tm("the_photo_could_not_be_kept_but_the_receip"));
    else void fin.reload();

    const eur = toEur(-Math.abs(r.total), r.currency.toUpperCase(), fin.rate);
    const date = r.date && /^\d{4}-\d{2}-\d{2}$/.test(r.date) && r.date <= money.today.iso ? r.date : money.today.iso;
    const items = r.items
      .slice(0, 8)
      .map((i) => `${i.name} ${i.amount.toFixed(2)}`)
      .join(", ");
    const foreign = r.currency.toUpperCase() !== "EUR" ? `${r.currency.toUpperCase()} ${r.total.toLocaleString("en")}` : "";
    onRead({
      kind: "out",
      amount: eur != null ? String(Math.abs(eur)) : String(r.total),
      payee: r.merchant,
      category: money.categories.find((c) => c.name === r.category)?.id ?? "",
      date,
      paid_by: userId,
      visibility,
      note: [foreign, items].filter(Boolean).join(" · ").slice(0, 300),
      receipt_file_id: saved.id ?? null,
    });
    if (r.confidence === "low") toast(tm("hard_to_read_please_check_the_amount_and_d"));
    else if (eur == null) toast(tm("amount_is_in_please_enter_it_in_euro", { currency: r.currency }));
  }

  return (
    <Sheet title={tm("scan_receipt")} onClose={onClose}>
      <div className="text-[22px] font-extrabold tracking-[-0.01em]">{tm("scan_receipt")}</div>
      <div className="-mt-2 text-[13px] text-mut">{tm("take_a_photo_of_the_whole_receipt_you_chec")}</div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => e.target.files?.[0] && onPhoto(e.target.files[0])}
      />
      {preview && (
        // eslint-disable-next-line @next/next/no-img-element -- local photo preview
        <img src={preview} alt={tm("receipt_photo")} className="max-h-[42dvh] w-full rounded-[10px] bg-soft object-contain" />
      )}
      {busy && (
        <div className="flex items-center gap-2.5 text-[13.5px] font-bold text-mut" role="status">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-line border-t-ink" />
          {tm("reading_the_receipt")}
        </div>
      )}
      {error && (
        <div className="rounded-[10px] bg-badbg p-3 text-[13px] font-bold text-bad" role="alert">
          {error}
        </div>
      )}
      <button
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        className="flex min-h-12 items-center justify-center gap-2 rounded-full border-0 bg-acc text-sm font-extrabold text-onacc disabled:opacity-50"
      >
        <Camera size={18} /> {preview ? tm("take_another_photo") : tm("take_photo_or_choose_one")}
      </button>
      <button onClick={onClose} className="min-h-11 border-0 bg-transparent text-[13.5px] font-bold text-mut">
        {tm("cancel")}
      </button>
    </Sheet>
  );
}
