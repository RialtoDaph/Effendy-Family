import fs from "node:fs";
import { expect, test } from "@playwright/test";
import { LOCALES, MODULES, SCREENS, setData, setPlan, settle, signIn } from "./helpers";

const OUT = "test-results/qa";
fs.mkdirSync(`${OUT}/shots`, { recursive: true });
const texts: Record<string, Record<string, string[]>> = {};
const small: Record<string, string[]> = {};

test.beforeAll(async () => {
  await setPlan("together");
  await setData("seed");
});

for (const locale of LOCALES) {
  test(`every screen, ${locale}`, async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, serviceWorkers: "block" });
    await signIn(context, locale);
    const page = await context.newPage();
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(`${page.url()} ${e.message}`));
    page.on("console", (m) => {
      if (m.type() === "error" && !/503|Failed to load resource/.test(m.text())) errors.push(`${page.url()} ${m.text()}`);
    });
    const wide: string[] = [];
    texts[locale] = {};
    for (const screen of SCREENS) {
      await page.goto(`/${screen}`);
      await settle(page);
      for (const width of [390, 360]) {
        await page.setViewportSize({ width, height: 844 });
        await page.waitForTimeout(150);
        const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        if (over > 0) wide.push(`${screen || "home"}@${width}: +${over}px`);
      }
      await page.setViewportSize({ width: 390, height: 844 });
      await page.screenshot({ path: `${OUT}/shots/${locale}-${screen || "home"}.png`, fullPage: screen !== "map" });
      const seen = await page.evaluate(() => {
        const out = { lines: document.body.innerText.split("\n").map((s) => s.trim()).filter(Boolean), small: [] as string[], fonts: [] as string[], keys: [] as string[] };
        for (const el of document.querySelectorAll<HTMLElement>("a, input, select, textarea")) {
          const r = el.getBoundingClientRect();
          if (!r.width) continue;
          if (el.tagName === "A" && r.height < 44 && !el.classList.contains("hit44") && !el.closest("p")) out.small.push(`${el.textContent?.trim().slice(0, 30)} ${Math.round(r.height)}px`);
          if (el.tagName !== "A" && parseFloat(getComputedStyle(el).fontSize) < 16 && (el as HTMLInputElement).type !== "range") out.fonts.push(`${el.tagName} ${(el as HTMLInputElement).name || (el as HTMLInputElement).placeholder}`);
        }
        return out;
      });
      texts[locale][screen || "home"] = seen.lines;
      if (locale === "en") small[screen || "home"] = [...seen.small, ...seen.fonts.map((f) => `font<16: ${f}`)];
      const raw = seen.lines.filter((l) => /^(t|nav|copy|ui|money|time|home|assistant|settings|empty)\.[a-zA-Z_]+$/.test(l) || l.includes("MISSING_MESSAGE"));
      expect(raw, `${locale}/${screen}`).toEqual([]);
    }
    await context.close();
    fs.writeFileSync(`${OUT}/texts-${locale}.json`, JSON.stringify(texts[locale]));
    if (locale === "en") fs.writeFileSync(`${OUT}/small.json`, JSON.stringify(small, null, 1));
    expect(errors).toEqual([]);
    expect(wide).toEqual([]);
  });
}

test("empty states on a fresh account", async ({ browser }) => {
  await setData("clear");
  const missing: string[] = [];
  for (const locale of LOCALES) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, serviceWorkers: "block" });
    await signIn(context, locale);
    const page = await context.newPage();
    for (const screen of MODULES) {
      await page.goto(`/${screen}`);
      await settle(page);
      const n = await page.locator('[data-screen-label="Empty state"]').count();
      if (!n) missing.push(`${locale}/${screen}`);
      if (locale === "en") await page.screenshot({ path: `${OUT}/shots/empty-${screen}.png` });
      const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      if (over > 0) missing.push(`${locale}/${screen} overflow +${over}`);
    }
    await context.close();
  }
  await setData("seed");
  expect(missing).toEqual([]);
});

test("gates follow the plan", async ({ browser }) => {
  const context = await browser.newContext({ serviceWorkers: "block" });
  await signIn(context);
  const page = await context.newPage();
  await setPlan("life");
  for (const screen of ["map", "journal", "tax", "together"]) {
    await page.goto(`/${screen}`);
    await expect(page.locator('[data-screen-label="Upsell"]')).toBeVisible();
  }
  await page.goto("/budget");
  await settle(page);
  await expect(page.locator('[data-screen-label="Upsell"]')).toHaveCount(0);
  await setPlan("together");
  await context.close();
});
