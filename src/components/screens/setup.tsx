"use client";

import Link from "next/link";
import { useAppData } from "@/components/app-data";
import { useFinance } from "@/components/finance-data";
import { useMoney } from "@/components/money-data";
import { useMoneyForms } from "@/components/money-forms";
import { eur, plural } from "@/lib/money";

type Step = {
  title: string;
  sub: string;
  done: boolean;
  href: string;
  add?: () => void;
  phase?: number; // not available yet
};

export function useSetupSteps(): Step[] {
  const { members } = useAppData();
  const { incomes, categories, goals, recurring } = useMoney();
  const { openForm } = useMoneyForms();
  const { assets } = useFinance();
  const incomeTotal = incomes.reduce((a, i) => a + i.monthly_amount, 0);
  const realGoals = goals.filter((g) => !g.is_emergency_fund);

  return [
    {
      title: "Family members",
      sub: members.length >= 2 ? `${members.length} people` : `${members.length} of 2 · create the second account in Supabase`,
      done: members.length >= 2,
      href: "/settings",
    },
    {
      title: "Income sources",
      sub: `${plural(incomes.length, "source")} · ${eur(incomeTotal)} a month`,
      done: incomes.length > 0,
      href: "/budget",
      add: () => openForm("income"),
    },
    {
      title: "Bank statements",
      sub: "Upload a Sparkasse CSV or PDF and transactions sort themselves",
      done: false,
      href: "/import",
      phase: 3,
    },
    {
      title: "Budget categories",
      sub: `${plural(categories.length, "category", "categories")} · ${plural(recurring.length, "recurring payment")}`,
      done: categories.length > 0 && recurring.length > 0,
      href: "/budget",
      add: () => openForm("recur"),
    },
    {
      title: "Goals",
      sub: `${plural(realGoals.length, "goal")} · shared and private`,
      done: realGoals.length > 0,
      href: "/",
      add: () => openForm("goal"),
    },
    {
      title: "Savings & investments",
      sub: `${plural(assets.length, "account")} · update values once a month`,
      done: assets.length > 0,
      href: "/invest",
      add: () => openForm("asset"),
    },
    { title: "Bar shift schedule", sub: "Snap the Dienstplan, or add shifts by hand", done: false, href: "/shifts", phase: 4 },
    { title: "Yearly goals", sub: "Each with a weekly step", done: false, href: "/ygoals", phase: 4 },
  ];
}

export function SetupScreen() {
  const steps = useSetupSteps();
  const done = steps.filter((s) => s.done).length;

  return (
    <div className="flex max-w-[820px] flex-col gap-4">
      <div>
        <div className="eyebrow">Setup &amp; data</div>
        <h1 className="m-0 mt-1.5 text-[28px] font-extrabold leading-[1.1] tracking-[-0.02em] wide:text-[30px]">
          Put your real life in.
        </h1>
        <p className="m-0 mt-2 text-sm leading-[1.55] text-mut">
          Do this once, in any order. Everything stays editable: tap any row, amount or card to change it, or use the + button
          anywhere in the app.
        </p>
      </div>
      <section className="flex flex-col gap-2.5 rounded-[10px] border border-line bg-card p-5">
        <div className="flex flex-wrap justify-between gap-2.5">
          <span className="text-base font-extrabold">
            {done} of {steps.length} done
          </span>
          <span className="text-[13px] text-mut2">about 20 minutes in total</span>
        </div>
        <div className="h-2.5 overflow-hidden rounded-full bg-soft2">
          <div className="h-full rounded-full bg-acc" style={{ width: `${(done / steps.length) * 100}%` }} />
        </div>
      </section>
      <section className="rounded-[10px] border border-line bg-card px-5 py-1">
        {steps.map((s, i) => (
          <div key={s.title} className={`flex flex-wrap items-center gap-3.5 py-4 ${i < steps.length - 1 ? "border-b border-line" : ""}`}>
            <span
              className={`flex h-8 w-8 flex-none items-center justify-center rounded-full text-[13px] font-black ${
                s.done ? "bg-okbg text-ok" : "bg-soft2 text-mut"
              }`}
            >
              {s.done ? "✓" : i + 1}
            </span>
            <div className="min-w-[180px] flex-1">
              <div className="text-[15px] font-extrabold">{s.title}</div>
              <div className="mt-0.5 text-[12.5px] text-mut">{s.phase ? `Arrives in phase ${s.phase}` : s.sub}</div>
            </div>
            {!s.phase && (
              <div className="flex gap-1.5">
                {s.add && (
                  <button
                    onClick={s.add}
                    className="min-h-10 whitespace-nowrap rounded-full border-0 bg-tint px-3 text-[12.5px] font-extrabold text-acct"
                  >
                    + Add
                  </button>
                )}
                <Link
                  href={s.href}
                  className="flex min-h-10 items-center whitespace-nowrap rounded-full border border-line bg-card px-3.5 text-[12.5px] font-extrabold text-ink"
                >
                  Open →
                </Link>
              </div>
            )}
          </div>
        ))}
      </section>
      <div className="rounded-xl bg-tint px-[18px] py-4 text-sm leading-[1.55]">
        <b>Fastest start:</b> add your incomes, then rent, insurance and other monthly payments under Recurring. From then on
        the budget fills itself every month and you only add day-to-day spending.
      </div>
    </div>
  );
}
