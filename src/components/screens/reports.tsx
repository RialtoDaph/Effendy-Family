"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import { useAppData } from "@/components/app-data";
import { useFeedbackFields } from "@/components/feedback-button";
import { FormSheet } from "@/components/sheet";
import { useToast } from "@/components/toast";
import { EmptyNote } from "@/components/ui";
import { COLUMNS, FEEDBACK_EVENT, deleteFeedback, listFeedback, updateFeedback, type Feedback, type FeedbackKind, type FeedbackStatus } from "@/lib/feedback";
import { useDates } from "@/lib/use-dates";
import { PageHeader } from "./page-header";

const KIND_STYLE: Record<FeedbackKind, string> = {
  bug: "bg-badbg text-bad",
  idea: "bg-tint text-acct",
  other: "bg-soft2 text-mut",
};

export function ReportsScreen() {
  const t = useTranslations("tools");
  const dates = useDates();
  const fields = useFeedbackFields();
  const { members } = useAppData();
  const toast = useToast();
  const [items, setItems] = useState<Feedback[] | null>(null);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<Feedback | null>(null);

  const load = useCallback(async () => {
    const res = await listFeedback();
    setItems(res.items);
    setError(res.error ?? "");
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
    window.addEventListener(FEEDBACK_EVENT, load);
    return () => window.removeEventListener(FEEDBACK_EVENT, load);
  }, [load]);

  async function move(f: Feedback, status: FeedbackStatus) {
    setItems((all) => all?.map((x) => (x.id === f.id ? { ...x, status } : x)) ?? null);
    const err = await updateFeedback(f.id, { status });
    if (err) {
      toast(err);
      void load();
    }
  }

  const nameOf = (id: string) => members.find((m) => m.id === id)?.display_name ?? t("rp_someone");
  const open = items?.filter((f) => f.status !== "done").length ?? 0;

  return (
    <>
      <PageHeader eyebrow={t("tools")} title={t("rp_title")} />
      <div className="-mt-2 text-[13px] text-mut">
        {t("rp_sub")}
      </div>
      {error && (
        <div className="rounded-[10px] bg-badbg p-3 text-[13px] font-bold text-bad" role="alert">
          {error}
        </div>
      )}
      {items && !items.length && !error && <EmptyNote>{t("rp_empty")}</EmptyNote>}
      {items && items.length > 0 && (
        <>
          <div className="font-mono text-xs text-mut">{t("rp_open", { n: open })}</div>
          <div className="grid items-start gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(100%,260px),1fr))]">
            {COLUMNS.map((col, ci) => {
              const cards = items.filter((f) => f.status === col.id);
              return (
                <section key={col.id} aria-label={t(col.label)} className="flex flex-col gap-2 rounded-[12px] bg-soft p-2.5">
                  <div className="flex items-center justify-between px-1 pb-0.5">
                    <h2 className="m-0 text-[14px] font-extrabold">{t(col.label)}</h2>
                    <span className="rounded-full bg-card px-2 py-0.5 font-mono text-[11px] font-bold text-mut">{cards.length}</span>
                  </div>
                  {!cards.length && <div className="px-1 py-3 text-center text-[12.5px] text-mut2">{t("rp_nothing")}</div>}
                  {cards.map((f) => {
                    const prev = COLUMNS[ci - 1];
                    const next = COLUMNS[ci + 1];
                    return (
                      <article key={f.id} className="flex flex-col gap-2 rounded-[18px] border border-line bg-card p-3">
                        <button onClick={() => setEditing(f)} className="flex flex-col gap-1.5 border-0 bg-transparent p-0 text-left">
                          <div className="flex items-center gap-2">
                            <span className={`rounded-full px-2 py-0.5 text-[11px] font-extrabold ${KIND_STYLE[f.kind]}`}>{t(`k_${f.kind}`)}</span>
                            {f.page && <span className="truncate font-mono text-[11px] text-mut2">{f.page}</span>}
                          </div>
                          <div className={`text-[14.5px] font-bold ${f.status === "done" ? "text-mut line-through" : "text-ink"}`}>{f.title}</div>
                          {f.note && <div className="line-clamp-3 whitespace-pre-wrap text-[13px] text-mut">{f.note}</div>}
                          <div className="text-[11.5px] text-mut2">
                            {nameOf(f.owner_id)} · {dates.short(f.created_at.slice(0, 10))}
                            {f.device ? ` · ${f.device}` : ""}
                          </div>
                        </button>
                        <div className="flex items-center gap-2 border-t border-line pt-2">
                          {prev && (
                            <button
                              onClick={() => move(f, prev.id)}
                              aria-label={t("rp_move", { to: t(prev.label) })}
                              className="flex min-h-9 items-center gap-1 rounded-full border border-line bg-card px-2.5 text-[12px] font-bold text-mut"
                            >
                              <ChevronLeft size={14} /> {t(prev.label)}
                            </button>
                          )}
                          <span className="flex-1" />
                          {next && (
                            <button
                              onClick={() => move(f, next.id)}
                              aria-label={t("rp_move", { to: t(next.label) })}
                              className="flex min-h-9 items-center gap-1 rounded-full border-0 bg-tint px-2.5 text-[12px] font-extrabold text-acct"
                            >
                              {t(next.label)} <ChevronRight size={14} />
                            </button>
                          )}
                        </div>
                      </article>
                    );
                  })}
                </section>
              );
            })}
          </div>
        </>
      )}
      {editing && (
        <FormSheet
          title={t("rp_edit")}
          editing
          fields={[
            ...fields,
            { kind: "chips", key: "status", label: t("rp_column"), required: true, options: COLUMNS.map((c) => ({ value: c.id, label: t(c.label) })) },
          ]}
          initial={{ kind: editing.kind, title: editing.title, note: editing.note ?? "", status: editing.status }}
          onClose={() => setEditing(null)}
          onSave={async (v) => {
            const err = await updateFeedback(editing.id, {
              kind: String(v.kind) as FeedbackKind,
              title: String(v.title).trim().slice(0, 200),
              note: String(v.note ?? "").trim() || null,
              status: String(v.status) as FeedbackStatus,
            });
            if (err) return err;
            setEditing(null);
            void load();
          }}
          onDelete={async () => {
            if (!confirm(t("rp_delete_q"))) return;
            const err = await deleteFeedback(editing.id);
            if (err) return toast(err);
            setEditing(null);
            void load();
          }}
        />
      )}
    </>
  );
}
