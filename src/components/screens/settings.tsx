"use client";

import Link from "next/link";
import { LogOut, ScanFace, Trash } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useAppData, type Member } from "@/components/app-data";
import { useLock } from "@/components/lock";
import { useInstall, useOnline, useStorageEstimate } from "@/components/pwa";
import { FormSheet, Switch } from "@/components/sheet";
import { Avatar } from "@/components/shell/avatar";
import { THEME_OPTIONS, useTheme } from "@/components/theme";
import { useToast } from "@/components/toast";
import { supabase } from "@/lib/supabase";
import { PageHeader } from "./page-header";

function Section({ title, sub, pill, children }: { title: string; sub?: string; pill?: ReactNode; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3 rounded-[10px] border border-line bg-card p-5">
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
const secondaryBtn = "min-h-11 rounded-[10px] border border-line bg-card px-4 text-[13.5px] font-bold text-ink";

export function SettingsScreen() {
  const { me, members, household, reload } = useAppData();
  const [editing, setEditing] = useState<Member | null>(null);
  const toast = useToast();

  return (
    <div className="flex flex-col gap-4">
      <PageHeader eyebrow="RIDEFF Life · Life Together" title="Settings" />
      <Link href="/setup" className="flex items-center gap-3.5 rounded-[10px] bg-inv px-5 py-[18px] text-left text-white">
        <div className="min-w-0 flex-1">
          <div className="text-base font-extrabold">Setup checklist</div>
          <div className="mt-0.5 text-[13px] text-white/65">Where to put in your real data, step by step.</div>
        </div>
        <span className="font-extrabold text-acc2">→</span>
      </Link>

      <div className="grid items-start gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(100%,360px),1fr))]">
        <DataSection />
        <AppearanceSection />
        <SignInSection />
        <SecuritySection />
        <OfflineSection />

        <section className="rounded-[10px] border border-line bg-card p-5">
          <h2 className="m-0 mb-1.5 text-lg font-extrabold">Members</h2>
          {members.map((m) => (
            <button
              key={m.id}
              onClick={() => (m.id === me?.id ? setEditing(m) : toast(`Only ${m.display_name} can edit this profile.`))}
              className="flex w-full items-center gap-3 border-0 border-b border-line bg-transparent py-3 text-left"
            >
              <Avatar member={m} size={40} />
              <div className="min-w-0 flex-1">
                <div className="text-[14.5px] font-bold text-ink">
                  {m.display_name}
                  {m.id === me?.id && <span className="font-semibold text-mut2"> · you</span>}
                </div>
                <div className="truncate text-xs text-mut2">{m.email}</div>
              </div>
              <span className="rounded-full bg-soft2 px-[9px] py-[3px] text-[11px] font-bold capitalize text-mut">{m.role}</span>
            </button>
          ))}
          <div className="mt-3.5 text-[12.5px] text-mut">
            {members.length} of 2 people. The household is just the two of you.
          </div>
        </section>

        <section className="rounded-[10px] border border-line bg-card p-5">
          <h2 className="m-0 mb-3 text-lg font-extrabold">Language &amp; region</h2>
          <div className="flex min-h-12 items-center gap-3 rounded-[10px] border-2 border-acc px-3.5 py-3 text-sm font-bold">
            <span className="flex-1">English</span>
            <span className="text-xs font-semibold text-mut2">✓ App language</span>
          </div>
          <div className="flex justify-between px-0.5 pt-3.5 text-[13.5px]">
            <span className="text-mut">Currency</span>
            <span className="font-extrabold">Euro (€)</span>
          </div>
          <div className="flex justify-between px-0.5 pt-2.5 text-[13.5px]">
            <span className="text-mut">Home</span>
            <span className="font-extrabold">{household?.home_city ?? "Eichstätt"}, Germany</span>
          </div>
        </section>
      </div>

      {editing && (
        <FormSheet
          title="Edit member"
          editing
          fields={[{ kind: "text", key: "name", label: "Name", required: true }]}
          initial={{ name: editing.display_name }}
          onClose={() => setEditing(null)}
          onSave={async (v) => {
            const { error } = await supabase()
              .from("members")
              .update({ display_name: String(v.name).trim() })
              .eq("id", editing.id);
            if (error) return "Could not save. Check your internet connection.";
            setEditing(null);
            toast("Saved");
            await reload();
          }}
        />
      )}
    </div>
  );
}

/* Your data: export / import ---------------------------------------------- */

const BACKUP_APP = "effendy-family";

function DataSection() {
  const { me, members, household, settings, reload } = useAppData();
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState("");

  function exportData() {
    const backup = {
      app: BACKUP_APP,
      version: 1,
      exported_at: new Date().toISOString(),
      exported_by: me?.display_name,
      household,
      members,
      settings,
    };
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `effendy-family-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast("Backup downloaded");
  }

  async function importData(file: File) {
    setMsg("");
    let data: Record<string, unknown>;
    try {
      data = JSON.parse(await file.text());
    } catch {
      setMsg("That file is not a backup from this app.");
      return;
    }
    if (data.app !== BACKUP_APP) {
      setMsg("That file is not a backup from this app.");
      return;
    }
    if (!confirm("Replace your settings with the ones in this backup?")) return;

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
    if (errors.length) setMsg(`Some parts could not be restored: ${errors.join(", ")}.`);
    else toast("Backup restored");
  }

  return (
    <Section title="Your data" sub="Saved to your private database in Frankfurt." pill={<Pill tone="ok">Synced</Pill>}>
      <div className="grid gap-2 [grid-template-columns:repeat(auto-fit,minmax(min(100%,150px),1fr))]">
        <button onClick={exportData} className={primaryBtn}>
          Export backup
        </button>
        <button onClick={() => fileRef.current?.click()} className={secondaryBtn}>
          Import backup
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
      <div className="text-xs text-mut2">
        The backup is a JSON file. It holds what you can see: private items of your partner are never in it.
      </div>
      {msg && <div className="text-[12.5px] font-bold text-bad">{msg}</div>}
    </Section>
  );
}

/* Appearance ---------------------------------------------------------------- */

function AppearanceSection() {
  const { pref, setTheme } = useTheme();
  return (
    <Section title="Appearance" sub="Auto follows your phone or laptop setting. Saved on this device.">
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
            {o.label}
          </button>
        ))}
      </div>
    </Section>
  );
}

/* Sign-in: passkeys + sign out --------------------------------------------- */

type Passkey = { id: string; friendly_name?: string; created_at: string; last_used_at?: string };

function SignInSection() {
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
        code === "passkey_disabled"
          ? "Face ID sign-in is not switched on in Supabase yet."
          : code === "webauthn_credential_exists"
            ? "This device is already added."
            : "Face ID / fingerprint was not added.",
      );
      return;
    }
    toast("Face ID / fingerprint added");
    load();
  }

  async function remove(k: Passkey) {
    if (!confirm(`Remove ${k.friendly_name ?? "this passkey"}?`)) return;
    const { error } = await supabase().auth.passkey.delete({ passkeyId: k.id });
    if (error) toast("Could not remove it.");
    load();
  }

  return (
    <Section title="Sign-in" sub={me?.email ? `Signed in as ${me.email}` : "Your account"}>
      <div>
        {(keys ?? []).map((k) => (
          <div key={k.id} className="flex items-center gap-3 border-b border-line py-3">
            <ScanFace size={20} strokeWidth={1.8} className="flex-none text-mut" />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-bold">{k.friendly_name ?? "Passkey"}</div>
              <div className="mt-0.5 text-xs text-mut">
                Added {new Date(k.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
              </div>
            </div>
            <button
              onClick={() => remove(k)}
              aria-label="Remove passkey"
              className="flex h-10 w-10 items-center justify-center rounded-full border-0 bg-transparent text-mut"
            >
              <Trash size={17} />
            </button>
          </div>
        ))}
        {keys?.length === 0 && (
          <div className="text-[13px] text-mut">
            Sign in with Face ID or your fingerprint instead of typing your password. Add it once on each phone or
            laptop.
          </div>
        )}
      </div>
      <button onClick={add} disabled={busy || !online} className={`${primaryBtn} flex items-center justify-center gap-2 disabled:opacity-60`}>
        <ScanFace size={18} />
        {busy ? "Waiting for your device…" : "Add Face ID / fingerprint"}
      </button>
      <button onClick={signOut} className={`${secondaryBtn} flex items-center justify-center gap-2`}>
        <LogOut size={16} />
        Sign out
      </button>
    </Section>
  );
}

/* Offline & install -------------------------------------------------------- */

function OfflineSection() {
  const online = useOnline();
  const bytes = useStorageEstimate();
  const { canInstall, install, standalone, ios } = useInstall();
  const toast = useToast();

  const rows: [string, string][] = [
    ["Connection", online ? "Online" : "Offline"],
    ["Installed", standalone ? "Yes, on this device" : "Not yet"],
    ["Storage used", bytes == null ? "—" : `${(bytes / 1024 / 1024).toFixed(1)} MB`],
  ];

  return (
    <Section
      title="Offline & install"
      sub="The app opens without internet. Saving, Ask Rialna and bank import need a connection."
      pill={<Pill tone={online ? "ok" : "mut"}>{online ? "Online" : "Offline"}</Pill>}
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
          onClick={async () => (await install()) && toast("Installed")}
          className="min-h-12 rounded-full border-0 bg-inv text-sm font-extrabold text-white"
        >
          Install on this phone
        </button>
      )}
      {!standalone && !canInstall && (
        <div className="flex flex-col gap-2 rounded-[10px] bg-soft p-3.5">
          <div className="text-[13px] font-extrabold">Put it on your Home Screen</div>
          <div className="text-[13px] leading-normal text-mut">
            {ios ? (
              <>
                1. Open this page in Safari
                <br />
                2. Tap Share (the square with the arrow)
                <br />
                3. Choose “Add to Home Screen”
              </>
            ) : (
              <>
                1. Open this page in Chrome
                <br />
                2. Tap the ⋮ menu
                <br />
                3. Choose “Add to Home screen” or “Install app”
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
  const lock = useLock();
  const toast = useToast();
  const online = useOnline();

  async function toggleFace() {
    if (lock.prefs.faceId) return lock.setPrefs({ faceId: false });
    if (!online) return toast("Turning this on needs the internet.");
    const { data } = await supabase().auth.passkey.list();
    if (!data?.length) return toast("Add Face ID / fingerprint under Sign-in first.");
    lock.setPrefs({ faceId: true });
  }

  const rows = [
    {
      label: "PIN lock",
      sub: lock.hasPin ? "On · asked when the app opens" : "Off · anyone holding this phone can open the app",
      on: lock.hasPin,
      toggle: () => (lock.hasPin ? lock.startTurnOff() : lock.startSetup()),
    },
    ...(lock.hasPin
      ? [
          {
            label: "Face ID / fingerprint",
            sub: "Unlock without typing the PIN (needs the internet)",
            on: lock.prefs.faceId,
            toggle: toggleFace,
          },
        ]
      : []),
  ];

  return (
    <Section title="Security" sub="The PIN is kept on this phone only, as a secure hash.">
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
          <div className="text-[12.5px] font-bold text-mut">Lock again after leaving the app</div>
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
                  {m === 0 ? "Right away" : `${m} min`}
                </button>
              );
            })}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={lock.lockNow} className="min-h-11 rounded-[10px] border-0 bg-inv text-[13.5px] font-extrabold text-white">
              Lock now
            </button>
            <button onClick={lock.startChange} className={secondaryBtn}>
              Change PIN
            </button>
          </div>
        </>
      )}
    </Section>
  );
}
