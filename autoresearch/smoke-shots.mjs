// 비동결 진단: PC/TA/MO 뷰포트별 엔트리 완료 상태 스크린샷.
// 사용: node smoke-shots.mjs <라벨>  → shots/<라벨>-<뷰포트>.png
import { createServer } from "node:http";
import { readFile, mkdir } from "node:fs/promises";
import { join, extname, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "../web/out");
const label = process.argv[2] ?? "current";
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
await new Promise((ok) => server.listen(4633, ok));

const VIEWPORTS = [
  { name: "pc-1512x982", width: 1512, height: 982 },
  { name: "pc-1280x720", width: 1280, height: 720 },
  { name: "ta-768x1024", width: 768, height: 1024, mobile: true },
  { name: "ta-1024x768", width: 1024, height: 768, mobile: true },
  { name: "mo-390x844", width: 390, height: 844, mobile: true },
];

await mkdir(join(here, "shots"), { recursive: true });
const browser = await chromium.launch({ headless: true, args: ["--enable-gpu"] });

for (const v of VIEWPORTS) {
  const context = await browser.newContext({
    viewport: { width: v.width, height: v.height },
    deviceScaleFactor: 1,
    isMobile: !!v.mobile,
    hasTouch: !!v.mobile,
  });
  const page = await context.newPage();
  await page.goto("http://127.0.0.1:4633/");
  try {
    await page.waitForFunction(
      () => document.querySelector('div[aria-live="polite"]')?.textContent.trim().length > 0,
      { timeout: 40000 },
    );
    await page.waitForTimeout(2000);
    await page.screenshot({ path: join(here, "shots", `${label}-${v.name}.png`) });
    console.log(`shot: ${label}-${v.name}.png`);
  } catch (e) {
    console.log(`FAIL ${v.name}: ${e.message.split("\n")[0]}`);
  }
  await context.close();
}
await browser.close();
server.close();
