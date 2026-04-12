import { expect, test } from "@playwright/test";

test("home page renders demo entrypoint", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Use Zac demo")).toBeVisible();
  await expect(page.getByText(/Shared household task capture/i)).toBeVisible();
});
