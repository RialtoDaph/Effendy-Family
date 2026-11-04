import type { BrowserContext, Page } from "@playwright/test";

export const STUB = "http://localhost:54399";
export const LOCALES = ["en", "de", "id"] as const;
export const SCREENS = [
  "", "map", "budget", "debts", "import", "recur", "remit", "biz", "tax", "week", "shifts", "ygoals", "learn", "invest", "sim", "career",
  "gym", "together", "journal", "alerts", "report", "reports", "ask", "whatif", "setup", "settings", "plan", "help", "more",
];
/** Module screens that open empty on a fresh account. */
export const MODULES = ["budget", "debts", "recur", "remit", "biz", "tax", "week", "shifts", "ygoals", "learn", "invest", "sim", "career", "gym", "together", "journal", "report", "whatif"];


/** Starts signed in, as the stub's owner. */
export async function signIn(context: BrowserContext, locale = "en") {
  await context.addCookies([{ name: "NEXT_LOCALE", value: locale, url: "http://localhost:3100" }]);
  const session = await (await fetch(`${STUB}/__session`)).json();
  await context.addInitScript((s) => localStorage.setItem("sb-localhost-auth-token", JSON.stringify(s)), session);
}

export const setData = (mode: "seed" | "clear") => fetch(`${STUB}/__${mode}`);
export const setPlan = (plan: string) => fetch(`${STUB}/__plan?p=${plan}`);

/** Waits until the screen has drawn its data. */
export async function settle(page: Page) {
  await page.waitForLoadState("load");
  await page.waitForTimeout(900);
}
