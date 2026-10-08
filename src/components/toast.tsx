"use client";

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";

const ToastContext = createContext<(msg: string) => void>(() => {});

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [msg, setMsg] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const show = useCallback((m: string) => {
    clearTimeout(timer.current);
    setMsg(m);
    timer.current = setTimeout(() => setMsg(null), 3800);
  }, []);

  return (
    <ToastContext value={show}>
      {children}
      {msg && (
        <div
          data-noprint
          role="status"
          className="fixed left-1/2 top-[calc(66px+env(safe-area-inset-top))] z-[90] flex w-max max-w-[min(92vw,460px)] -translate-x-1/2 items-center gap-2.5 rounded-xl bg-inv px-4 py-3 text-[13.5px] font-bold leading-[1.4] text-white shadow-[0_10px_30px_rgba(0,0,0,.25)] wide:top-5"
        >
          <span className="h-2 w-2 flex-none rounded-full bg-acc2" />
          <span>{msg}</span>
        </div>
      )}
    </ToastContext>
  );
}
