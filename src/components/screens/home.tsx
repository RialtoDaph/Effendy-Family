"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { useAppData } from "@/components/app-data";
import { HOME } from "@/lib/nav";
import { ComingSoon } from "./placeholder";
import { PageHeader } from "./page-header";

const noop = () => () => {};

function useToday() {
  return useSyncExternalStore(
    noop,
    () =>
      new Date().toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "Europe/Berlin" }),
    () => "",
  );
}

function greeting(hour: number) {
  return hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
}

function useHour() {
  return useSyncExternalStore(
    noop,
    () => Number(new Date().toLocaleString("en-GB", { hour: "numeric", hour12: false, timeZone: "Europe/Berlin" })),
    () => 8,
  );
}

export function HomeScreen() {
  const { members } = useAppData();
  const today = useToday();
  const hour = useHour();
  const names = members.length ? members.map((m) => m.display_name).join(" & ") : "Rialto & Amnah";

  return (
    <>
      <PageHeader eyebrow={today || " "} title={`${greeting(hour)}, ${names}`} />
      <ComingSoon phase={HOME.phase} blurb={HOME.blurb} />
      <Link
        href="/setup"
        className="flex items-center gap-3.5 rounded-[10px] bg-inv px-5 py-[18px] text-left text-white"
      >
        <div className="min-w-0 flex-1">
          <div className="text-base font-extrabold">Setup checklist</div>
          <div className="mt-0.5 text-[13px] text-white/65">Where to put in your real data, step by step.</div>
        </div>
        <span className="font-extrabold text-acc2">→</span>
      </Link>
    </>
  );
}
