"use client";

import { Check, Copy } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useToast } from "@/components/toast";
import { inboxScript } from "@/lib/inbox-script";
import { supabase } from "@/lib/supabase";

type Status = { created_at: string; last_used_at: string | null } | null;

const when = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Berlin" });

/** Settings → Inbox: make a key, copy the Apps Script, see when it last ran. */
export function InboxSection({ Section, Pill }: { Section: SectionLike; Pill: PillLike }) {
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
    if (status && !confirm("Make a new key? The script you set up before stops working until you paste the new one.")) return;
    setBusy(true);
    setError("");
    const { data, error } = await supabase().rpc("create_inbox_key");
    setBusy(false);
    if (error || typeof data !== "string") {
      setError(!navigator.onLine ? "This needs the internet." : `Could not make a key: ${error?.message ?? "no answer"}. Please send a screenshot of this.`);
      return;
    }
    setScript(inboxScript(window.location.origin, data));
    setCopied(false);
    void load();
  }

  async function disconnect() {
    if (!confirm("Disconnect your Gmail? The script stops sending mail. Your old digests stay until you delete them.")) return;
    const { error } = await supabase().rpc("revoke_inbox_key");
    if (error) return toast("Could not disconnect. Try again.");
    setScript("");
    void load();
    toast("Disconnected. You can also delete the project on script.google.com.");
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(script);
      setCopied(true);
    } catch {
      toast("Select the text and copy it by hand.");
    }
  }

  const connected = !!status?.last_used_at;
  return (
    <Section
      title="Inbox"
      sub="Rialna reads your new Gmail every morning and sums it up on Home. Only you see it."
      pill={<Pill tone={connected ? "ok" : "mut"}>{connected ? "Connected" : status ? "Waiting" : "Off"}</Pill>}
    >
      {status?.last_used_at && <div className="text-[13px] text-mut">Last digest: {when(status.last_used_at)}</div>}
      {status && !status.last_used_at && !script && (
        <div className="rounded-[10px] bg-soft p-3.5 text-[13px] leading-normal text-mut">
          A key exists but the script has not sent mail yet. If you lost the script, make a new key below.
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
            <li>Copy the script below. It holds your personal key, so do not share it.</li>
            <li>
              On a laptop, open{" "}
              <a href="https://script.google.com/home/projects/create" target="_blank" rel="noreferrer" className="font-bold underline">
                script.google.com
              </a>{" "}
              with your own Google account. A new project opens.
            </li>
            <li>Delete what is there, paste the script, and press Save (the disk icon).</li>
            <li>
              Above the code, choose <b>setup</b> and press <b>Run</b>.
            </li>
            <li>
              Google asks for access. Choose your account, then <b>Advanced → Go to project (unsafe)</b> and <b>Allow</b>. It says
              &quot;unsafe&quot; only because you wrote the script yourself instead of Google checking it.
            </li>
            <li>Done. Your first digest appears on Home within a minute, then every morning at about 06:00.</li>
          </ol>
          <div className="relative">
            <textarea
              readOnly
              value={script}
              rows={8}
              wrap="off"
              aria-label="Your inbox script"
              onFocus={(e) => e.currentTarget.select()}
              className="w-full resize-y rounded-[10px] border border-line bg-soft p-3 font-mono text-[11.5px] leading-snug text-ink outline-none"
            />
          </div>
          <button onClick={copy} className="flex min-h-12 items-center justify-center gap-2 rounded-full border-0 bg-acc text-sm font-extrabold text-onacc">
            {copied ? <Check size={16} /> : <Copy size={16} />}
            {copied ? "Copied" : "Copy script"}
          </button>
          <div className="text-xs text-mut2">This script is shown once. If you lose it, make a new key.</div>
        </div>
      ) : (
        <button
          onClick={makeKey}
          disabled={busy}
          className={`min-h-12 rounded-full text-sm font-extrabold disabled:opacity-60 ${
            status ? "border border-line bg-card text-ink" : "border-0 bg-acc text-onacc"
          }`}
        >
          {busy ? "Making your key…" : status ? "Make a new key and script" : "Connect my Gmail"}
        </button>
      )}
      {status && (
        <button onClick={disconnect} className="min-h-11 rounded-full border border-line bg-card text-[13px] font-bold text-bad">
          Disconnect
        </button>
      )}
      <div className="text-xs text-mut2">
        New mail without Promotions and Social is sent to the AI to be summed up. The partner never sees your digest. Digests are deleted
        after 60 days.
      </div>
    </Section>
  );
}

type SectionLike = (p: { title: string; sub?: string; pill?: React.ReactNode; children: React.ReactNode }) => React.ReactNode;
type PillLike = (p: { tone: "ok" | "mut"; children: React.ReactNode }) => React.ReactNode;
