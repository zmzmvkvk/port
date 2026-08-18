// 진단(비동결): 스크롤 직후 이름 락업 영역을 시간별로 캡처한다.
// 사용: node probe-frames.mjs <mo|pc> <라벨>
import { createServer } from "node:http";
import { readFile, mkdir } from "node:fs/promises";
import { join, extname, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "../web/out");
const mode = process.argv[2] ?? "mo";
const label = process.argv[3] ?? "before";
const MIME = { ".html":"text/html",".js":"text/javascript",".css":"text/css",".webp":"image/webp",".svg":"image/svg+xml",".otf":"font/otf",".ttf":"font/ttf",".txt":"text/plain",".xml":"application/xml" };
const server = createServer(async (req, res) => {
  let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
  if (p.endsWith("/")) p += "index.html";
  try { const b = await readFile(join(root, p));
    res.writeHead(200, { "content-type": MIME[extname(p)] ?? "application/octet-stream" }); res.end(b);
  } catch { res.writeHead(404); res.end(); }
});
await new Promise((ok) => server.listen(4697, ok));
const vp = mode === "pc" ? { width: 1512, height: 982, mobile: false }
                         : { width: 390, height: 844, mobile: true };
const clip = mode === "pc" ? { x: 40, y: 430, width: 620, height: 130 }
                           : { x: 40, y: 740, width: 340, height: 90 };
const browser = await chromium.launch({ headless: true, args: ["--enable-gpu"] });
const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height },
  deviceScaleFactor: 2, isMobile: vp.mobile, hasTouch: vp.mobile });
const page = await context.newPage();
await page.goto("http://127.0.0.1:4697/");
await page.waitForFunction(() => document.querySelector('div[aria-live="polite"]')?.textContent.trim().length > 0, { timeout: 40000 });
await page.waitForTimeout(1500);
await mkdir(join(here, "shots"), { recursive: true });
const t0 = Date.now();
await page.evaluate(() => document.querySelector("canvas").dispatchEvent(
  new WheelEvent("wheel", { deltaY: 800, bubbles: true, cancelable: true })));
const stamps = [];
for (let i = 0; i < 14; i++) {
  const buf = await page.screenshot({ clip });
  stamps.push({ ms: Date.now() - t0, buf });
  await page.waitForTimeout(90);
}
// 한 장으로 합치기: 세로로 이어붙인 대조 시트
const strip = await page.evaluate(async ([shots, w, h]) => {
  const c = document.createElement("canvas");
  c.width = w; c.height = h * shots.length;
  const g = c.getContext("2d");
  g.fillStyle = "#fff"; g.fillRect(0, 0, c.width, c.height);
  for (let i = 0; i < shots.length; i++) {
    const img = new Image();
    await new Promise((ok) => { img.onload = ok; img.src = "data:image/png;base64," + shots[i].b64; });
    g.drawImage(img, 0, i * h, w, h);
    g.fillStyle = "#c00"; g.font = "16px monospace";
    g.fillText(shots[i].ms + "ms", 6, i * h + 18);
  }
  return c.toDataURL("image/png");
}, [stamps.map((s) => ({ ms: s.ms, b64: s.buf.toString("base64") })), clip.width * 2, clip.height * 2]);
const { writeFile } = await import("node:fs/promises");
await writeFile(join(here, "shots", `morph-${mode}-${label}.png`),
  Buffer.from(strip.split(",")[1], "base64"));
console.log(`wrote shots/morph-${mode}-${label}.png (${stamps.map((s) => s.ms).join(",")})`);
await browser.close(); server.close();
