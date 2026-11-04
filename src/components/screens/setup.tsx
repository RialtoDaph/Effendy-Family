"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useAppData } from "@/components/app-data";
import { useFinance } from "@/components/finance-data";
import { useMoney } from "@/components/money-data";
import { useMoneyForms } from "@/components/money-forms";
import { SampleDataButton } from "@/components/sample-data";
import { useTime } from "@/components/time-data";
import { eur } from "@/lib/money";

type Step = {
  title: string;
  sub: string;
  done: boolean;
  href: string;
  add?: () => void;
};

export function useSetupSteps(): Step[] {
  const t = useTranslations("tools");
  const { members } = useAppData();
  const { incomes, categories, goals, recurring } = useMoney();
  const { openForm } = useMoneyForms();
  const { assets } = useFinance();
  const { events, yearlyGoals } = useTime();
  const incomeTotal = incomes.reduce((a, i) => a + i.monthly_amount, 0);
  const realGoals = goals.filter((g) => !g.is_emergency_fund);

  return [
    { title: t("su_members"), sub: t("su_members_sub", { n: members.length }), done: members.length >= 2, href: "/settings" },
    {
      title: t("su_income"),
      sub: t("su_income_sub", { n: incomes.length, total: eur(incomeTotal) }),
      done: incomes.length > 0,
      href: "/budget",
      add: () => openForm("income"),
    },
    { title: t("su_bank"), sub: t("su_bank_sub"), done: false, href: "/import" },
    {
      title: t("su_budget"),
      sub: t("su_budget_sub", { cats: categories.length, rec: recurring.length }),
      done: categories.length > 0 && recurring.length > 0,
      href: "/budget",
      add: () => openForm("recur"),
    },
    { title: t("su_goals"), sub: t("su_goals_sub", { n: realGoals.length }), done: realGoals.length > 0, href: "/", add: () => openForm("goal") },
    { title: t("su_assets"), sub: t("su_assets_sub", { n: assets.length }), done: assets.length > 0, href: "/invest", add: () => openForm("asset") },
    { title: t("su_shifts"), sub: t("su_shifts_sub"), done: events.some((e) => e.kind === "shift"), href: "/shifts" },
    { title: t("su_ygoals"), sub: t("su_ygoals_sub"), done: yearlyGoals.length > 0, href: "/ygoals" },
  ];
}

export function SetupScreen() {
  const t = useTranslations("tools");
  const steps = useSetupSteps();
  const done = steps.filter((s) => s.done).length;

  return (
    <div className="flex max-w-[820px] flex-col gap-4">
      <div>
        <div className="eyebrow">{t("su_eyebrow")}</div>
        <h1 className="m-0 mt-1.5 text-[28px] font-extrabold leading-[1.1] tracking-[-0.02em] wide:text-[30px]">
          {t("su_title")}
        </h1>
        <p className="m-0 mt-2 text-sm leading-[1.55] text-mut">
          {t("su_sub")}
        </p>
      </div>
      <SampleDataButton />
      <section className="flex flex-col gap-2.5 rounded-[18px] border border-line bg-card p-5">
        <div className="flex flex-wrap justify-between gap-2.5">
          <span className="text-base font-extrabold">
            {t("su_done", { done, total: steps.length })}
          </span>
          <span className="text-[13px] text-mut2">{t("su_time")}</span>
        </div>
        <div className="h-2.5 overflow-hidden rounded-full bg-soft2">
          <div className="h-full rounded-full bg-acc" style={{ width: `${(done / steps.length) * 100}%` }} />
        </div>
      </section>
      <section className="rounded-[18px] border border-line bg-card px-5 py-1">
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
              <div className="mt-0.5 text-[12.5px] text-mut">{s.sub}</div>
            </div>
            <div className="flex gap-1.5">
                {s.add && (
                  <button
                    onClick={s.add}
                    className="min-h-10 whitespace-nowrap rounded-full border-0 bg-tint px-3 text-[12.5px] font-extrabold text-acct"
                  >
                    {t("su_add")}
                  </button>
                )}
                <Link
                  href={s.href}
                  className="hit44 flex min-h-10 items-center whitespace-nowrap rounded-full border border-line bg-card px-3.5 text-[12.5px] font-extrabold text-ink"
                >
                  {t("su_open")}
                </Link>
              </div>
          </div>
        ))}
      </section>
      <div className="rounded-xl bg-tint px-[18px] py-4 text-sm leading-[1.55]">
        {t.rich("su_tip", { b: (c) => <b>{c}</b> })}
      </div>
    </div>
  );
}
