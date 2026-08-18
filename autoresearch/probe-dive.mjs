// 진단(비동결): 카드 클릭 → 다이브 비행의 프레임을 이어붙인 대조 시트.
// 사용: node probe-dive.mjs <pc|mo> <라벨>
import { createServer } from "node:http";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join, extname, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "../web/out");
const mode = process.argv[2] ?? "pc";
const label = process.argv[3] ?? "after";
const MIME = { ".html":"text/html",".js":"text/javascript",".css":"text/css",".webp":"image/webp",".svg":"image/svg+xml",".otf":"font/otf",".ttf":"font/ttf",".txt":"text/plain",".xml":"application/xml" };
const server = createServer(async (req, res) => {
  let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
  if (p.endsWith("/")) p += "index.html";
  try { const b = await readFile(join(root, p));
    res.writeHead(200, { "content-type": MIME[extname(p)] ?? "application/octet-stream" }); res.end(b);
  } catch { res.writeHead(404); res.end(); }
});
await new Promise((ok) => server.listen(4696, ok));
const vp = mode === "pc" ? { width: 1512, height: 982, mobile: false }
                         : { width: 390, height: 844, mobile: true };
const browser = await chromium.launch({ headless: true, args: ["--enable-gpu"] });
const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height },
  deviceScaleFactor: 1, isMobile: vp.mobile, hasTouch: vp.mobile });
const page = await context.newPage();
const errors = [];
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
await page.goto("http://127.0.0.1:4696/");
await page.waitForFunction(() => document.querySelector('div[aria-live="polite"]')?.textContent.trim().length > 0, { timeout: 40000 });
await page.waitForTimeout(1600);
await mkdir(join(here, "shots"), { recursive: true });

// 앞면 카드 중앙을 찾는다: 화면 중앙에서 좌우로 훑어 tag가 뜨는 지점.
const cx = mode === "pc" ? Math.round(vp.width * 0.5) : Math.round(vp.width * 0.62);
const cy = Math.round(vp.height * 0.5);
await page.mouse.move(cx, cy);
await page.waitForTimeout(120);
const t0 = Date.now();
await page.mouse.down(); await page.mouse.up();
const frames = [];
for (let i = 0; i < 12; i++) {
  frames.push({ ms: Date.now() - t0, buf: await page.screenshot() });
}
await page.waitForTimeout(900);
frames.push({ ms: Date.now() - t0, buf: await page.screenshot() });
const cols = 4;
const strip = await page.evaluate(async ([shots, w, h, cols]) => {
  const rows = Math.ceil(shots.length / cols);
  const c = document.createElement("canvas");
  const tw = Math.round(w / 3), th = Math.round(h / 3);
  c.width = tw * cols; c.height = th * rows;
  const g = c.getContext("2d");
  g.fillStyle = "#ddd"; g.fillRect(0, 0, c.width, c.height);
  for (let i = 0; i < shots.length; i++) {
    const img = new Image();
    await new Promise((ok) => { img.onload = ok; img.src = "data:image/png;base64," + shots[i].b64; });
    const x = (i % cols) * tw, y = Math.floor(i / cols) * th;
    g.drawImage(img, x, y, tw, th);
    g.fillStyle = "#c00"; g.font = "bold 14px monospace";
    g.fillText(shots[i].ms + "ms", x + 6, y + 16);
    g.strokeStyle = "#999"; g.strokeRect(x, y, tw, th);
  }
  return c.toDataURL("image/png");
}, [frames.map((f) => ({ ms: f.ms, b64: f.buf.toString("base64") })), vp.width, vp.height, cols]);
await writeFile(join(here, "shots", `dive-${mode}-${label}.png`), Buffer.from(strip.split(",")[1], "base64"));
console.log(`wrote shots/dive-${mode}-${label}.png  frames=${frames.map((f) => f.ms).join(",")}  errors=${errors.length}`);
if (errors.length) console.log(errors.slice(0, 5));
await browser.close(); server.close();
