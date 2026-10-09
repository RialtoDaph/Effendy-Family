// PIN lock, stored per device (README → Security: "a WebCrypto PBKDF2 hash with
// a salt on the device, never in plain text"). Works offline. Signing out or
// "Forgot PIN" removes it; the account password or passkey is the way back in.

export const PIN_LENGTH = 4;
const ITERATIONS = 310_000;

export type PinRecord = { hash: string; salt: string; iterations: number };

export type LockPrefs = {
  autoLockMin: 0 | 1 | 5; // lock again after leaving the app
  faceId: boolean; // offer passkey unlock on the lock screen
  failed: number;
  lockedUntil: number; // ms timestamp
};

export const DEFAULT_PREFS: LockPrefs = { autoLockMin: 0, faceId: false, failed: 0, lockedUntil: 0 };

const pinKey = (userId: string) => `ef-pin-${userId}`;
const prefsKey = (userId: string) => `ef-lock-${userId}`;

const b64 = (buf: ArrayBuffer | Uint8Array) => btoa(String.fromCharCode(...new Uint8Array(buf)));
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

export async function hashPin(pin: string, salt: Uint8Array, iterations = ITERATIONS) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(pin), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: salt as BufferSource, iterations },
    key,
    256,
  );
  return b64(bits);
}

export async function makePinRecord(pin: string): Promise<PinRecord> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return { hash: await hashPin(pin, salt), salt: b64(salt), iterations: ITERATIONS };
}

export async function checkPin(pin: string, rec: PinRecord) {
  const h = await hashPin(pin, unb64(rec.salt), rec.iterations);
  // Constant-time compare of two equal-length strings.
  let diff = h.length ^ rec.hash.length;
  for (let i = 0; i < Math.min(h.length, rec.hash.length); i++) diff |= h.charCodeAt(i) ^ rec.hash.charCodeAt(i);
  return diff === 0;
}

/** README: after 5 wrong tries wait 30 s, doubling each time. Returns ms to wait (0 = none). */
export function backoffMs(failed: number) {
  if (failed < 5) return 0;
  return 30_000 * 2 ** (failed - 5);
}

export function loadPin(userId: string): PinRecord | null {
  try {
    const raw = localStorage.getItem(pinKey(userId));
    return raw ? (JSON.parse(raw) as PinRecord) : null;
  } catch {
    return null;
  }
}

export function savePin(userId: string, rec: PinRecord | null) {
  try {
    if (rec) localStorage.setItem(pinKey(userId), JSON.stringify(rec));
    else localStorage.removeItem(pinKey(userId));
  } catch {}
}

export function loadPrefs(userId: string): LockPrefs {
  try {
    const raw = localStorage.getItem(prefsKey(userId));
    return raw ? { ...DEFAULT_PREFS, ...(JSON.parse(raw) as Partial<LockPrefs>) } : DEFAULT_PREFS;
  } catch {
    return DEFAULT_PREFS;
  }
}

export function savePrefs(userId: string, prefs: LockPrefs) {
  try {
    localStorage.setItem(prefsKey(userId), JSON.stringify(prefs));
  } catch {}
}

/** Removes every PIN and lock setting on this device (sign out / Forgot PIN). */
export function clearAllPins() {
  try {
    for (const k of Object.keys(localStorage)) {
      if (k.startsWith("ef-pin-") || k.startsWith("ef-lock-")) localStorage.removeItem(k);
    }
  } catch {}
}
