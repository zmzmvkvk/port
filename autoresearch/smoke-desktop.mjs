// 일회용 데스크톱 회귀 스모크: fine 포인터에서 goo 블러 모프가 그대로
// 살아있는지, 콘솔 에러가 없는지 확인한다. Frozen Metric 아님.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { join, extname, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "../web/out");
const MIME = {
  ".html": "text/html", ".js": "text/javascript", ".css": "text/css",
  ".webp": "image/webp", ".svg": "image/svg+xml", ".otf": "font/otf",
  ".ttf": "font/ttf", ".txt": "text/plain", ".xml": "application/xml",
};
const server = createServer(async (req, res) => {
  let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
  if (p.endsWith("/")) p += "index.html";
  try {
    const body = await readFile(join(root, p));
    res.writeHead(200, { "content-type": MIME[extname(p)] ?? "application/octet-stream" });
    res.end(body);
  } catch { res.writeHead(404); res.end(); }
});
await new Promise((ok) => server.listen(4629, ok));

const browser = await chromium.launch({ headless: true, args: ["--enable-gpu"] });
const page = await browser.newPage({ viewport: { width: 1512, height: 982 } });
const errors = [];
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
page.on("pageerror", (e) => errors.push(String(e)));

await page.goto("http://127.0.0.1:4629/");
await page.waitForFunction(
  () => document.querySelector('div[aria-live="polite"]')?.textContent.trim().length > 0,
  { timeout: 40000 },
);

// 링을 한 슬롯 돌려 모프 유발
await page.evaluate(() => {
  document.querySelector("div.touch-none").dispatchEvent(
    new WheelEvent("wheel", { deltaY: 800, cancelable: true, bubbles: true }),
  );
});
// 데스크톱은 goo 필터가 켜져야 정상
let sawGoo = false;
try {
  await page.waitForFunction(
    () => {
      for (const g of document.querySelectorAll('span[style*="will-change"]'))
        if ((g.style.filter || "").includes("url(")) return true;
      return false;
    },
    { timeout: 8000, polling: 30 },
  );
  sawGoo = true;
} catch {}

console.log(JSON.stringify({ desktopGooMorph: sawGoo, consoleErrors: errors }, null, 2));
await browser.close();
server.close();
