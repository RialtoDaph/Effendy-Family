"use client";

import { useEffect, useRef } from "react";

export type CloparMode = "calm" | "listen" | "think" | "speak" | "confirm";

export type Stage = { t: "effi"; e?: number } | { t: "orb" } | { t: "tree" } | { t: "text"; s: string; font?: string };
type Handle = { setMode: (mode: string) => void; go: (i: number) => void; setStages: (stages: Stage[]) => void; destroy: () => void };
type Engine = { create: (el: HTMLElement, opts: Record<string, unknown>) => Handle };

declare global {
  interface Window {
    RideffParticles?: Engine;
  }
}

// Options per place the character appears, as in the prototype.
const VARIANTS: Record<string, { stages: Stage[]; auto?: boolean; period?: number; n: number; sz: number; repel?: boolean }> = {
  sidebar: { stages: [{ t: "effi", e: 1.35 }], auto: false, n: 900, sz: 0.6 },
  hero: { stages: [{ t: "effi", e: 1 }], auto: false, n: 2200, sz: 0.9 },
  tab: { stages: [{ t: "effi", e: 1.35 }, { t: "orb" }], period: 7, n: 1000, sz: 0.6 },
  map: { stages: [{ t: "effi", e: 1.25 }], auto: false, n: 3200, sz: 0.7, repel: false },
};

let engine: Promise<Engine> | null = null;

/** Loads public/rideff-particles.js once, in the browser only. */
function loadEngine() {
  engine ??= new Promise((resolve, reject) => {
    if (window.RideffParticles) return resolve(window.RideffParticles);
    const script = document.createElement("script");
    script.src = "/rideff-particles.js";
    script.async = true;
    script.onload = () => resolve(window.RideffParticles!);
    script.onerror = () => {
      engine = null;
      reject(new Error("Particle engine failed to load"));
    };
    document.head.appendChild(script);
  });
  return engine;
}

const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Fills its positioned parent. With reduced motion only the confirm smile plays. */
export function Clopar({ variant, mode = "calm" }: { variant: keyof typeof VARIANTS; mode?: CloparMode }) {
  const host = useRef<HTMLSpanElement>(null);
  const handle = useRef<Handle | null>(null);
  const latestMode = useRef(mode);

  useEffect(() => {
    latestMode.current = mode;
    handle.current?.setMode(reducedMotion() && mode !== "confirm" ? "calm" : mode);
  }, [mode]);

  useEffect(() => {
    let alive = true;
    loadEngine()
      .then((e) => {
        if (!alive || !host.current) return;
        handle.current = e.create(host.current, VARIANTS[variant]);
        const m = latestMode.current;
        handle.current.setMode(reducedMotion() && m !== "confirm" ? "calm" : m);
      })
      .catch(() => {}); // the character is decoration; the app works without it
    return () => {
      alive = false;
      handle.current?.destroy();
      handle.current = null;
    };
  }, [variant]);

  return <span ref={host} aria-hidden className="absolute inset-0" />;
}

/** next/font renames the family, so the canvas needs the real name to draw numbers in the serif. */
function serifFamily() {
  return getComputedStyle(document.documentElement).getPropertyValue("--font-instrument-serif").trim() || "Georgia, serif";
}

const withFont = (stages: Stage[]) => stages.map((s) => (s.t === "text" ? { ...s, font: serifFamily() } : s));

/** The Home hero's particle stages. Fills its positioned parent; `stage` jumps to one, `onStage` reports the change. */
export function ParticleStages({ stages, stage, onStage }: { stages: Stage[]; stage: number; onStage: (i: number) => void }) {
  const host = useRef<HTMLDivElement>(null);
  const handle = useRef<Handle | null>(null);
  const latest = useRef({ stages, stage, onStage, shown: stage });

  useEffect(() => {
    latest.current.onStage = onStage;
    latest.current.stages = stages;
    handle.current?.setStages(withFont(stages));
  }, [stages, onStage]);

  useEffect(() => {
    if (latest.current.shown === stage) return;
    latest.current.shown = stage;
    handle.current?.go(stage);
  }, [stage]);

  useEffect(() => {
    let alive = true;
    loadEngine()
      .then((e) => {
        if (!alive || !host.current) return;
        handle.current = e.create(host.current, {
          stages: withFont(latest.current.stages),
          font: serifFamily(),
          onStage: (i: number) => {
            latest.current.shown = i;
            latest.current.onStage(i);
          },
        });
      })
      .catch(() => {});
    return () => {
      alive = false;
      handle.current?.destroy();
      handle.current = null;
    };
  }, []);

  return <div ref={host} aria-hidden className="absolute inset-0" />;
}
