"use client";

import { useAppData } from "@/components/app-data";
import { useFinance } from "@/components/finance-data";
import { useMoneyForms } from "@/components/money-forms";
import { useToast } from "@/components/toast";
import { EmptyNote, OwnerPill, PrivateMark } from "@/components/ui";
import { subscriptionTotals, type Subscription } from "@/lib/finance";
import { eur } from "@/lib/money";
import { ModuleTabs } from "./module-tabs";
import { PageHeader } from "./page-header";

export function SubscriptionsScreen() {
  const { subscriptions, save } = useFinance();
  const { members, userId } = useAppData();
  const { openForm } = useMoneyForms();
  const toast = useToast();

  const family = subscriptions.filter((s) => s.visibility === "family");
  const t = subscriptionTotals(family);
  const active = subscriptions.filter((s) => s.status === "active");
  const stopped = subscriptions.filter((s) => s.status === "cancelled");
  const myPrivate = subscriptions.filter((s) => s.visibility === "private" && s.owner_id === userId && s.status === "active");

  async function setStatus(s: Subscription, status: "active" | "cancelled") {
    const err = await save(
      "subscriptions",
      { status, cancelled_on: status === "cancelled" ? new Date().toISOString().slice(0, 10) : null },
      s.id,
    );
    if (err) toast(err);
    else toast(status === "cancelled" ? `${s.name} marked as stopped · saves ${eur(s.monthly_price * 12)} a year` : `${s.name} is active again`);
  }

  const row = (s: Subscription) => (
    <div
      key={s.id}
      className={`flex items-center gap-3 border-t border-line py-3.5 ${s.visibility === "private" ? "border-dashed" : ""}`}
      style={{ opacity: s.status === "active" ? 1 : 0.6 }}
    >
      <button onClick={() => openForm("sub", s.id)} className="min-w-0 flex-1 border-0 bg-transparent p-0 text-left">
        <div className={`truncate text-[14.5px] font-extrabold text-ink ${s.status === "cancelled" ? "line-through" : ""}`}>{s.name}</div>
        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-mut2">
          <OwnerPill member={members.find((m) => m.id === s.for_whom)} />
          {s.status === "cancelled" && s.cancelled_on && <span>stopped {s.cancelled_on}</span>}
          {s.visibility === "private" && <PrivateMark />}
        </div>
      </button>
      <span className="whitespace-nowrap text-[15px] font-black">{eur(s.monthly_price)}</span>
      <button
        onClick={() => setStatus(s, s.status === "active" ? "cancelled" : "active")}
        className={`min-h-10 whitespace-nowrap rounded-full px-3.5 text-[12.5px] font-extrabold ${
          s.status === "active" ? "border border-line bg-card text-mut" : "border-0 bg-tint text-acct"
        }`}
      >
        {s.status === "active" ? "Stopped" : "Active again"}
      </button>
    </div>
  );

  return (
    <>
      <div className="flex flex-col gap-3">
        <PageHeader eyebrow="Money" title="Subscriptions" />
        <ModuleTabs module="money" active="subs" />
      </div>

      <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(100%,200px),1fr))]">
        <div className="rounded-xl border border-line bg-card p-[18px]">
          <div className="text-[12.5px] text-mut">Subscriptions / month</div>
          <div className="text-[34px] font-black tracking-[-0.02em]">{eur(t.monthly)}</div>
          <div className="text-xs text-mut2">{t.activeCount} active</div>
        </div>
        <div className="rounded-xl border border-line bg-card p-[18px]">
          <div className="text-[12.5px] text-mut">Per year</div>
          <div className="text-[34px] font-black tracking-[-0.02em]">{eur(t.yearly, 0)}</div>
          <div className="text-xs text-mut2">if nothing changes</div>
        </div>
        <div className="rounded-xl bg-inv p-[18px] text-white">
          <div className="text-[12.5px] text-white/60">Saved by stopping</div>
          <div className="text-[34px] font-black tracking-[-0.02em]">{eur(t.savedYearly, 0)}</div>
          <div className="text-xs font-bold text-acc2">per year</div>
        </div>
      </div>
      {myPrivate.length > 0 && (
        <div className="text-[12.5px] text-mut">
          Your private subscriptions ({eur(myPrivate.reduce((a, s) => a + s.monthly_price, 0))}/mo) are not in the family numbers.
        </div>
      )}

      <section className="rounded-[10px] border border-line bg-card px-5 pb-1 pt-2">
        <div className="flex flex-wrap items-center justify-between gap-2.5 pb-2 pt-3">
          <div>
            <h2 className="m-0 text-lg font-extrabold">Active</h2>
            <div className="mt-[3px] text-[12.5px] text-mut">Tap “Stopped” after you cancel one with the provider.</div>
          </div>
          <button
            onClick={() => openForm("sub")}
            className="h-11 whitespace-nowrap rounded-full border-0 bg-inv px-[18px] text-[13.5px] font-extrabold text-white"
          >
            + Add subscription
          </button>
        </div>
        {active.map(row)}
        {!active.length && (
          <div className="pb-4">
            <EmptyNote>Add Netflix, Spotify, phone plans… to see what they cost together.</EmptyNote>
          </div>
        )}
      </section>

      {stopped.length > 0 && (
        <section className="rounded-[10px] border border-line bg-card px-5 pb-1 pt-2">
          <h2 className="m-0 pb-2 pt-3 text-lg font-extrabold">Stopped</h2>
          {stopped.map(row)}
        </section>
      )}
      <p className="m-0 text-[12.5px] text-mut2">Nothing is cancelled for you — this only keeps track of what is still running.</p>
    </>
  );
}
