// 진단(비동결): 방문자가 "무언가 읽을 수 있게 되기까지" 걸리는 시간과 전송량.
import { chromium } from "playwright";
const url = process.argv[2] ?? "https://roomy.page/";
const net = process.argv[3] ?? "none";
const browser = await chromium.launch({ headless: true });
const rm = process.argv[4] === "reduce";
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: rm ? "reduce" : "no-preference" });
const page = await ctx.newPage();
let bytes = 0, reqs = 0;
page.on("response", async (r) => { reqs++; const l = r.headers()["content-length"]; if (l) bytes += +l; });
if (net !== "none") {
  const cdp = await ctx.newCDPSession(page);
  await cdp.send("Network.enable");
  // 4G 근사: 9Mbps 하향, 170ms RTT
  await cdp.send("Network.emulateNetworkConditions", { offline: false, downloadThroughput: 9*1024*1024/8, uploadThroughput: 1.5*1024*1024/8, latency: 170 });
}
const t0 = Date.now();
await page.goto(url, { waitUntil: "domcontentloaded" });
const dom = Date.now() - t0;
await page.waitForFunction(() => document.querySelector('div[aria-live="polite"]')?.textContent.trim().length > 0, { timeout: 90000 });
const readable = Date.now() - t0;
console.log(`${url}  (network: ${net}${rm ? ", prefers-reduced-motion: reduce" : ""})`);
console.log(`  DOM 준비            ${dom} ms`);
console.log(`  첫 작업명 읽힘      ${readable} ms   <- 방문자가 처음으로 뭔가 읽을 수 있는 시점`);
console.log(`  요청 ${reqs}건, ${(bytes/1024).toFixed(0)} KB`);
await browser.close();
