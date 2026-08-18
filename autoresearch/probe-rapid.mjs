// 진단(비동결): 연속 스크롤 중 서로 다른 이름이 동시에 읽히는 구간이 있는지.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { join, extname, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "../web/out");
const mode = process.argv[2] ?? "mo";
const gap = +(process.argv[3] ?? 320);
const MIME = { ".html":"text/html",".js":"text/javascript",".css":"text/css",".webp":"image/webp",".svg":"image/svg+xml",".otf":"font/otf",".ttf":"font/ttf",".txt":"text/plain",".xml":"application/xml" };
const server = createServer(async (req, res) => {
  let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
  if (p.endsWith("/")) p += "index.html";
  try { const b = await readFile(join(root, p));
    res.writeHead(200, { "content-type": MIME[extname(p)] ?? "application/octet-stream" }); res.end(b);
  } catch { res.writeHead(404); res.end(); }
});
await new Promise((ok) => server.listen(4695, ok));
const vp = mode === "pc" ? { width: 1512, height: 982, mobile: false }
                         : { width: 390, height: 844, mobile: true };
const browser = await chromium.launch({ headless: true, args: ["--enable-gpu"] });
const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height },
  deviceScaleFactor: 1, isMobile: vp.mobile, hasTouch: vp.mobile });
const page = await context.newPage();
const errors = [];
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
await page.goto("http://127.0.0.1:4695/");
await page.waitForFunction(() => document.querySelector('div[aria-live="polite"]')?.textContent.trim().length > 0, { timeout: 40000 });
await page.waitForTimeout(1400);
const res = await page.evaluate(async (gap) => {
  const box = [...document.querySelectorAll('div[aria-hidden="true"]')]
    .filter((d) => d.className.includes("fixed") && d.querySelector("span span span"))[0];

  const canvas = document.querySelector("canvas");
  const wheel = () => canvas.dispatchEvent(new WheelEvent("wheel", { deltaY: 800, bubbles: true, cancelable: true }));
  let worst = 0, worstAt = null, frames = 0;
  const t0 = performance.now();
  let next = 0, fired = 0;
  await new Promise((done) => {
    const tick = () => {
      const now = performance.now() - t0;
      if (fired < 5 && now >= next) { wheel(); fired++; next += gap; }
      const vis = [];
      for (const s of box.querySelectorAll("span")) {
        if (s.children.length || !s.textContent) continue;
        const o = +getComputedStyle(s).opacity;
        if (o > 0.12) vis.push({ t: s.textContent, o });
      }
      // 같은 슬롯(이름)의 서로 다른 문자열이 동시에 읽히는가
      const names = vis.filter((v) => v.t.length > 3);
      if (new Set(names.map((v) => v.t)).size > 1) {
        const both = Math.min(...names.map((v) => v.o));
        if (both > worst) { worst = both; worstAt = Math.round(now); }
      }
      frames++;
      if (now < gap * 6 + 1500) requestAnimationFrame(tick); else done();
    };
    requestAnimationFrame(tick);
  });
  return { worst: +worst.toFixed(3), worstAt, frames };
}, gap);
console.log(`[${mode}] 연속 스크롤 ${gap}ms 간격 — 서로 다른 이름이 동시에 읽힌 최대 세기: ${res.worst}${res.worstAt !== null ? ` (${res.worstAt}ms)` : ""}, frames=${res.frames}, errors=${errors.length}`);
if (errors.length) console.log(errors.slice(0, 4));
await browser.close(); server.close();
