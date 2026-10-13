"use client";

import { ChevronDown, ExternalLink, Mail } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useAppData } from "@/components/app-data";
import { useMoney } from "@/components/money-data";
import { useMoneyForms } from "@/components/money-forms";
import { gmailLink, senderName, type InboxDigest, type InboxItem } from "@/lib/inbox";
import { eur, shortDate } from "@/lib/money";
import { supabase } from "@/lib/supabase";
import { addDays } from "@/lib/time";

const ACTION_LABEL = { event: "Add to calendar", recurring: "Add as monthly payment", tax: "Add tax deadline" } as const;
const cacheKey = (userId: string) => `ef-inbox-${userId}`;

/** Home: today's Gmail digest of the person signed in (never the partner's). */
export function InboxCard() {
  const { userId } = useAppData();
  const { today } = useMoney();
  const [digest, setDigest] = useState<InboxDigest | null>(null);
  const [showRest, setShowRest] = useState(false);

  useEffect(() => {
    if (!userId) return;
    try {
      const raw = localStorage.getItem(cacheKey(userId));
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (raw) setDigest(JSON.parse(raw) as InboxDigest);
    } catch {}
    supabase()
      .from("inbox_digests")
      .select("day,account,summary,items,mail_count,created_at")
      .eq("owner_id", userId)
      .order("day", { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) return; // offline: keep the copy on this phone
        setDigest(data as InboxDigest | null);
        try {
          if (data) localStorage.setItem(cacheKey(userId), JSON.stringify(data));
          else localStorage.removeItem(cacheKey(userId));
        } catch {}
      });
  }, [userId]);

  if (!digest || today.y < 2026 || digest.day < addDays(today.iso, -2)) return null;
  const important = digest.items.filter((i) => i.group === "important");
  const dated = digest.items.filter((i) => i.group === "dated");
  const rest = digest.items.filter((i) => i.group === "rest");
  const dayLabel = digest.day === today.iso ? "this morning" : shortDate(digest.day);

  return (
    <section className="flex flex-col gap-3 rounded-[10px] border border-line bg-card p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="m-0 flex items-center gap-2 text-lg font-extrabold tracking-[-0.01em]">
          <Mail size={18} strokeWidth={2.2} /> Inbox
        </h2>
        <span className="font-mono text-xs text-mut">
          {digest.mail_count} new · {dayLabel}
        </span>
      </div>
      <p className="m-0 text-[14.5px] leading-normal text-ink">{digest.summary}</p>

      {important.length > 0 && <Group title="Needs you" items={important} account={digest.account} />}
      {dated.length > 0 && <Group title="Has a date" items={dated} account={digest.account} />}

      {rest.length > 0 && (
        <div className="border-t border-line pt-2.5">
          <button
            onClick={() => setShowRest((v) => !v)}
            aria-expanded={showRest}
            className="flex min-h-10 w-full items-center justify-between border-0 bg-transparent p-0 text-left text-[13px] font-bold text-mut"
          >
            {rest.length} other {rest.length === 1 ? "email" : "emails"}, nothing to do
            <ChevronDown size={16} className={showRest ? "rotate-180" : ""} />
          </button>
          {showRest && (
            <ul className="m-0 mt-1 flex list-none flex-col gap-1.5 p-0">
              {rest.map((i) => (
                <li key={i.id} className="flex items-baseline gap-2 text-[13px]">
                  <a href={gmailLink(i.thread, digest.account)} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate text-ink hover:underline">
                    {i.title}
                  </a>
                  <span className="flex-none truncate text-xs text-mut2">{senderName(i.from)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      <div className="text-xs text-mut2">
        Only you see this.{" "}
        <Link href="/settings" className="underline">
          Inbox settings
        </Link>
      </div>
    </section>
  );
}

function Group({ title, items, account }: { title: string; items: InboxItem[]; account: string | null }) {
  const { openForm } = useMoneyForms();
  function act(i: InboxItem) {
    const a = i.action;
    if (a.kind === "event") openForm("event", undefined, { title: a.title, ...(a.date ? { date: a.date } : {}), ...(a.time ? { start: a.time } : {}) });
    if (a.kind === "recurring")
      openForm("recur", undefined, { name: a.title, kind: "out", ...(a.amount ? { amount: String(a.amount) } : {}), ...(a.day ? { day: String(a.day) } : {}) });
    if (a.kind === "tax") openForm("deadline", undefined, { title: a.title, ...(a.date ? { date: a.date } : {}), ...(a.amount ? { amount: String(a.amount) } : {}) });
  }
  return (
    <div className="flex flex-col gap-2">
      <div className="font-mono text-[11px] font-bold uppercase tracking-[.12em] text-mut2">{title}</div>
      {items.map((i) => (
        <div key={i.id} className="flex flex-col gap-1.5 rounded-[10px] bg-soft p-3">
          <div className="text-[14px] font-bold leading-snug text-ink">{i.title}</div>
          <div className="text-[12.5px] leading-snug text-mut">
            {senderName(i.from)}
            {i.why ? ` · ${i.why}` : ""}
          </div>
          <div className="mt-0.5 flex flex-wrap gap-1.5">
            <a
              href={gmailLink(i.thread, account)}
              target="_blank"
              rel="noreferrer"
              className="flex min-h-9 items-center gap-1.5 rounded-full border border-line bg-card px-3 text-[12px] font-bold text-ink"
            >
              <ExternalLink size={13} /> Open in Gmail
            </a>
            {i.action.kind !== "none" && (
              <button onClick={() => act(i)} className="min-h-9 rounded-full border-0 bg-tint px-3 text-[12px] font-extrabold text-acct">
                {ACTION_LABEL[i.action.kind]}
                {i.action.kind === "recurring" && i.action.amount ? ` · ${eur(i.action.amount)}` : ""}
                {i.action.kind !== "recurring" && i.action.date ? ` · ${shortDate(i.action.date)}` : ""}
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
