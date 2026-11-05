import type { Locale } from "@/i18n/routing";

/** The proxy reads this cookie, so a reload brings every page back in the new language. */
export function switchLocale(locale: Locale) {
  document.cookie = `NEXT_LOCALE=${locale}; path=/; max-age=31536000; samesite=lax`;
  window.location.reload();
}
