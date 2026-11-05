"use client";

import { Check, Copy } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import { useAiName } from "@/components/app-data";
import { useToast } from "@/components/toast";
import { inboxScript } from "@/lib/inbox-script";
import { supabase } from "@/lib/supabase";

type Status = { created_at: string; last_used_at: string | null } | null;

const when = (iso: string, locale: string) =>
  new Date(iso).toLocaleString(locale, { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Berlin" });

/** Settings → Inbox: make a key, copy the Apps Script, see when it last ran. */
export function InboxSection({ Section, Pill }: { Section: SectionLike; Pill: PillLike }) {
  const t = useTranslations("settings");
  const locale = useLocale();
  const aiName = useAiName();
  const toast = useToast();
  const [status, setStatus] = useState<Status | undefined>(undefined);
  const [script, setScript] = useState("");
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const { data, error } = await supabase().rpc("inbox_key_status");
    // On an error the button still works; making a key shows the real problem.
    setStatus(error ? null : (((data as Status[] | null) ?? [])[0] ?? null));
  }, []);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  async function makeKey() {
    if (status && !confirm(t("ib_new_q"))) return;
    setBusy(true);
    setError("");
    const { data, error } = await supabase().rpc("create_inbox_key");
    setBusy(false);
    if (error || typeof data !== "string") {
      setError(!navigator.onLine ? t("needs_net") : t("ib_key_failed", { why: error?.message ?? t("ib_no_answer") }));
      return;
    }
    setScript(inboxScript(window.location.origin, data));
    setCopied(false);
    void load();
  }

  async function disconnect() {
    if (!confirm(t("ib_disc_q"))) return;
    const { error } = await supabase().rpc("revoke_inbox_key");
    if (error) return toast(t("ib_disc_failed"));
    setScript("");
    void load();
    toast(t("ib_disc_done"));
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(script);
      setCopied(true);
    } catch {
      toast(t("ib_copy_hand"));
    }
  }

  const connected = !!status?.last_used_at;
  return (
    <Section
      title={t("ib_title")}
      sub={t("ib_sub", { name: aiName })}
      pill={<Pill tone={connected ? "ok" : "mut"}>{connected ? t("ib_connected") : status ? t("ib_waiting") : t("p_off")}</Pill>}
    >
      {status?.last_used_at && <div className="text-[13px] text-mut">{t("ib_last", { when: when(status.last_used_at, locale) })}</div>}
      {status && !status.last_used_at && !script && (
        <div className="rounded-[10px] bg-soft p-3.5 text-[13px] leading-normal text-mut">
          {t("ib_lost")}
        </div>
      )}

      {error && (
        <div className="rounded-[10px] bg-badbg p-3 text-[13px] font-bold text-bad" role="alert">
          {error}
        </div>
      )}
      {script ? (
        <div className="flex flex-col gap-3">
          <ol className="m-0 flex list-decimal flex-col gap-1.5 pl-5 text-[13px] leading-normal text-ink">
            <li>{t("ib_s1")}</li>
            <li>
              {t.rich("ib_s2", {
                a: (c) => (
                  <a href="https://script.google.com/home/projects/create" target="_blank" rel="noreferrer" className="font-bold underline">
                    {c}
                  </a>
                ),
              })}
            </li>
            <li>{t("ib_s3")}</li>
            <li>{t.rich("ib_s4", { b: (c) => <b>{c}</b> })}</li>
            <li>{t.rich("ib_s5", { b: (c) => <b>{c}</b> })}</li>
            <li>{t("ib_s6")}</li>
          </ol>
          <div className="relative">
            <textarea
              readOnly
              value={script}
              rows={8}
              wrap="off"
              aria-label={t("ib_script")}
              onFocus={(e) => e.currentTarget.select()}
              className="w-full resize-y rounded-[10px] border border-line bg-soft p-3 font-mono text-[11.5px] leading-snug text-ink outline-none"
            />
          </div>
          <button onClick={copy} className="flex min-h-12 items-center justify-center gap-2 rounded-full border-0 bg-acc text-sm font-extrabold text-onacc">
            {copied ? <Check size={16} /> : <Copy size={16} />}
            {copied ? t("ib_copied") : t("ib_copy")}
          </button>
          <div className="text-xs text-mut2">{t("ib_once")}</div>
        </div>
      ) : (
        <button
          onClick={makeKey}
          disabled={busy}
          className={`min-h-12 rounded-full text-sm font-extrabold disabled:opacity-60 ${
            status ? "border border-line bg-card text-ink" : "border-0 bg-acc text-onacc"
          }`}
        >
          {busy ? t("ib_making") : status ? t("ib_remake") : t("ib_connect")}
        </button>
      )}
      {status && (
        <button onClick={disconnect} className="min-h-11 rounded-full border border-line bg-card text-[13px] font-bold text-bad">
          Disconnect
        </button>
      )}
      <div className="text-xs text-mut2">
        {t("ib_privacy")}
      </div>
    </Section>
  );
}

type SectionLike = (p: { title: string; sub?: string; pill?: React.ReactNode; children: React.ReactNode }) => React.ReactNode;
type PillLike = (p: { tone: "ok" | "mut"; children: React.ReactNode }) => React.ReactNode;
