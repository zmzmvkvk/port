// 배포 확인(비동결): 실서비스에서 카드 아트가 실제로 로드되는지, 어떤 URL로,
// 어떤 캐시 정책으로 오는지 본다. 사용: node probe-cards.mjs [url]
import { chromium } from "playwright";
const url = process.argv[2] ?? "https://roomy.page/";
const browser = await chromium.launch({ headless: true });
const page = await (await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })).newPage();
const seen = [];
page.on("response", async (r) => {
  if (!/\.webp(\?|$)/.test(r.url())) return;
  seen.push({ status: r.status(), url: r.url().split("/").pop(),
    cache: r.headers()["cache-control"] ?? "-",
    bytes: Number(r.headers()["content-length"] ?? 0) });
});
await page.goto(url, { waitUntil: "domcontentloaded" });
await page.waitForFunction(
  () => document.querySelector('div[aria-live="polite"]')?.textContent.trim().length > 0,
  { timeout: 60000 });
console.log(url);
for (const s of seen.sort((a, b) => a.url.localeCompare(b.url)))
  console.log(`  ${s.status} ${String(s.bytes).padStart(6)}B  ${s.url}  [${s.cache}]`);
console.log(`  총 ${seen.length}장, 실패 ${seen.filter((s) => s.status >= 400).length}장`);
await browser.close();
