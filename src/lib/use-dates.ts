"use client";

import { useLocale } from "next-intl";
import { useMemo } from "react";
import type { Today } from "./money";

const TAGS: Record<string, string> = { en: "en-GB", de: "de-DE", id: "id-ID" };

/** Date labels in the app's language. Dates are plain YYYY-MM-DD, so no time zone can shift them. */
export function useDates() {
  const locale = useLocale();
  return useMemo(() => {
    const tag = TAGS[locale] ?? locale;
    const fmt = (o: Intl.DateTimeFormatOptions) => {
      const f = new Intl.DateTimeFormat(tag, { ...o, timeZone: "UTC" });
      return { format: (d: Date) => f.format(d).replace("Sept", "Sep") };
    };
    const shortFmt = fmt({ day: "numeric", month: "short" });
    const fullFmt = fmt({ day: "numeric", month: "short", year: "numeric" });
    const monFmt = fmt({ month: "short" });
    const longFmt = fmt({ month: "long" });
    const myFmt = fmt({ month: "short", year: "numeric" });
    const fullMonthFmt = fmt({ month: "long", year: "numeric" });
    const dowFmt = fmt({ weekday: "short" });
    const dowLongFmt = fmt({ weekday: "long" });
    const dayFmt = fmt({ day: "numeric" });
    const numFmt = new Intl.NumberFormat(tag, { maximumFractionDigits: 1 });
    const at = (y: number, m: number, d = 15) => new Date(Date.UTC(y, m - 1, d));
    const parse = (iso: string) => {
      const [y, m, d] = iso.split("-").map(Number);
      return at(y, m, d || 15);
    };
    const dow = (iso: string) => dowFmt.format(parse(iso)).replace(".", "");
    return {
      /** "Wed" */
      dow,
      /** "Wednesday" */
      dowLong: (iso: string) => dowLongFmt.format(parse(iso)),
      /** "Wed 7 Oct" */
      day: (iso: string) => `${dow(iso)} ${shortFmt.format(parse(iso))}`,
      /** "5 – 11 Oct" or "28 Sep – 4 Oct". Built by hand: formatRange differs between Node and browsers. */
      weekRange: (from: string, to: string) =>
        `${from.slice(0, 7) === to.slice(0, 7) ? `${dayFmt.format(parse(from))}${locale === "de" ? "." : ""}` : shortFmt.format(parse(from))} – ${shortFmt.format(parse(to))}`,
      /** "October 2026" from YYYY-MM. */
      monthFull: (ym: string) => fullMonthFmt.format(parse(ym)),
      /** "1,234.5" in the app's language. */
      num: (n: number) => numFmt.format(n),
      /** "7 Oct" */
      short: (iso: string) => shortFmt.format(parse(iso)),
      /** "7 Oct 2026" */
      full: (iso: string) => fullFmt.format(parse(iso)),
      /** "Oct", for date tiles. */
      mon: (iso: string) => monFmt.format(parse(iso)).replace(".", ""),
      /** "October" from 1–12. */
      monthLong: (m: number) => longFmt.format(at(2026, m)),
      /** "Oct 2026" from YYYY-MM. */
      monthYear: (ym: string) => myFmt.format(parse(ym)),
      /** "Oct 2026", n months after today. */
      addMonths: (today: Today, n: number) => {
        const t = today.y * 12 + (today.m - 1) + n;
        return myFmt.format(at(Math.floor(t / 12), (t % 12) + 1));
      },
    };
  }, [locale]);
}
