import { expect, test } from "@playwright/test";
import { STUB, setData, setPlan, settle, signIn } from "./helpers";

test("opens offline and syncs what was added", async ({ browser }) => {
  await setPlan("together");
  await setData("seed");
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "allow" });
  await signIn(context);
  const page = await context.newPage();
  await page.goto("/gym");
  await settle(page);
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  await settle(page);

  await context.setOffline(true);
  await page.reload();
  await settle(page);
  await expect(page.getByRole("heading", { name: "Gym" })).toBeVisible();

  const inserts = async () => ((await (await fetch(`${STUB}/__log`)).json()) as unknown[][]).filter((l) => l[0] === "insert" && l[1] === "gym_sessions").length;
  const start = await inserts();
  await page.getByRole("button", { name: /Cardio/ }).first().click();
  await page.waitForTimeout(800);
  expect(await inserts()).toBe(start);

  await context.setOffline(false);
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect.poll(inserts, { timeout: 15000 }).toBe(start + 1);
  await context.close();
});
