"use client";

import Link from "next/link";
import { LogOut, ScanFace, Trash, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useAiName, useAppData, type Member } from "@/components/app-data";
import { useLock } from "@/components/lock";
import { useInstall, useOnline, useStorageEstimate } from "@/components/pwa";
import { InviteSheet, ShareToggles } from "@/components/invite";
import { FormSheet, Sheet, Switch } from "@/components/sheet";
import { Avatar } from "@/components/shell/avatar";
import { LanguagePicker, PalettePicker } from "@/components/look-pickers";
import { THEME_OPTIONS, useTheme } from "@/components/theme";
import { useToast } from "@/components/toast";
import { enablePush, pushState, sendTestPush, type PushState } from "@/lib/push";
import { PLANS } from "@/lib/plans";
import { pending, QUEUE_EVENT } from "@/lib/offline-queue";
import { supabase } from "@/lib/supabase";
import { useDates } from "@/lib/use-dates";
import { Segmented } from "@/components/ui";
import { InboxSection } from "./inbox-settings";
import { PageHeader } from "./page-header";

function Section({ title, sub, pill, children }: { title: string; sub?: string; pill?: ReactNode; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3 rounded-[18px] border border-line bg-card p-5">
      <div className="flex items-start justify-between gap-2.5">
        <div>
          <h2 className="m-0 text-lg font-extrabold">{title}</h2>
          {sub && <div className="mt-[3px] text-[12.5px] text-mut">{sub}</div>}
        </div>
        {pill}
      </div>
      {children}
    </section>
  );
}

function Pill({ tone, children }: { tone: "ok" | "mut"; children: ReactNode }) {
  return (
    <span
      className={`whitespace-nowrap rounded-full px-2.5 py-1 font-mono text-[11.5px] font-bold ${
        tone === "ok" ? "bg-okbg text-ok" : "bg-soft2 text-mut"
      }`}
    >
      {children}
    </span>
  );
}

const primaryBtn = "min-h-11 rounded-[10px] border-0 bg-acc px-4 text-[13.5px] font-extrabold text-onacc";
const secondaryBtn = "min-h-11 rounded-[18px] border border-line bg-card px-4 text-[13.5px] font-bold text-ink";

const GROUPS = ["account", "ai", "look", "data", "help"] as const;
type Group = (typeof GROUPS)[number];

export function SettingsScreen() {
  const t = useTranslations("settings");
  const tc = useTranslations("copy");
  const tt = useTranslations("t");
  const aiName = useAiName();
  const { household, members, plan, bill, reload } = useAppData();
  const [group, setGroup] = useState<Group>("account");
  const [editing, setEditing] = useState<Member | null>(null);
  const toast = useToast();
  const groups = GROUPS.map((k) => ({ k, label: k === "ai" ? aiName : t(`g_${k}`), sub: t(`g_${k}_sub`) }));
  const linkCard = "flex items-center gap-3.5 rounded-[10px] border border-line bg-card px-5 py-4 text-left text-ink";

  return (
    <div className="flex flex-col gap-5">
      <PageHeader eyebrow={t("eyebrow", { plan: PLANS[plan].name })} title={t("title")} />
      <div className="flex flex-col gap-5 min-[900px]:flex-row min-[900px]:items-start">
        <nav aria-label={t("title")} className="flex gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:none] min-[900px]:w-[220px] min-[900px]:flex-none min-[900px]:flex-col">
          {groups.map((g) => {
            const on = g.k === group;
            return (
              <button
                key={g.k}
                onClick={() => setGroup(g.k)}
                aria-current={on ? "page" : undefined}
                className={`min-h-10 flex-none whitespace-nowrap rounded-full border-0 px-4 text-[13px] font-bold min-[900px]:rounded-[10px] min-[900px]:py-2.5 min-[900px]:text-left ${
                  on ? "bg-ink text-bg min-[900px]:bg-soft2 min-[900px]:text-ink" : "bg-soft2 text-ink min-[900px]:bg-transparent"
                }`}
              >
                {g.label}
                <span className="hidden text-xs font-medium text-mut min-[900px]:block">{g.sub}</span>
              </button>
            );
          })}
        </nav>

        <div className="grid min-w-0 flex-1 items-start gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(100%,340px),1fr))]">
          {group === "account" && (
            <>
              <Link href="/plan" className={`${linkCard} [grid-column:1/-1]`}>
                <span className="flex h-[42px] w-[42px] flex-none items-center justify-center rounded-[10px] bg-tint font-mono text-[13px] font-bold text-acct">{PLANS[plan].short}</span>
                <div className="min-w-0 flex-1">
                  <div className="text-base font-bold">{PLANS[plan].name}</div>
                  <div className="mt-0.5 text-[13px] text-mut">
                    {members.length} / {bill.seats}
                  </div>
                </div>
                <span className="whitespace-nowrap font-bold text-acct">{tt("planT")} →</span>
              </Link>
              <SignInSection />
              <SecuritySection />
              <MembersSection onEditSelf={setEditing} />
            </>
          )}
          {group === "ai" && (
            <>
              <AssistantSection />
              <MemorySection />
              <RemindersSection />
              <InboxSection Section={Section} Pill={Pill} />
            </>
          )}
          {group === "look" && (
            <>
              <AppearanceSection />
              <section className="rounded-[18px] border border-line bg-card p-5">
                <h2 className="m-0 mb-3 text-lg font-extrabold">{tc("language_region")}</h2>
                <LanguagePicker />
                <div className="flex justify-between px-0.5 pt-3.5 text-[13.5px]">
                  <span className="text-mut">{t("currency")}</span>
                  <span className="font-extrabold">Euro (€)</span>
                </div>
                {household?.home_city && (
                  <div className="flex justify-between px-0.5 pt-2.5 text-[13.5px]">
                    <span className="text-mut">{t("home")}</span>
                    <span className="font-extrabold">{t("germany", { city: household.home_city })}</span>
                  </div>
                )}
              </section>
            </>
          )}
          {group === "data" && (
            <>
              <DataSection />
              <OfflineSection />
            </>
          )}
          {group === "help" && (
            <>
              <Link href="/setup" className="flex items-center gap-3.5 rounded-[10px] bg-inv px-5 py-[18px] text-left text-white [grid-column:1/-1]">
                <div className="min-w-0 flex-1">
                  <div className="text-base font-extrabold">{t("setup_title")}</div>
                  <div className="mt-0.5 text-[13px] text-white/65">{t("setup_sub")}</div>
                </div>
                <span className="font-extrabold text-acc2">→</span>
              </Link>
              <Link href="/help" className={linkCard}>
                <div className="min-w-0 flex-1">
                  <div className="text-[15px] font-bold">{t("help_link")}</div>
                  <div className="mt-0.5 text-[13px] text-mut">{t("help_link_sub")}</div>
                </div>
                <span className="font-bold text-acct">→</span>
              </Link>
              <Link href="/reports" className={linkCard}>
                <div className="min-w-0 flex-1">
                  <div className="text-[15px] font-bold">{t("bug_link")}</div>
                  <div className="mt-0.5 text-[13px] text-mut">{t("bug_link_sub")}</div>
                </div>
                <span className="font-bold text-acct">→</span>
              </Link>
            </>
          )}
        </div>
      </div>

      {editing && (
        <FormSheet
          title={t("edit_member")}
          editing
          fields={[{ kind: "text", key: "name", label: t("name"), required: true }]}
          initial={{ name: editing.display_name }}
          onClose={() => setEditing(null)}
          onSave={async (v) => {
            const { error } = await supabase()
              .from("members")
              .update({ display_name: String(v.name).trim() })
              .eq("id", editing.id);
            if (error) return t("save_failed");
            setEditing(null);
            toast(t("saved"));
            await reload();
          }}
        />
      )}
    </div>
  );
}

/* Assistant: name, briefing form and time ------------------------------------- */

function AssistantSection() {
  const t = useTranslations("settings");
  const tt = useTranslations("t");
  const { userId, settings, reload } = useAppData();
  const aiName = useAiName();
  const toast = useToast();
  const [name, setName] = useState(aiName);
  const voice = settings?.voice ?? "text";
  const at = (settings?.brief_at ?? "07:00").slice(0, 5);

  async function save(patch: Record<string, string>) {
    const { error } = await supabase().from("member_settings").update(patch).eq("member_id", userId);
    if (error) return toast(t("save_failed"));
    await reload();
  }

  return (
    <Section title={t("ai_title")} sub={t("ai_sub")}>
      <label className="flex flex-col gap-1.5">
        <span className="text-[12.5px] font-bold text-mut">{t("ai_name")}</span>
        <input
          value={name}
          maxLength={40}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => name.trim() && name.trim() !== aiName && save({ ai_name: name.trim() })}
          className="h-[50px] w-full rounded-[10px] border border-line bg-soft px-3.5 text-base text-ink outline-none"
        />
      </label>
      <div className="flex flex-col gap-1.5">
        <span className="text-[12.5px] font-bold text-mut">{t("ai_voice")}</span>
        <Segmented
          value={voice}
          onChange={(v) => save({ voice: v })}
          options={[
            { value: "text", label: tt("text") },
            { value: "audio", label: tt("audio") },
            { value: "both", label: tt("both") },
          ]}
        />
      </div>
      <label className="flex flex-col gap-1.5">
        <span className="text-[12.5px] font-bold text-mut">{t("ai_time")}</span>
        <input
          type="time"
          defaultValue={at}
          onBlur={(e) => e.target.value && e.target.value !== at && save({ brief_at: e.target.value })}
          className="h-[50px] w-full rounded-[10px] border border-line bg-soft px-3.5 text-base text-ink outline-none"
        />
      </label>
    </Section>
  );
}

/* Your data: export / import ---------------------------------------------- */

const BACKUP_APP = "effendy-family";

type Memory = { id: string; text: string; scope: "private" | "shared"; owner_id: string; source: "voice" | "chat" | "manual"; created_at: string };

/** Settings → "What Clopar remembers". Private rows are the owner's alone (RLS). */
function MemorySection() {
  const aiName = useAiName();
  const t = useTranslations("assistant");
  const { userId, settings, members, reload } = useAppData();
  const dates = useDates();
  const toast = useToast();
  const [rows, setRows] = useState<Memory[]>([]);
  const [tab, setTab] = useState<"private" | "shared">("private");
  const [tick, setTick] = useState(0);
  const on = settings?.memory_on ?? true;
  const sharing = settings?.memory_shared ?? false;

  useEffect(() => {
    let alive = true;
    supabase()
      .from("ai_memories")
      .select("id,text,scope,owner_id,source,created_at")
      .order("created_at", { ascending: false })
      .then(({ data }) => alive && setRows((data ?? []) as Memory[]));
    return () => {
      alive = false;
    };
  }, [tick]);

  async function setFlag(patch: { memory_on?: boolean; memory_shared?: boolean }) {
    const { error } = await supabase().from("member_settings").update(patch).eq("member_id", userId);
    if (error) return toast(t("card_failed"));
    await reload();
  }
  async function run(q: PromiseLike<{ error: unknown }>) {
    const { error } = await q;
    if (error) toast(t("card_failed"));
    setTick((n) => n + 1);
  }
  const table = () => supabase().from("ai_memories");
  const forgetAll = (scope: Memory["scope"]) => confirm(t("mem_confirm")) && void run(table().delete().eq("owner_id", userId).eq("scope", scope));

  const list = rows.filter((m) => m.scope === tab);
  const sourceLabel = { voice: t("mem_voice"), chat: t("mem_chat"), manual: t("mem_manual") };
  const mine = list.some((m) => m.owner_id === userId);

  return (
    <section data-screen-label="Settings · Memory" className="flex flex-col gap-3.5 rounded-[18px] border border-line bg-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="m-0 text-lg font-bold">{t("mem_title", { name: aiName })}</h2>
          <div className="mt-[3px] text-[12.5px] text-mut [text-wrap:pretty]">{t("mem_sub")}</div>
        </div>
        <button role="switch" aria-checked={on} aria-label={t("mem_toggle")} onClick={() => setFlag({ memory_on: !on })} className="flex-none border-0 bg-transparent p-0">
          <Switch on={on} />
        </button>
      </div>
      {!on ? (
        <div className="py-1.5 text-[13.5px] text-mut">{t("mem_off", { name: aiName })}</div>
      ) : (
        <>
          <div className="self-start">
            <Segmented value={tab} onChange={setTab} options={[{ value: "private", label: t("mem_private") }, { value: "shared", label: t("mem_shared") }]} />
          </div>
          {tab === "shared" && (
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-bold">{t("mem_share_on")}</div>
                <div className="mt-0.5 text-xs text-mut2">{t("mem_share_hint")}</div>
              </div>
              <button role="switch" aria-checked={sharing} aria-label={t("mem_share_on")} onClick={() => setFlag({ memory_shared: !sharing })} className="flex-none border-0 bg-transparent p-0">
                <Switch on={sharing} />
              </button>
            </div>
          )}
          <div className="flex flex-col">
            {list.map((m) => {
              const own = m.owner_id === userId;
              const who = own ? t("mem_from_you") : t("mem_from", { name: members.find((x) => x.id === m.owner_id)?.display_name ?? "" });
              return (
                <div key={m.id} className="flex flex-wrap items-start gap-3 border-t border-line py-3">
                  <div className="min-w-[160px] flex-1">
                    <div className="text-sm leading-[1.45] [text-wrap:pretty]">{m.text}</div>
                    <div className="mt-[3px] text-xs text-mut2">
                      {who} · {sourceLabel[m.source]} · {dates.short(m.created_at.slice(0, 10))}
                    </div>
                  </div>
                  {own && (
                    <div className="flex flex-none items-center gap-1.5">
                      <button
                        onClick={() => run(table().update({ scope: m.scope === "private" ? "shared" : "private" }).eq("id", m.id))}
                        className="min-h-9 whitespace-nowrap rounded-full border border-line bg-card px-3 text-xs font-bold text-ink"
                      >
                        {t(m.scope === "private" ? "mem_share" : "mem_make_private")}
                      </button>
                      <button onClick={() => run(table().delete().eq("id", m.id))} aria-label={t("mem_forget")} className="flex h-9 w-9 items-center justify-center rounded-full border-0 bg-soft2 text-ink">
                        <X size={15} />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
            {!list.length && <div className="border-t border-line py-3 text-[13.5px] text-mut">{tab === "private" ? t("mem_empty_private", { name: aiName }) : t("mem_empty_shared")}</div>}
          </div>
          {mine && (
            <button onClick={() => forgetAll(tab)} className="min-h-11 self-start border-0 bg-transparent text-[13px] font-bold text-bad">
              {t(tab === "private" ? "mem_forget_private" : "mem_forget_shared")}
            </button>
          )}
        </>
      )}
    </section>
  );
}

function DataSection() {
  const t = useTranslations("settings");
  const { me, members, household, settings, reload } = useAppData();
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState("");
  const [armed, setArmed] = useState(false);
  const [resetting, setResetting] = useState(false);

  async function reset() {
    if (!armed) return setArmed(true);
    setResetting(true);
    const { error } = await supabase().rpc("reset_my_data");
    setResetting(false);
    setArmed(false);
    toast(error ? t("reset_failed") : t("reset_done"));
    // Every data provider reads again.
    if (!error) window.location.reload();
  }

  async function exportData() {
    const { data: memories } = await supabase().from("ai_memories").select("text,scope,kind,source,created_at").eq("owner_id", me?.id ?? "");
    const backup = {
      app: BACKUP_APP,
      version: 1,
      exported_at: new Date().toISOString(),
      exported_by: me?.display_name,
      household,
      members,
      settings,
      memories,
    };
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `rideff-life-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast(t("backup_done"));
  }

  async function importData(file: File) {
    setMsg("");
    let data: Record<string, unknown>;
    try {
      data = JSON.parse(await file.text());
    } catch {
      setMsg(t("backup_bad"));
      return;
    }
    if (data.app !== BACKUP_APP) {
      setMsg(t("backup_bad"));
      return;
    }
    if (!confirm(t("backup_confirm"))) return;

    const sb = supabase();
    const errors: string[] = [];
    const hh = data.household as { name?: string; home_city?: string } | null;
    if (hh && household) {
      const { error } = await sb
        .from("households")
        .update({ name: hh.name ?? household.name, home_city: hh.home_city ?? household.home_city })
        .eq("id", household.id);
      if (error) errors.push("household");
    }
    const s = data.settings as Record<string, unknown> | null;
    if (s && me) {
      const pick = ["theme", "palette", "default_visibility", "notif", "warn_pct", "ef_months"] as const;
      const patch = Object.fromEntries(pick.filter((k) => k in s).map((k) => [k, s[k]]));
      const { error } = await sb.from("member_settings").update(patch).eq("member_id", me.id);
      if (error) errors.push("settings");
    }
    const mine = (data.members as Member[] | undefined)?.find((m) => m.id === me?.id);
    if (mine && me) {
      const { error } = await sb.from("members").update({ display_name: mine.display_name }).eq("id", me.id);
      if (error) errors.push("profile");
    }
    await reload();
    if (errors.length) setMsg(t("backup_partial", { parts: errors.join(", ") }));
    else toast(t("backup_restored"));
  }

  return (
    <Section title={t("data_title")} sub={t("data_sub")} pill={<Pill tone="ok">{t("synced")}</Pill>}>
      <div className="grid gap-2 [grid-template-columns:repeat(auto-fit,minmax(min(100%,150px),1fr))]">
        <button onClick={exportData} className={primaryBtn}>
          {t("export")}
        </button>
        <button onClick={() => fileRef.current?.click()} className={secondaryBtn}>
          {t("import")}
        </button>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) importData(f);
        }}
      />
      <div className="text-xs text-mut2">{t("backup_note")}</div>
      {msg && <div className="text-[12.5px] font-bold text-bad">{msg}</div>}
      <button onClick={reset} disabled={resetting} className="min-h-11 rounded-[18px] border border-line bg-card px-4 text-[13.5px] font-bold text-bad disabled:opacity-60">
        {armed ? t("reset_sure") : t("reset")}
      </button>
      <div className="text-xs text-mut2">{t("reset_note")}</div>
    </Section>
  );
}

/* Members and invites -------------------------------------------------------- */

type OpenInvite = { id: string; name: string; used_at: string | null; expires_at: string };

export function MembersSection({ onEditSelf }: { onEditSelf?: (m: Member) => void }) {
  const t = useTranslations();
  const { members, me, reload } = useAppData();
  const toast = useToast();
  const [invites, setInvites] = useState<OpenInvite[]>([]);
  const [seats, setSeats] = useState<number | null>(null);
  const [inviting, setInviting] = useState(false);
  const [sharing, setSharing] = useState<Member | null>(null);
  const [share, setShare] = useState<Record<string, boolean>>({});

  const [tick, setTick] = useState(0);
  const load = () => setTick((n) => n + 1);

  useEffect(() => {
    const sb = supabase();
    let alive = true;
    Promise.all([
      sb.from("invites").select("id, name, used_at, expires_at").is("used_at", null),
      sb.from("subscriptions_billing").select("seats").maybeSingle(),
    ]).then(([i, b]) => {
      if (!alive) return;
      setInvites(((i.data ?? []) as OpenInvite[]).filter((x) => new Date(x.expires_at) > new Date()));
      setSeats((b.data as { seats: number } | null)?.seats ?? null);
    });
    return () => {
      alive = false;
    };
  }, [tick]);

  const canInvite = me?.role === "owner" || me?.role === "partner";
  const roleLabel = (r: string) => (r === "owner" ? t("ui.role_owner") : r === "partner" ? t("copy.partner") : t("copy.family_viewer"));

  function open(m: Member) {
    if (m.id === me?.id) return onEditSelf?.(m);
    if (me?.role === "owner") {
      setShare(m.share);
      setSharing(m);
    }
  }

  async function saveShare() {
    if (!sharing) return;
    const { error } = await supabase().rpc("set_member_share", { p_member: sharing.id, p_share: share });
    if (error) return toast(t("ui.invite_failed"));
    toast(t("ui.saved"));
    setSharing(null);
    reload();
  }

  async function revoke(id: string) {
    await supabase().rpc("revoke_invite", { p_id: id });
    load();
  }

  return (
    <section className="rounded-[18px] border border-line bg-card p-5">
      <h2 className="m-0 mb-1.5 text-lg font-extrabold">{t("copy.members")}</h2>
      {members.map((m) => (
        <button
          key={m.id}
          onClick={() => open(m)}
          className="flex w-full items-center gap-3 border-0 border-b border-line bg-transparent py-3 text-left"
        >
          <Avatar member={m} size={40} />
          <div className="min-w-0 flex-1">
            <div className="text-[14.5px] font-bold text-ink">
              {m.display_name}
              {m.id === me?.id && <span className="font-semibold text-mut2"> · {t("ui.you")}</span>}
            </div>
            <div className="truncate text-xs text-mut2">{m.email}</div>
          </div>
          <span className="rounded-full bg-soft2 px-[9px] py-[3px] text-[11px] font-bold text-mut">{roleLabel(m.role)}</span>
        </button>
      ))}
      {invites.map((i) => (
        <div key={i.id} className="flex items-center gap-3 border-b border-line py-3">
          <div className="min-w-0 flex-1">
            <div className="truncate text-[14.5px] font-bold text-ink">{i.name}</div>
            <div className="text-xs text-mut2">{t("ui.invited_pending")}</div>
          </div>
          {canInvite && (
            <button
              onClick={() => revoke(i.id)}
              aria-label={t("ui.remove_invite", { name: i.name })}
              className="flex h-10 w-10 flex-none items-center justify-center rounded-full border border-line bg-card text-mut"
            >
              <Trash size={16} strokeWidth={2} />
            </button>
          )}
        </div>
      ))}
      {seats !== null && (
        <div className="mt-3.5 text-[12.5px] text-mut">{t("ui.seats_used", { used: members.length + invites.length, seats })}</div>
      )}
      {canInvite && (
        <button
          onClick={() => setInviting(true)}
          className="mt-3 min-h-[46px] rounded-full border-0 bg-acc px-5 text-sm font-bold text-onacc"
        >
          {t("ui.invite_person")}
        </button>
      )}
      {inviting && <InviteSheet onClose={() => setInviting(false)} onCreated={load} />}
      {sharing && (
        <Sheet title={t("ui.what_x_can_see", { name: sharing.display_name })} onClose={() => setSharing(null)}>
          <ShareToggles share={share} onChange={setShare} />
          <button onClick={saveShare} className="min-h-[52px] rounded-full border-0 bg-acc text-[15px] font-bold text-onacc">
            {t("copy.done")}
          </button>
        </Sheet>
      )}
    </section>
  );
}

/* Appearance ---------------------------------------------------------------- */

function AppearanceSection() {
  const t = useTranslations();
  const { pref, setTheme, isNoir } = useTheme();
  return (
    <Section title={t("copy.appearance")} sub={t("copy.auto_follows_your_phone_or_laptop_setting")}>
      {isNoir ? (
        <div className="py-2.5 text-[13px] text-mut">{t("copy.noir_is_always_dark_pick_another_palette_below_to_choose")}</div>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {THEME_OPTIONS.map((o) => (
            <button
              key={o.value}
              onClick={() => setTheme(o.value)}
              className={`flex min-h-11 flex-col items-center gap-2 rounded-[10px] border-2 bg-card px-2 py-3.5 text-[13px] font-bold text-ink ${
                pref === o.value ? "border-acc" : "border-line"
              }`}
            >
              <o.icon size={20} strokeWidth={2} />
              {t(o.key)}
            </button>
          ))}
        </div>
      )}
      <div className="mt-1 text-[12.5px] font-bold text-mut">{t("t.themes")}</div>
      <PalettePicker />
    </Section>
  );
}

/* Sign-in: passkeys + sign out --------------------------------------------- */

type Passkey = { id: string; friendly_name?: string; created_at: string; last_used_at?: string };

function SignInSection() {
  const t = useTranslations("settings");
  const dates = useDates();
  const { me, signOut } = useAppData();
  const toast = useToast();
  const online = useOnline();
  const [keys, setKeys] = useState<Passkey[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [version, setVersion] = useState(0);
  const load = () => setVersion((v) => v + 1);

  useEffect(() => {
    if (!online) return;
    let alive = true;
    supabase()
      .auth.passkey.list()
      .then(({ data, error }) => alive && setKeys(error ? [] : ((data ?? []) as Passkey[])));
    return () => {
      alive = false;
    };
  }, [online, version]);

  async function add() {
    setBusy(true);
    const { error } = await supabase().auth.registerPasskey();
    setBusy(false);
    if (error) {
      const code = (error as { code?: string }).code;
      toast(
        code === "passkey_disabled" ? t("pk_off") : code === "webauthn_credential_exists" ? t("pk_exists") : t("pk_failed"),
      );
      return;
    }
    toast(t("pk_added"));
    load();
  }

  async function remove(k: Passkey) {
    if (!confirm(t("pk_remove_q", { name: k.friendly_name ?? t("pk") }))) return;
    const { error } = await supabase().auth.passkey.delete({ passkeyId: k.id });
    if (error) toast(t("pk_remove_failed"));
    load();
  }

  return (
    <Section title={t("signin")} sub={me?.email ? t("signed_as", { email: me.email }) : t("your_account")}>
      <div>
        {(keys ?? []).map((k) => (
          <div key={k.id} className="flex items-center gap-3 border-b border-line py-3">
            <ScanFace size={20} strokeWidth={1.8} className="flex-none text-mut" />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-bold">{k.friendly_name ?? t("pk")}</div>
              <div className="mt-0.5 text-xs text-mut">
                {t("pk_added_on", { date: dates.full(k.created_at.slice(0, 10)) })}
              </div>
            </div>
            <button
              onClick={() => remove(k)}
              aria-label={t("pk_remove")}
              className="flex h-10 w-10 items-center justify-center rounded-full border-0 bg-transparent text-mut"
            >
              <Trash size={17} />
            </button>
          </div>
        ))}
        {keys?.length === 0 && (
          <div className="text-[13px] text-mut">{t("pk_intro")}</div>
        )}
      </div>
      <button onClick={add} disabled={busy || !online} className={`${primaryBtn} flex items-center justify-center gap-2 disabled:opacity-60`}>
        <ScanFace size={18} />
        {busy ? t("pk_wait") : t("pk_add")}
      </button>
      <button onClick={signOut} className={`${secondaryBtn} flex items-center justify-center gap-2`}>
        <LogOut size={16} />
        {t("sign_out")}
      </button>
    </Section>
  );
}

/* Offline & install -------------------------------------------------------- */

function OfflineSection() {
  const t = useTranslations("settings");
  const online = useOnline();
  const [queued, setQueued] = useState(0);
  useEffect(() => {
    const count = () => void pending().then((q) => setQueued(q.length));
    count();
    window.addEventListener(QUEUE_EVENT, count);
    return () => window.removeEventListener(QUEUE_EVENT, count);
  }, []);
  const bytes = useStorageEstimate();
  const { canInstall, install, standalone, ios } = useInstall();
  const toast = useToast();

  const rows: [string, string][] = [
    [t("connection"), online ? t("online") : t("offline")],
    [t("installed"), standalone ? t("installed_yes") : t("installed_no")],
    [t("storage"), bytes == null ? "—" : `${(bytes / 1024 / 1024).toFixed(1)} MB`],
    [t("waiting_sync"), String(queued)],
  ];

  return (
    <Section
      title={t("off_title")}
      sub={t("off_sub")}
      pill={<Pill tone={online ? "ok" : "mut"}>{online ? t("online") : t("offline")}</Pill>}
    >
      <div>
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-2.5 border-b border-line py-2.5 text-[13.5px]">
            <span className="text-mut">{k}</span>
            <span className="text-right font-extrabold">{v}</span>
          </div>
        ))}
      </div>
      {canInstall && (
        <button
          onClick={async () => (await install()) && toast(t("install_done"))}
          className="min-h-12 rounded-full border-0 bg-inv text-sm font-extrabold text-white"
        >
          {t("install")}
        </button>
      )}
      {!standalone && !canInstall && (
        <div className="flex flex-col gap-2 rounded-[10px] bg-soft p-3.5">
          <div className="text-[13px] font-extrabold">{t("home_screen")}</div>
          <div className="text-[13px] leading-normal text-mut">
            {ios ? (
              <>
                {t("ios1")}
                <br />
                {t("ios2")}
                <br />
                {t("ios3")}
              </>
            ) : (
              <>
                {t("and1")}
                <br />
                {t("and2")}
                <br />
                {t("and3")}
              </>
            )}
          </div>
        </div>
      )}
    </Section>
  );
}

/* Security: PIN lock + Face ID unlock, per device ---------------------------- */

function SecuritySection() {
  const t = useTranslations("settings");
  const lock = useLock();
  const toast = useToast();
  const online = useOnline();

  async function toggleFace() {
    if (lock.prefs.faceId) return lock.setPrefs({ faceId: false });
    if (!online) return toast(t("sec_net"));
    const { data } = await supabase().auth.passkey.list();
    if (!data?.length) return toast(t("sec_add_first"));
    lock.setPrefs({ faceId: true });
  }

  const rows = [
    {
      label: t("pin"),
      sub: lock.hasPin ? t("pin_on") : t("pin_off"),
      on: lock.hasPin,
      toggle: () => (lock.hasPin ? lock.startTurnOff() : lock.startSetup()),
    },
    ...(lock.hasPin
      ? [
          {
            label: t("face"),
            sub: t("face_sub"),
            on: lock.prefs.faceId,
            toggle: toggleFace,
          },
        ]
      : []),
  ];

  return (
    <Section title={t("sec_title")} sub={t("sec_sub")}>
      <div>
        {rows.map((r) => (
          <div key={r.label} className="flex items-center gap-3 border-b border-line py-3">
            <div className="min-w-0 flex-1">
              <div className="text-sm font-bold">{r.label}</div>
              <div className="mt-0.5 text-xs text-mut">{r.sub}</div>
            </div>
            <button onClick={r.toggle} aria-label={r.label} aria-pressed={r.on} className="flex-none border-0 bg-transparent p-0">
              <Switch on={r.on} />
            </button>
          </div>
        ))}
      </div>
      {lock.hasPin && (
        <>
          <div className="text-[12.5px] font-bold text-mut">{t("relock")}</div>
          <div className="grid grid-cols-3 gap-1 rounded-[10px] bg-soft2 p-1">
            {([0, 1, 5] as const).map((m) => {
              const on = lock.prefs.autoLockMin === m;
              return (
                <button
                  key={m}
                  onClick={() => lock.setPrefs({ autoLockMin: m })}
                  aria-pressed={on}
                  className={`min-h-10 rounded-lg border-0 text-[13px] font-bold ${
                    on ? "bg-card text-ink shadow-[0_1px_3px_rgba(0,0,0,.12)]" : "bg-transparent text-mut"
                  }`}
                >
                  {m === 0 ? t("right_away") : t("min", { n: m })}
                </button>
              );
            })}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={lock.lockNow} className="min-h-11 rounded-[10px] border-0 bg-inv text-[13.5px] font-extrabold text-white">
              {t("lock_now")}
            </button>
            <button onClick={lock.startChange} className={secondaryBtn}>
              {t("change_pin")}
            </button>
          </div>
        </>
      )}
    </Section>
  );
}

/* Reminders: Web Push to this phone ---------------------------------------- */

const NOTIF_ROWS = ["bills", "tax", "shifts", "budget", "goals"] as const;

const PUSH_PILL: Record<PushState, ["p_on" | "p_off" | "p_blocked" | "p_unsupported", "ok" | "mut"]> = {
  on: ["p_on", "ok"],
  off: ["p_off", "mut"],
  blocked: ["p_blocked", "mut"],
  unsupported: ["p_unsupported", "mut"],
};

function RemindersSection() {
  const t = useTranslations("settings");
  const { userId, settings, reload } = useAppData();
  const { ios, standalone } = useInstall();
  const toast = useToast();
  const [state, setState] = useState<PushState | null>(null);
  const [busy, setBusy] = useState(false);
  const [local, setLocal] = useState<Record<string, unknown> | null>(null);
  const notif = { bills: true, tax: true, shifts: true, budget: true, goals: true, ...settings?.notif, ...local };

  const refresh = useCallback(() => {
    pushState().then(setState);
  }, []);
  useEffect(refresh, [refresh]);

  async function save(patch: Record<string, unknown>) {
    const next = { ...notif, ...patch };
    setLocal(next);
    const { error } = await supabase().from("member_settings").update({ notif: next }).eq("member_id", userId);
    if (error) {
      setLocal(null);
      return toast(t("save_failed"));
    }
    await reload();
  }

  async function allow() {
    setBusy(true);
    const err = await enablePush();
    setBusy(false);
    refresh();
    toast(err ? t(err) : t("p_enabled"));
  }

  async function test() {
    setBusy(true);
    const err = await sendTestPush();
    setBusy(false);
    toast(err ? t(err) : t("p_test_sent"));
  }

  const [label, tone] = state ? [t(PUSH_PILL[state][0]), PUSH_PILL[state][1]] : ["…", "mut" as const];
  const needsHomeScreen = ios && !standalone;

  return (
    <Section title={t("rem_title")} sub={t("rem_sub")} pill={<Pill tone={tone}>{label}</Pill>}>
      {needsHomeScreen ? (
        <div className="rounded-[10px] bg-soft p-3.5 text-[13px] leading-normal text-mut">
          {t("p_ios")}
        </div>
      ) : state === "off" ? (
        <button onClick={allow} disabled={busy} className="min-h-12 rounded-full border-0 bg-acc text-sm font-extrabold text-onacc disabled:opacity-60">
          {t("p_allow")}
        </button>
      ) : state === "blocked" ? (
        <div className="rounded-[10px] bg-soft p-3.5 text-[13px] leading-normal text-mut">
          {t("p_blocked_note")}
        </div>
      ) : state === "unsupported" ? (
        <div className="rounded-[10px] bg-soft p-3.5 text-[13px] leading-normal text-mut">
          {t("p_unsupported_note")}
        </div>
      ) : null}
      <div>
        {NOTIF_ROWS.map((k) => {
          const on = !!notif[k];
          const title = t(`n_${k}`);
          return (
            <div key={k} className="flex items-center gap-3 border-b border-line py-3">
              <div className="min-w-0 flex-1">
                <div className="text-sm font-bold">{title}</div>
                <div className="mt-0.5 text-xs text-mut">{k === "budget" ? t("n_budget_sub", { pct: settings?.warn_pct ?? 80 }) : t(`n_${k}_sub`)}</div>
              </div>
              <button onClick={() => save({ [k]: !on })} aria-label={title} aria-pressed={on} className="flex-none border-0 bg-transparent p-0">
                <Switch on={on} />
              </button>
            </div>
          );
        })}
      </div>
      {state === "on" && (
        <button onClick={test} disabled={busy} className={`${secondaryBtn} disabled:opacity-60`}>
          {t("p_test")}
        </button>
      )}
      <div className="text-xs text-mut2">{t("p_own")}</div>
    </Section>
  );
}
