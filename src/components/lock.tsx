"use client";

import { Delete, ScanFace } from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useAppData } from "@/components/app-data";
import { LogoTile } from "@/components/logo";
import { useToast } from "@/components/toast";
import {
  DEFAULT_PREFS,
  PIN_LENGTH,
  backoffMs,
  checkPin,
  clearAllPins,
  loadPin,
  loadPrefs,
  makePinRecord,
  savePin,
  savePrefs,
  type LockPrefs,
} from "@/lib/pin";
import { supabase } from "@/lib/supabase";

type Mode = "unlock" | "setup1" | "setup2" | "verify-change" | "verify-off";

type Lock = {
  hasPin: boolean;
  prefs: LockPrefs;
  setPrefs: (patch: Partial<LockPrefs>) => void;
  startSetup: () => void;
  startChange: () => void;
  startTurnOff: () => void;
  lockNow: () => void;
};

const LockContext = createContext<Lock | null>(null);

export function useLock() {
  const v = useContext(LockContext);
  if (!v) throw new Error("useLock must be used inside <LockProvider>");
  return v;
}

export function LockProvider({ children }: { children: ReactNode }) {
  const { userId, signOut } = useAppData();
  const toast = useToast();
  const [checked, setChecked] = useState(false);
  const [hasPin, setHasPin] = useState(false);
  const [prefs, setPrefsState] = useState<LockPrefs>(DEFAULT_PREFS);
  const [mode, setMode] = useState<Mode | null>(null);
  const hiddenAt = useRef<number | null>(null);

  // On start: lock if this device has a PIN for the signed-in person.
  useEffect(() => {
    if (!userId) return;
    const pin = loadPin(userId);
    // Reading device storage once the user is known.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHasPin(!!pin);
    setPrefsState(loadPrefs(userId));
    if (pin) setMode("unlock");
    setChecked(true);
  }, [userId]);

  // Auto-lock after leaving the app for the chosen time.
  useEffect(() => {
    if (!hasPin) return;
    const onVis = () => {
      if (document.visibilityState === "hidden") {
        hiddenAt.current = Date.now();
        if (prefs.autoLockMin === 0) setMode((m) => m ?? "unlock");
      } else if (hiddenAt.current) {
        const away = Date.now() - hiddenAt.current;
        hiddenAt.current = null;
        if (away >= prefs.autoLockMin * 60_000) setMode((m) => m ?? "unlock");
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [hasPin, prefs.autoLockMin]);

  const setPrefs = useCallback(
    (patch: Partial<LockPrefs>) => {
      setPrefsState((p) => {
        const next = { ...p, ...patch };
        savePrefs(userId, next);
        return next;
      });
    },
    [userId],
  );

  const value: Lock = {
    hasPin,
    prefs,
    setPrefs,
    startSetup: () => setMode("setup1"),
    startChange: () => setMode("verify-change"),
    startTurnOff: () => setMode("verify-off"),
    lockNow: () => hasPin && setMode("unlock"),
  };

  async function forgot() {
    if (!confirm("Sign in again with your password or Face ID to reset the PIN on this phone?")) return;
    clearAllPins();
    await signOut();
  }

  return (
    <LockContext value={value}>
      {children}
      {userId && !checked && <div className="fixed inset-0 z-[100] bg-bg" aria-hidden />}
      {mode && (
        <LockScreen
          key={mode}
          mode={mode}
          userId={userId}
          prefs={prefs}
          setPrefs={setPrefs}
          onForgot={forgot}
          onCancel={mode === "unlock" ? undefined : () => setMode(null)}
          onDone={(next) => {
            if (next === "pin-set") {
              setHasPin(true);
              toast("PIN lock is on");
            }
            if (next === "pin-off") {
              setHasPin(false);
              toast("PIN lock is off");
            }
            setMode(next === "setup" ? "setup1" : null);
          }}
        />
      )}
    </LockContext>
  );
}

type Done = "unlocked" | "pin-set" | "pin-off" | "setup";

function LockScreen({
  mode,
  userId,
  prefs,
  setPrefs,
  onForgot,
  onCancel,
  onDone,
}: {
  mode: Mode;
  userId: string;
  prefs: LockPrefs;
  setPrefs: (p: Partial<LockPrefs>) => void;
  onForgot: () => void;
  onCancel?: () => void;
  onDone: (d: Done) => void;
}) {
  const [step, setStep] = useState<Mode>(mode);
  const [digits, setDigits] = useState("");
  const [first, setFirst] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const waitMs = Math.max(0, prefs.lockedUntil - now);
  useEffect(() => {
    if (!waitMs) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [waitMs]);

  const titles: Record<Mode, [string, string]> = {
    unlock: ["Enter your PIN", "Effendy Family is locked"],
    setup1: ["Choose a PIN", `${PIN_LENGTH} digits, for this phone`],
    setup2: ["Enter it once more", "To make sure it is right"],
    "verify-change": ["Current PIN", "Before you choose a new one"],
    "verify-off": ["Current PIN", "To turn the PIN lock off"],
  };

  const submit = useCallback(
    async (pin: string) => {
      setBusy(true);
      try {
        if (step === "setup1") {
          setFirst(pin);
          setStep("setup2");
          return;
        }
        if (step === "setup2") {
          if (pin !== first) {
            setError("The PINs did not match. Try again.");
            setStep("setup1");
            return;
          }
          savePin(userId, await makePinRecord(pin));
          setPrefs({ failed: 0, lockedUntil: 0 });
          onDone("pin-set");
          return;
        }
        const rec = loadPin(userId);
        if (!rec) return onDone("unlocked");
        if (await checkPin(pin, rec)) {
          setPrefs({ failed: 0, lockedUntil: 0 });
          if (step === "verify-off") {
            savePin(userId, null);
            onDone("pin-off");
          } else onDone(step === "verify-change" ? "setup" : "unlocked");
        } else {
          const failed = prefs.failed + 1;
          const wait = backoffMs(failed);
          setPrefs({ failed, lockedUntil: wait ? Date.now() + wait : 0 });
          setNow(Date.now());
          setError(wait ? `Wrong PIN. Wait ${Math.round(wait / 1000)} seconds.` : `Wrong PIN. ${5 - failed > 0 ? `${5 - failed} tries left before a pause.` : ""}`);
        }
      } finally {
        setDigits("");
        setBusy(false);
      }
    },
    [step, first, userId, prefs.failed, setPrefs, onDone],
  );

  function press(d: string) {
    if (busy || waitMs) return;
    setError("");
    const next = (digits + d).slice(0, PIN_LENGTH);
    setDigits(next);
    if (next.length === PIN_LENGTH) setTimeout(() => submit(next), 120);
  }

  // Hardware keyboard on laptops.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (/^\d$/.test(e.key)) press(e.key);
      else if (e.key === "Backspace") setDigits((s) => s.slice(0, -1));
      else if (e.key === "Escape" && onCancel) onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  async function faceId() {
    setError("");
    const sb = supabase();
    const { data, error } = await sb.auth.signInWithPasskey();
    if (error || data?.user?.id !== userId) {
      setError(navigator.onLine ? "Face ID did not work. Use your PIN." : "Face ID needs the internet. Use your PIN.");
      return;
    }
    setPrefs({ failed: 0, lockedUntil: 0 });
    onDone("unlocked");
  }

  const showFace = step === "unlock" && prefs.faceId;
  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", showFace ? "face" : "", "0", "del"];

  return (
    <div
      data-noprint
      role="dialog"
      aria-modal="true"
      aria-label={titles[step][0]}
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-5 overflow-y-auto bg-bg px-6 pb-[calc(24px+env(safe-area-inset-bottom))] pt-[calc(24px+env(safe-area-inset-top))]"
    >
      <LogoTile size={52} />
      <div className="text-center">
        <div className="text-[22px] font-extrabold tracking-[-0.01em]">{titles[step][0]}</div>
        <div className="mt-1 text-[13.5px] text-mut">{titles[step][1]}</div>
      </div>
      <div className="flex gap-4" aria-label={`${digits.length} of ${PIN_LENGTH} digits entered`}>
        {Array.from({ length: PIN_LENGTH }, (_, i) => (
          <span key={i} className={`h-3.5 w-3.5 rounded-full border-2 border-ink ${i < digits.length ? "bg-ink" : "bg-transparent"}`} />
        ))}
      </div>
      <div className="min-h-5 text-center text-[13px] font-bold text-bad" role="alert">
        {waitMs ? `Too many tries. Wait ${Math.ceil(waitMs / 1000)} s.` : error}
      </div>
      <div className="grid grid-cols-[repeat(3,76px)] gap-x-[22px] gap-y-3.5">
        {keys.map((k, i) =>
          k === "" ? (
            <span key={i} />
          ) : (
            <button
              key={i}
              onClick={() => (k === "del" ? setDigits((s) => s.slice(0, -1)) : k === "face" ? faceId() : press(k))}
              disabled={!!waitMs && k !== "face"}
              aria-label={k === "del" ? "Delete" : k === "face" ? "Unlock with Face ID or fingerprint" : k}
              className={`flex h-[76px] w-[76px] items-center justify-center rounded-full border-0 text-[28px] font-semibold text-ink active:bg-line2 disabled:opacity-40 ${
                k === "del" || k === "face" ? "bg-transparent" : "bg-soft2"
              }`}
            >
              {k === "del" ? <Delete size={26} strokeWidth={1.8} /> : k === "face" ? <ScanFace size={28} strokeWidth={1.8} /> : k}
            </button>
          ),
        )}
      </div>
      {step === "unlock" || step.startsWith("verify") ? (
        <button onClick={onForgot} className="min-h-11 border-0 bg-transparent px-3 text-[13.5px] font-bold text-mut">
          Forgot PIN?
        </button>
      ) : null}
      {onCancel && (
        <button onClick={onCancel} className="min-h-11 border-0 bg-transparent px-3 text-[13.5px] font-bold text-mut">
          Cancel
        </button>
      )}
    </div>
  );
}
