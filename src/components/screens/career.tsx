"use client";

import { Check } from "lucide-react";
import { useMoneyForms } from "@/components/money-forms";
import { useTime } from "@/components/time-data";
import { useToast } from "@/components/toast";
import { AddButton, Card, EmptyNote, PrivateMark, ProgressBar } from "@/components/ui";
import { QUEUED } from "@/lib/offline-queue";
import type { CareerStep } from "@/lib/time";
import { ModuleTabs } from "./module-tabs";
import { PageHeader } from "./page-header";

const NEXT_STATUS: Record<CareerStep["status"], CareerStep["status"]> = { next: "now", now: "done", done: "next" };
const STATUS_LABEL: Record<CareerStep["status"], string> = { done: "Done", now: "Doing now", next: "Next" };

export function CareerScreen() {
  const time = useTime();
  const { openForm } = useMoneyForms();
  const toast = useToast();
  const plans = [...new Set(time.careerSteps.map((s) => s.plan))];

  async function cycle(s: CareerStep) {
    const err = await time.save("career_steps", { status: NEXT_STATUS[s.status] }, s.id);
    if (err && err !== QUEUED) toast(err);
  }

  return (
    <>
      <div className="flex flex-col gap-3">
        <PageHeader eyebrow="Invest & career" title="Career" />
        <ModuleTabs module="invest" active="career" />
      </div>
      <div className="flex justify-end">
        <AddButton onClick={() => openForm("career")} label="+ Add step" />
      </div>
      {!plans.length && (
        <EmptyNote>
          Write down the stages of a plan, e.g. for RIDEFF Studio: business plan → tax number → Gewerbe → business account → first retainer
          clients. Tap a circle to move a step from Next to Doing now to Done.
        </EmptyNote>
      )}
      <div className="grid items-start gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(100%,380px),1fr))]">
        {plans.map((p) => {
          const steps = time.careerSteps.filter((s) => s.plan === p).sort((a, b) => a.sort - b.sort);
          const done = steps.filter((s) => s.status === "done").length;
          return (
            <Card key={p} className="flex flex-col gap-1">
              <div className="mb-1 flex items-baseline justify-between gap-2">
                <div className="text-[17px] font-extrabold">{p}</div>
                <span className="font-mono text-xs text-mut">
                  {done} of {steps.length}
                </span>
              </div>
              <ProgressBar pct={(done / Math.max(1, steps.length)) * 100} color="var(--ink)" />
              <ol className="m-0 mt-2 list-none p-0">
                {steps.map((s, i) => (
                  <li key={s.id} className="relative flex items-start gap-3 py-2.5">
                    {i < steps.length - 1 && <span aria-hidden className="absolute left-[15px] top-[38px] h-[calc(100%-22px)] w-0.5 bg-line" />}
                    <button
                      onClick={() => cycle(s)}
                      aria-label={`${s.title}: ${STATUS_LABEL[s.status]}. Tap to change.`}
                      className={`relative z-[1] flex h-8 w-8 flex-none items-center justify-center rounded-full border-2 ${
                        s.status === "done" ? "border-ink bg-ink text-white" : s.status === "now" ? "border-acc bg-tint text-acct" : "border-line2 bg-card"
                      }`}
                    >
                      {s.status === "done" ? <Check size={15} strokeWidth={3} /> : s.status === "now" ? <span className="h-2.5 w-2.5 rounded-full bg-acc" /> : null}
                    </button>
                    <button onClick={() => openForm("career", s.id)} className="min-w-0 flex-1 border-0 bg-transparent p-0 pt-1 text-left">
                      <div className={`text-[14.5px] font-bold ${s.status === "done" ? "text-mut" : "text-ink"}`}>{s.title}</div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-mut2">
                        <span>{STATUS_LABEL[s.status]}</span>
                        {s.timing && <span>· {s.timing}</span>}
                        {s.visibility === "private" && <PrivateMark />}
                      </div>
                    </button>
                  </li>
                ))}
              </ol>
              <button onClick={() => openForm("career", undefined, { plan: p })} className="mt-1 min-h-10 self-start rounded-full border-0 bg-tint px-3.5 text-[12.5px] font-extrabold text-acct">
                + Step in {p}
              </button>
            </Card>
          );
        })}
      </div>
    </>
  );
}
