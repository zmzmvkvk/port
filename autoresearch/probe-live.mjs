// 배포 확인(비동결): 실서비스 URL에서 엔트리 + 모프 타이밍을 읽는다.
import { chromium } from "playwright";
const url = process.argv[2] ?? "https://roomy.page/";
const mode = process.argv[3] ?? "mo";
const vp = mode === "pc" ? { width: 1512, height: 982, mobile: false }
                         : { width: 390, height: 844, mobile: true };
const browser = await chromium.launch({ headless: true, args: ["--enable-gpu"] });
const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height },
  deviceScaleFactor: 1, isMobile: vp.mobile, hasTouch: vp.mobile });
const page = await context.newPage();
const errors = [];
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
page.on("requestfailed", (r) => errors.push("net: " + r.url()));
await page.goto(url, { waitUntil: "domcontentloaded" });
await page.waitForFunction(() => document.querySelector('div[aria-live="polite"]')?.textContent.trim().length > 0, { timeout: 60000 });
const first = await page.evaluate(() => document.querySelector('div[aria-live="polite"]').textContent);
await page.waitForTimeout(1400);
const r = await page.evaluate(async () => {
  const box = [...document.querySelectorAll('div[aria-hidden="true"]')]
    .filter((d) => d.className.includes("fixed") && d.querySelector("span span span"))[0];
  const goo = box.children[0];
  const rows = [goo.children[0], goo.children[1], box.children[1]];
  const t0 = performance.now();
  document.querySelector("canvas").dispatchEvent(
    new WheelEvent("wheel", { deltaY: 800, bubbles: true, cancelable: true }));
  let start = null, end = null, overlap = 0, prev = 0, worst = 0;
  await new Promise((done) => {
    const tick = () => {
      const ms = performance.now() - t0;
      const vis = [];
      for (const r of rows) { const s = r.firstElementChild.children[1];
        const o = +getComputedStyle(s).opacity;
        if (o > 0.12 && s.textContent) vis.push({ t: s.textContent, o }); }
      const names = new Set(vis.map((v) => v.t));
      if (names.size > 1) { overlap += ms - prev; worst = Math.max(worst, Math.min(...vis.map((v) => v.o))); }
      const moving = vis.some((v) => v.o < 0.98);
      if (moving && start === null) start = Math.round(ms);
      if (moving) end = Math.round(ms);
      prev = ms;
      if (ms < 3500) requestAnimationFrame(tick); else done();
    };
    requestAnimationFrame(tick);
  });
  return { start, end, overlap: Math.round(overlap), worst: +worst.toFixed(3) };
});
console.log(`[${mode}] ${url}`);
console.log(`  첫 카드 공지: ${first.trim()}`);
console.log(`  모프 시작 ${r.start}ms · 종료 ${r.end}ms · 두 이름 동시 노출 ${r.overlap}ms (최대 ${r.worst})`);
console.log(`  errors: ${errors.length}${errors.length ? " " + errors.slice(0, 3).join(" | ") : ""}`);
await browser.close();
