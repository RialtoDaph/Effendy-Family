"use client";

import { Check } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { useAppData } from "@/components/app-data";
import { useToast } from "@/components/toast";
import { Segmented } from "@/components/ui";
import { authedPost } from "@/lib/assistant-client";
import { BILLING_START, PLAN_ORDER, PLANS, type BillInterval, type PlanKey } from "@/lib/plans";
import { supabase } from "@/lib/supabase";
import { useDates } from "@/lib/use-dates";
import { useEuro } from "@/lib/use-euro";
import { PageHeader } from "./page-header";
import { MembersSection } from "./settings";

type Usage = { ai_messages: number; voice_seconds: number; extra_voice_seconds: number };

export function PlanScreen() {
  const t = useTranslations("t");
  const ts = useTranslations("settings");
  const tp = useTranslations("plans");
  const locale = useLocale();
  const dates = useDates();
  const euro = useEuro();
  const toast = useToast();
  const { me, members, bill, plan, reload } = useAppData();
  const [yearly, setYearly] = useState(bill.interval === "year");
  const [usage, setUsage] = useState<Usage | null>(null);
  const [busy, setBusy] = useState(false);
  const owner = me?.role === "owner";
  const P = PLANS[plan];
  const end = bill.current_period_end?.slice(0, 10);
  // eslint-disable-next-line react-hooks/purity
  const trialOver = bill.status === "trial" && !!bill.current_period_end && new Date(bill.current_period_end).getTime() < Date.now();

  useEffect(() => {
    const month = new Date().toLocaleDateString("sv", { timeZone: "Europe/Berlin" }).slice(0, 7);
    supabase()
      .from("usage")
      .select("ai_messages,voice_seconds,extra_voice_seconds")
      .eq("month", month)
      .maybeSingle()
      .then(({ data }) => setUsage(data as Usage | null));
  }, []);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("paid") !== "1") return;
    toast(ts("paid"));
    window.history.replaceState(null, "", window.location.pathname);
    // Stripe's webhook usually lands within seconds.
    const timer = setTimeout(reload, 4000);
    return () => clearTimeout(timer);
  }, [reload, toast, ts]);

  const status =
    bill.status === "trial"
      ? trialOver
        ? ts("status_trial_over")
        : end
          ? ts("status_trial", { date: dates.full(end) })
          : ""
      : bill.status === "active"
        ? end
          ? ts("status_active", { date: dates.full(end) })
          : ""
        : bill.status === "past_due"
          ? ts("status_past_due")
          : ts("status_cancelled");

  async function redirect(path: string, body: object) {
    setBusy(true);
    const res = await authedPost<{ url?: string; code?: string }>(path, { ...body, locale });
    setBusy(false);
    if (res.ok && res.data?.url) return window.location.assign(res.data.url);
    const code = res.data?.code;
    toast(code === "not_configured" ? ts("billing_off") : code === "no_customer" ? ts("no_customer") : code === "not_allowed" ? ts("owner_only") : ts("billing_failed"));
  }

  const interval: BillInterval = yearly ? "year" : "month";
  const checkout = (k: PlanKey) => redirect("/api/billing/checkout", { plan: k, interval });
  const portal = () => redirect("/api/billing/portal", {});

  async function pick(k: PlanKey) {
    if (!owner) return toast(ts("owner_only"));
    if (bill.status === "active" || bill.status === "past_due") return portal();
    if (bill.status === "cancelled") return checkout(k);
    setBusy(true);
    const { error } = await supabase().rpc("plan_choose", { p_plan: k, p_interval: interval });
    setBusy(false);
    if (error) return toast(error.message.includes("seats_in_use") ? ts("seats_in_use") : ts("save_failed"));
    toast(`${t("switched")} ${PLANS[k].name}`);
    await reload();
  }

  const aiUsed = usage?.ai_messages ?? 0;
  const voiceUsed = Math.ceil((usage?.voice_seconds ?? 0) / 60);
  const price = bill.interval === "year" ? `${euro(P.year)} ${t("perYr")}` : `${euro(P.month)} ${t("perMo")}`;
  const seats = `${members.length} / ${bill.seats ?? BILLING_START.seats}`;

  return (
    <div data-screen-label="Plan & billing" className="flex flex-col gap-4">
      <PageHeader eyebrow={ts("eyebrow", { plan: P.name })} title={t("planT")} />

      <section className="grid items-center gap-5 rounded-[18px] bg-inv p-6 text-white [grid-template-columns:repeat(auto-fit,minmax(min(100%,200px),1fr))]">
        <div>
          <div className="font-mono text-[11px] font-bold uppercase tracking-[.16em] text-acc2">{t("current")}</div>
          <div className="mt-1.5 font-serif text-[39px] font-normal tracking-[-0.01em]">{P.name}</div>
          <div className="mt-1 text-[13px] text-white/65">
            {price}
            {status && ` · ${status}`}
          </div>
        </div>
        <div>
          <div className="text-xs font-semibold text-white/55">{t("seats")}</div>
          <div className="mt-1 text-2xl font-bold">{seats}</div>
        </div>
        <div>
          <div className="text-xs font-semibold text-white/55">{t("aiQuota")}</div>
          <div className="mt-1 text-2xl font-bold">{P.ai ? `${aiUsed} / ${P.ai}` : t("unlimited")}</div>
          {!!P.ai && (
            <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/15">
              <div className="h-full rounded-full bg-acc2" style={{ width: `${Math.min(100, (aiUsed / P.ai) * 100)}%` }} />
            </div>
          )}
          <div className="mt-1.5 text-xs text-white/55">{P.voiceMin ? ts("voice_left", { used: voiceUsed, total: P.voiceMin }) : ts("voice_none")}</div>
        </div>
        {owner && (
          <div className="flex flex-col gap-2">
            {(bill.status === "trial" || bill.status === "cancelled") && (
              <button onClick={() => checkout(plan)} disabled={busy} className="min-h-11 rounded-full border-0 bg-acci text-[13.5px] font-bold text-onacci disabled:opacity-60">
                {t("addPay")}
              </button>
            )}
            <button onClick={portal} disabled={busy} className="min-h-11 rounded-full border border-white/20 bg-transparent text-[13.5px] font-bold text-white disabled:opacity-60">
              {t("manage")}
            </button>
          </div>
        )}
      </section>

      <div className="self-start">
        <Segmented
          value={yearly ? "y" : "m"}
          onChange={(v) => setYearly(v === "y")}
          options={[
            { value: "m", label: t("monthly") },
            { value: "y", label: t("yearly") },
          ]}
        />
      </div>

      <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(100%,260px),1fr))]">
        {PLAN_ORDER.map((k) => {
          const p = PLANS[k];
          const on = k === plan;
          return (
            <section key={k} className={`flex flex-col gap-3.5 rounded-[18px] border-[1.5px] bg-card p-5 ${on ? "border-acc" : "border-line"}`}>
              <div className="flex items-center gap-2">
                <div className="text-[17px] font-bold">{p.name}</div>
                {k === "plus" && <span className="rounded-full bg-acc px-2 py-[3px] text-[11px] font-bold uppercase tracking-[.06em] text-onacc">{t("rec")}</span>}
              </div>
              <div className="flex flex-wrap items-baseline gap-1.5">
                <span className="font-serif text-[44px] font-normal tracking-[-0.01em]">{euro(yearly ? p.year / 12 : p.month)}</span>
                <span className="text-[13px] text-mut">
                  {t("perMo")}
                  {yearly && ` · ${euro(p.year)} ${t("perYr")}`}
                </span>
              </div>
              <div className="flex flex-col gap-2">
                {(tp.raw(k) as string[]).map((f) => (
                  <div key={f} className="flex gap-2 text-[13.5px] leading-snug">
                    <Check size={15} strokeWidth={2.6} className="mt-0.5 flex-none text-ok" />
                    <span>{f}</span>
                  </div>
                ))}
              </div>
              <button
                onClick={() => !on && pick(k)}
                disabled={busy || on}
                className={`mt-auto min-h-[46px] rounded-full text-sm font-bold ${on ? "border border-line bg-soft2 text-mut" : "border-0 bg-acc text-onacc disabled:opacity-60"}`}
              >
                {on ? t("currentL") : `${t("switchTo")} ${p.name}`}
              </button>
            </section>
          );
        })}
      </div>

      {!owner && <div className="text-[13px] text-mut">{ts("owner_only")}</div>}
      <MembersSection />
      {bill.seats === 1 && <div className="text-[13px] text-mut">{t("membersNote")}</div>}
    </div>
  );
}
