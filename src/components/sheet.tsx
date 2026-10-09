"use client";

import { X } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

/** Bottom sheet on phones, centred modal from 900px up. Tapping the scrim closes it. */
export function Sheet({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/55 wide:items-center wide:p-6"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[88dvh] w-full max-w-[520px] flex-col gap-4 overflow-y-auto overscroll-contain rounded-t-[24px] bg-card px-[22px] pb-[calc(22px+env(safe-area-inset-bottom))] pt-[22px] shadow-[0_20px_60px_rgba(0,0,0,.3)] wide:rounded-[24px]"
      >
        <div className="flex items-center justify-between gap-2.5">
          <h2 className="m-0 text-xl font-extrabold tracking-[-0.01em]">{title}</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="flex h-[38px] w-[38px] flex-none items-center justify-center rounded-full border-0 bg-soft2 text-ink"
          >
            <X size={16} strokeWidth={2.6} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export type FieldValue = string | boolean | File | null;
export type FormValues = Record<string, FieldValue>;

export type Field =
  | { kind: "text"; key: string; label: string; placeholder?: string; required?: boolean }
  | { kind: "amount"; key: string; label: string; prefix?: "€" | "Rp"; placeholder?: string; required?: boolean }
  | { kind: "number"; key: string; label: string; placeholder?: string; required?: boolean }
  | { kind: "date"; key: string; label: string; required?: boolean }
  | {
      kind: "chips";
      key: string;
      label: string;
      options: { value: string; label: string; icon?: LucideIcon }[];
      required?: boolean;
    }
  | { kind: "toggle"; key: string; label: string; toggleLabel: string }
  | { kind: "file"; key: string; label: string; accept: string; current?: string }
  | { kind: "note"; key: string; label: string; text: string };

const inputCls =
  "h-[50px] rounded-[10px] border border-line bg-soft px-3.5 text-base text-ink outline-none focus:border-line2";

/** The one generic form used everywhere. */
export function FormSheet({
  title,
  fields,
  initial,
  editing = false,
  onSave,
  onDelete,
  onClose,
}: {
  title: string;
  fields: Field[];
  initial?: FormValues;
  editing?: boolean;
  onSave: (values: FormValues) => Promise<string | void> | string | void;
  onDelete?: () => Promise<void> | void;
  onClose: () => void;
}) {
  const [values, setValues] = useState<FormValues>(initial ?? {});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (key: string, v: FieldValue) => setValues((s) => ({ ...s, [key]: v }));

  async function save() {
    const missing = fields.find(
      (f) => "required" in f && f.required && !String(values[f.key] ?? "").trim(),
    );
    if (missing) {
      setError(`Please fill in: ${missing.label}`);
      return;
    }
    setBusy(true);
    setError("");
    const err = await onSave(values);
    setBusy(false);
    if (err) setError(err);
  }

  return (
    <Sheet title={title} onClose={onClose}>
      <div className="flex flex-col gap-4">
        {fields.map((f) => (
          <div key={f.key} className="flex flex-col gap-2">
            <div className="text-[12.5px] font-bold text-mut">{f.label}</div>
            {f.kind === "text" && (
              <input
                className={inputCls}
                value={String(values[f.key] ?? "")}
                placeholder={f.placeholder}
                onChange={(e) => set(f.key, e.target.value)}
              />
            )}
            {f.kind === "number" && (
              <input
                className={inputCls}
                inputMode="decimal"
                value={String(values[f.key] ?? "")}
                placeholder={f.placeholder}
                onChange={(e) => set(f.key, e.target.value)}
              />
            )}
            {f.kind === "date" && (
              <input
                type="date"
                className={inputCls}
                value={String(values[f.key] ?? "")}
                onChange={(e) => set(f.key, e.target.value)}
              />
            )}
            {f.kind === "amount" && (
              <div className="flex h-14 items-center gap-2 rounded-[10px] border border-line bg-soft px-3.5">
                <span className="text-xl font-black text-mut2">{f.prefix ?? "€"}</span>
                <input
                  inputMode="decimal"
                  className="min-w-0 flex-1 border-0 bg-transparent text-[22px] font-black text-ink outline-none"
                  value={String(values[f.key] ?? "")}
                  placeholder={f.placeholder}
                  onChange={(e) => set(f.key, e.target.value)}
                />
              </div>
            )}
            {f.kind === "chips" && (
              <div className="flex flex-wrap gap-1.5">
                {f.options.map((o) => {
                  const on = values[f.key] === o.value;
                  const Icon = o.icon;
                  return (
                    <button
                      key={o.value}
                      type="button"
                      aria-label={o.label || o.value}
                      aria-pressed={on}
                      onClick={() => set(f.key, o.value)}
                      className={`inline-flex min-h-10 items-center justify-center gap-1.5 whitespace-nowrap rounded-full border px-[13px] text-[13px] font-bold ${
                        on ? "border-ink bg-inv text-white" : "border-line bg-card text-ink"
                      }`}
                    >
                      {Icon && <Icon size={18} strokeWidth={1.7} />}
                      {o.label}
                    </button>
                  );
                })}
              </div>
            )}
            {f.kind === "file" && (
              <label className="flex min-h-[50px] cursor-pointer items-center gap-3 rounded-[10px] border border-dashed border-line2 bg-soft px-3.5 py-3">
                <span className="rounded-full bg-card px-3 py-1.5 text-[13px] font-extrabold text-ink shadow-[0_1px_3px_rgba(0,0,0,.12)]">
                  Choose file
                </span>
                <span className="min-w-0 flex-1 truncate text-[13px] text-mut">
                  {values[f.key] instanceof File ? (values[f.key] as File).name : (f.current ?? "No file yet")}
                </span>
                <input
                  type="file"
                  accept={f.accept}
                  className="sr-only"
                  onChange={(e) => set(f.key, e.target.files?.[0] ?? null)}
                />
              </label>
            )}
            {f.kind === "note" && <div className="text-[13px] leading-normal text-mut">{f.text}</div>}
            {f.kind === "toggle" && (
              <button
                type="button"
                onClick={() => set(f.key, !values[f.key])}
                className="flex min-h-[50px] items-center gap-3 rounded-[10px] border-0 bg-soft px-3.5 py-3 text-left"
              >
                <Switch on={!!values[f.key]} />
                <span className="text-[13.5px] font-bold text-ink">{f.toggleLabel}</span>
              </button>
            )}
          </div>
        ))}
        {error && <div className="text-[13px] font-bold text-bad">{error}</div>}
        <div className="flex items-center gap-2">
          {onDelete && (
            <button
              type="button"
              onClick={() => onDelete()}
              className="h-[50px] rounded-full border border-badbg bg-card px-[18px] text-sm font-extrabold text-bad"
            >
              Delete
            </button>
          )}
          <button
            type="button"
            disabled={busy}
            onClick={save}
            className="h-[50px] flex-1 rounded-full border-0 bg-acc text-[15px] font-extrabold text-onacc hover:bg-acc2 disabled:opacity-60"
          >
            {busy ? "Saving…" : editing ? "Save changes" : "Save"}
          </button>
        </div>
      </div>
    </Sheet>
  );
}

/** Visual on/off switch (46×28). Wrap it in a button. */
export function Switch({ on }: { on: boolean }) {
  return (
    <span
      className={`flex h-7 w-[46px] flex-none rounded-full p-[3px] ${on ? "justify-end bg-acc" : "justify-start bg-line2"}`}
    >
      <span className="h-[22px] w-[22px] rounded-full bg-card shadow-[0_1px_3px_rgba(0,0,0,.2)]" />
    </span>
  );
}
