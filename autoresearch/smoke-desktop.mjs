// 일회용 데스크톱 회귀 스모크: fine 포인터에서 이름 릴레이가 도는지, 그리고
// 필터가 두 번 다시 켜지지 않는지 확인한다. Frozen Metric 아님.
//
// 예전에는 반대를 확인했다 — goo 블러 모프가 살아있는지. 그 모프는 중간에
// 이름이 통째로 사라졌다가 덩어리로 돌아와서 걷어냈고, 그래서 이 스모크가
// 지키는 것도 뒤집혔다: 낱말은 opacity 와 transform 으로만 움직여야 한다.
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
// 낱말이 실제로 움직였는지: 분수 opacity + translate 가 잡혀야 한다.
// 동시에 filter 는 한 번도 켜지면 안 된다.
let relayed = false;
let sawFilter = false;
const deadline = Date.now() + 8000;
while (Date.now() < deadline) {
  const seen = await page.evaluate(() => {
    let moving = false;
    let filtered = false;
    for (const g of document.querySelectorAll('span[style*="will-change"]')) {
      for (const s of g.querySelectorAll("span")) {
        if (s.children.length) continue;
        const o = parseFloat(s.style.opacity);
        const tr = s.style.transform || "";
        if (!Number.isNaN(o) && o > 0.02 && o < 0.98 && tr.includes("translate")) moving = true;
      }
      if ((g.style.filter || "").includes("url(")) filtered = true;
    }
    for (const s of document.querySelectorAll("span"))
      if ((s.style.filter || "").includes("blur(")) filtered = true;
    return { moving, filtered };
  });
  if (seen.moving) relayed = true;
  if (seen.filtered) sawFilter = true;
  if (relayed && Date.now() > deadline - 7000) break;
}

console.log(JSON.stringify({ desktopRelay: relayed, anyFilter: sawFilter, consoleErrors: errors }, null, 2));
await browser.close();
server.close();
