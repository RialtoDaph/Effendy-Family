import { expect, test } from "@playwright/test";
import { setData, setPlan } from "./helpers";

test("signs in with a password, no email", async ({ page }) => {
  await setPlan("together");
  await setData("seed");
  await page.goto("/login");
  await page.getByRole("button", { name: "Sign in with password" }).click();
  await page.getByLabel("Email").fill("alex@example.test");
  await page.getByLabel("Password").fill("wrong");
  await page.locator('button[type="submit"]').click();
  await expect(page.getByText("Email or password is wrong.")).toBeVisible();
  await page.getByLabel("Password").fill("right");
  await page.locator('button[type="submit"]').click();
  await expect(page).not.toHaveURL(/login/);
});
