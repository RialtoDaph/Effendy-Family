import { defineRouting } from "next-intl/routing";

// URLs stay clean (/budget, not /de/budget): the proxy rewrites to the language
// in the NEXT_LOCALE cookie, so each page is prerendered once per language.
export const routing = defineRouting({
  locales: ["en", "de", "id"],
  defaultLocale: "en",
  localePrefix: "never",
  localeCookie: { maxAge: 60 * 60 * 24 * 365 },
});

export type Locale = (typeof routing.locales)[number];
