// 카드가 실제로 멈추는 시점 측정 (연속 스크린샷이 동일해지는 첫 순간).
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { join, extname, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "../web/out");
const MIME = { ".html":"text/html",".js":"text/javascript",".css":"text/css",".webp":"image/webp",".svg":"image/svg+xml",".otf":"font/otf",".ttf":"font/ttf",".txt":"text/plain",".xml":"application/xml" };
const server = createServer(async (req, res) => {
  let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
  if (p.endsWith("/")) p += "index.html";
  try { const b = await readFile(join(root, p));
    res.writeHead(200, { "content-type": MIME[extname(p)] ?? "application/octet-stream" }); res.end(b);
  } catch { res.writeHead(404); res.end(); }
});
await new Promise((ok) => server.listen(4698, ok));
const browser = await chromium.launch({ headless: true, args: ["--enable-gpu"] });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
const page = await context.newPage();
await page.goto("http://127.0.0.1:4698/");
await page.waitForFunction(() => document.querySelector('div[aria-live="polite"]')?.textContent.trim().length > 0, { timeout: 40000 });
await page.waitForTimeout(1500);
const clip = { x: 40, y: 300, width: 310, height: 240 };
const t0 = Date.now();
await page.evaluate(() => document.querySelector("canvas").dispatchEvent(
  new WheelEvent("wheel", { deltaY: 800, bubbles: true, cancelable: true })));
let prev = null, stopped = null;
for (let i = 0; i < 30; i++) {
  const buf = await page.screenshot({ clip });
  const ms = Date.now() - t0;
  const same = prev && Buffer.compare(prev, buf) === 0;
  if (same && stopped === null) stopped = ms;
  console.log(`${String(ms).padStart(4)}ms ${same ? "정지" : "이동"} (${buf.length}B)`);
  prev = buf;
  await page.waitForTimeout(60);
}
console.log(`\n카드가 멈춘 시각: ${stopped ?? "4s 내 미정지"} ms`);
await browser.close(); server.close();
