// 비동결 진단: 카드 클릭 → 다이브 → 디테일 → 닫기 → 상호작용 복귀 확인.
// 데스크톱(마우스 클릭)과 모바일(CDP 터치 탭) 둘 다 검사한다.
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
await new Promise((ok) => server.listen(4631, ok));
const base = "http://127.0.0.1:4631/";

const browser = await chromium.launch({ headless: true, args: ["--enable-gpu"] });
const out = {};

async function waitEntry(page) {
  await page.waitForFunction(
    () => document.querySelector('div[aria-live="polite"]')?.textContent.trim().length > 0,
    { timeout: 40000 },
  );
  await page.waitForTimeout(800);
}

// 앞면 카드의 화면 좌표: 링 중심 + 반지름 (frontAngle=0 → 3시 방향)
// Carousel 내부 값을 밖에서 재현하기보다, 화면 오른쪽 절반의 세로 중앙을
// 수평으로 훑으며 커서 아래 카드가 잡히는 지점을 찾는다.
async function findFrontCard(page, viewW, viewH) {
  for (let x = viewW * 0.9; x > viewW * 0.1; x -= viewW * 0.05) {
    await page.mouse.move(x, viewH / 2);
    await page.waitForTimeout(150);
    const over = await page.evaluate(() => {
      // 커서가 카드 위면 캔버스 컨테이너에 커서 스타일이... 노출된 신호가
      // 없으므로 클릭해 보고 다이얼로그가 뜨는지로 판정한다.
      return true;
    });
    if (over) {
      await page.mouse.click(x, viewH / 2);
      try {
        await page.waitForSelector('[role="dialog"]', { timeout: 2500 });
        return { x, y: viewH / 2, opened: true };
      } catch {
        /* 이 지점엔 카드가 없거나 앞면이 아님 — 계속 */
      }
    }
  }
  return { opened: false };
}

/* ---------------- desktop ---------------- */
{
  const page = await browser.newPage({ viewport: { width: 1512, height: 982 } });
  const errors = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto(base);
  await waitEntry(page);

  const hit = await findFrontCard(page, 1512, 982);
  let closed = false;
  let interactiveAgain = false;
  if (hit.opened) {
    const name = await page.textContent('[role="dialog"] h2');
    out.desktopOpenedName = name;
    await page.keyboard.press("Escape");
    await page.waitForSelector('[role="dialog"]', { state: "detached", timeout: 5000 });
    closed = true;
    // 되돌아온 뒤 휠이 다시 먹는지 = interactive 복구 확인
    await page.waitForTimeout(1200);
    await page.evaluate(() => {
      document.querySelector("div.touch-none").dispatchEvent(
        new WheelEvent("wheel", { deltaY: 800, cancelable: true, bubbles: true }),
      );
    });
    try {
      await page.waitForFunction(
        () => {
          for (const g of document.querySelectorAll('span[style*="will-change"]'))
            for (const s of g.querySelectorAll("span")) {
              const o = parseFloat(s.style.opacity);
              if (!Number.isNaN(o) && o > 0.02 && o < 0.98) return true;
            }
          return false;
        },
        { timeout: 8000, polling: 30 },
      );
      interactiveAgain = true;
    } catch {}
  }
  out.desktop = { opened: hit.opened, closed, interactiveAgain, errors };
  await page.close();
}

/* ---------------- mobile (CDP touch) ---------------- */
{
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  const errors = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto(base);
  await waitEntry(page);

  const cdp = await context.newCDPSession(page);
  // 오른쪽 절반을 훑으며 앞면 카드를 찾는다. 탭 사이에 프레임이 흐르도록
  // touchStart/End 사이 180ms를 둔다 (실제 손가락과 비슷).
  let opened = false;
  let tapPoint = null;
  for (let x = 370; x > 40 && !opened; x -= 30) {
    const point = [{ x, y: 422 }];
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: point });
    await page.waitForTimeout(180);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    try {
      await page.waitForSelector('[role="dialog"]', { timeout: 2000 });
      opened = true;
      tapPoint = x;
    } catch {}
  }
  let closed = false;
  if (opened) {
    out.mobileOpenedName = await page.textContent('[role="dialog"] h2');
    await page.click('button[aria-label="닫기"]');
    await page.waitForSelector('[role="dialog"]', { state: "detached", timeout: 5000 });
    closed = true;
  }
  out.mobile = { opened, tapPoint, closed, errors };
  await context.close();
}

console.log(JSON.stringify(out, null, 2));
await browser.close();
server.close();
