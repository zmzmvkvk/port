import { createRequire } from "node:module";
import { expect, test } from "@playwright/test";

const require = createRequire(import.meta.url);
const axePath = require.resolve("axe-core/axe.min.js");

test("reduced motion defaults to static mode and makes no MP4 requests", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const mp4Requests = [];
  page.on("request", (request) => {
    if (request.url().endsWith(".mp4")) mp4Requests.push(request.url());
  });
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("data-mode", "static");
  await expect(page.locator(".career-card")).toHaveCount(6);
  await page.waitForTimeout(2100);
  expect(mp4Requests).toHaveLength(0);
});

test("direct hash entry activates the requested scene", async ({ page }) => {
  await page.goto("/#lotte");
  await expect(page.locator('.timeline button[data-section="lotte"]')).toHaveAttribute("aria-current", "step");
  await expect(page).toHaveURL(/#lotte$/);
});

test("timeline supports arrows, Home, and End", async ({ page }) => {
  await page.goto("/");
  const first = page.locator('.timeline button[data-index="0"]');
  await first.focus();
  await first.press("ArrowRight");
  await expect(page.locator('.timeline button[data-index="1"]')).toBeFocused();
  await page.keyboard.press("End");
  await expect(page.locator('.timeline button[data-index="5"]')).toBeFocused();
  await page.keyboard.press("Home");
  await expect(first).toBeFocused();
});

test("the static preference is persisted and keeps videos unmounted", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "정적" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-mode", "static");
  await expect(page.locator("video")).toHaveCount(0);
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-mode", "static");
  expect(await page.evaluate(() => localStorage.getItem("portfolio.motion"))).toBe("static");
});

test("a transient 404 retries and mounts the video", async ({ page }) => {
  let attempts = 0;
  await page.route("**/01-megastudy.mp4", async (route) => {
    attempts += 1;
    if (attempts === 1) await route.fulfill({ status: 404, body: "missing" });
    else await route.continue();
  });
  await page.goto("/");
  await page.getByRole("button", { name: "영상" }).click();
  await page.mouse.click(300, 300);
  await expect.poll(() => attempts, { timeout: 7000 }).toBeGreaterThanOrEqual(2);
  await expect(page.locator('video[data-key="scene:megastudy"]')).toHaveCount(1);
  await expect(page.locator(".media-error")).toBeHidden();
});

test("a permanent media failure keeps the poster and offers retry", async ({ page }) => {
  await page.route("**/01-megastudy.mp4", (route) => route.fulfill({ status: 404, body: "missing" }));
  await page.goto("/");
  await page.getByRole("button", { name: "영상" }).click();
  await page.mouse.click(300, 300);
  await expect(page.locator(".media-error")).toBeVisible({ timeout: 7000 });
  await expect(page.locator(".stage-poster")).toBeVisible();
  await expect(page.getByRole("button", { name: "다시 불러오기" })).toBeVisible();
});

test("static mode has no serious or critical axe violations", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "정적" }).click();
  await page.addScriptTag({ path: axePath });
  const violations = await page.evaluate(async () => {
    const result = await window.axe.run(document, {
      runOnly: { type: "tag", values: ["wcag2a", "wcag2aa"] }
    });
    return result.violations.filter((violation) => ["serious", "critical"].includes(violation.impact));
  });
  expect(violations).toEqual([]);
});

test("the media DOM stays within the five-segment budget", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "영상" }).click();
  await page.mouse.click(300, 300);
  for (let step = 0; step <= 5; step += 1) {
    await page.locator(`.timeline button[data-index="${step}"]`).click();
    await page.waitForTimeout(450);
    expect(await page.locator("video").count()).toBeLessThanOrEqual(5);
  }
});
