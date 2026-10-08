"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

/* Online / offline --------------------------------------------------------- */

function subscribeOnline(cb: () => void) {
  window.addEventListener("online", cb);
  window.addEventListener("offline", cb);
  return () => {
    window.removeEventListener("online", cb);
    window.removeEventListener("offline", cb);
  };
}

export function useOnline() {
  return useSyncExternalStore(
    subscribeOnline,
    () => navigator.onLine,
    () => true,
  );
}

/* Service worker ----------------------------------------------------------- */

export function useServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {});
  }, []);
}

/* Install ------------------------------------------------------------------ */

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

let deferred: InstallEvent | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferred = e as InstallEvent;
    notify();
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    notify();
  });
}

const noop = () => () => {};

function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function isIos() {
  return (
    /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

function subscribeInstall(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function useInstall() {
  const canInstall = useSyncExternalStore(
    subscribeInstall,
    () => deferred !== null,
    () => false,
  );
  const standalone = useSyncExternalStore(noop, isStandalone, () => false);
  const ios = useSyncExternalStore(noop, isIos, () => false);

  async function install() {
    if (!deferred) return false;
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    deferred = null;
    notify();
    return outcome === "accepted";
  }

  return { canInstall, install, standalone, ios };
}

/** Rough size of what this site keeps on the device. */
export function useStorageEstimate() {
  const [bytes, setBytes] = useState<number | null>(null);
  useEffect(() => {
    navigator.storage?.estimate?.().then((e) => setBytes(e.usage ?? null)).catch(() => {});
  }, []);
  return bytes;
}
