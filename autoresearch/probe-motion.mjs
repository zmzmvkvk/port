// 진단(비동결): 카드 스냅 → 이름 모프의 타이밍과 겹침을 실측한다.
// 사용: node probe-motion.mjs [mo|pc]
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { join, extname, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "../web/out");
const mode = process.argv[2] ?? "mo";
const MIME = { ".html":"text/html", ".js":"text/javascript", ".css":"text/css",
  ".webp":"image/webp", ".svg":"image/svg+xml", ".otf":"font/otf", ".ttf":"font/ttf",
  ".txt":"text/plain", ".xml":"application/xml" };
const server = createServer(async (req, res) => {
  let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
  if (p.endsWith("/")) p += "index.html";
  try {
    const body = await readFile(join(root, p));
    res.writeHead(200, { "content-type": MIME[extname(p)] ?? "application/octet-stream" });
    res.end(body);
  } catch { res.writeHead(404); res.end(); }
});
await new Promise((ok) => server.listen(4699, ok));

const vp = mode === "pc"
  ? { width: 1512, height: 982, mobile: false }
  : { width: 390, height: 844, mobile: true };

const browser = await chromium.launch({ headless: true, args: ["--enable-gpu"] });
const context = await browser.newContext({
  viewport: { width: vp.width, height: vp.height },
  deviceScaleFactor: 1, isMobile: vp.mobile, hasTouch: vp.mobile,
});
const page = await context.newPage();
await page.goto("http://127.0.0.1:4699/");
await page.waitForFunction(
  () => document.querySelector('div[aria-live="polite"]')?.textContent.trim().length > 0,
  { timeout: 40000 });
await page.waitForTimeout(1500);

// 왼쪽 락업(번호·이름) 세 행의 텍스트/불투명도를 매 rAF 기록한다.
const trace = await page.evaluate(async () => {
  // 락업 박스 안의 말단 span 이 낱말이다. 행이 몇 겹으로 감싸여 있든
  // (goo 시절 3행 -> 지금 2행) 이 방식은 그대로 읽힌다.
  const box = [...document.querySelectorAll('div[aria-hidden="true"]')]
    .filter((d) => d.className.includes("fixed") && d.querySelector("span span span"))[0];
  const words = () => [...box.querySelectorAll("span")].filter((s) => !s.children.length);
  // 왼쪽 락업은 [번호, 이름] 순서라 홀수 번째가 이름이다.
  const read = () => {
    const w = words();
    const rows = [];
    for (let i = 0; i + 1 < w.length; i += 2) {
      rows.push([
        { t: w[i].textContent, o: +(+getComputedStyle(w[i]).opacity).toFixed(3) },
        { t: w[i + 1].textContent, o: +(+getComputedStyle(w[i + 1]).opacity).toFixed(3) },
      ]);
    }
    while (rows.length < 3) rows.push([{ t: "", o: 0 }, { t: "", o: 0 }]);
    return rows;
  };
  const out = [];
  const t0 = performance.now();
  window.dispatchEvent(new Event("x-probe-start"));
  const canvas = document.querySelector("canvas");
  canvas.dispatchEvent(new WheelEvent("wheel", { deltaY: 800, bubbles: true, cancelable: true }));
  await new Promise((done) => {
    const tick = () => {
      out.push({ ms: Math.round(performance.now() - t0), rows: read(),
        goo: "-" });
      if (performance.now() - t0 < 4000) requestAnimationFrame(tick); else done();
    };
    requestAnimationFrame(tick);
  });
  return out;
});

// 요약: 이름(슬롯 1)이 언제 바뀌기 시작해 언제 끝나는지, 두 글자가 동시에 보이는 구간.
let firstChange = null, lastMove = null, overlapMs = 0, prevMs = 0, maxBoth = 0;
const nameOf = (row) => row[1].t;
const start = trace[0];
const baseName = nameOf(start.rows[2]) || nameOf(start.rows[1]);
for (const s of trace) {
  const [outR, inR, held] = s.rows;
  const vis = [outR[1], inR[1], held[1]].filter((x) => x.o > 0.02 && x.t);
  const names = new Set(vis.map((x) => x.t));
  if (names.size > 1) {
    overlapMs += s.ms - prevMs;
    const both = Math.min(...vis.map((x) => x.o));
    maxBoth = Math.max(maxBoth, both);
  }
  if (firstChange === null && (outR[1].o > 0.02 && inR[1].o > 0.02)) firstChange = s.ms;
  if (inR[1].o > 0.02 && inR[1].o < 0.999) lastMove = s.ms;
  prevMs = s.ms;
}
console.log(`[${mode}] viewport ${vp.width}x${vp.height} coarse=${vp.mobile}`);
console.log(`  entry name: ${baseName}`);
console.log(`  morph 시작(두 글자 동시 노출 첫 프레임): ${firstChange ?? "-"} ms`);
console.log(`  morph 종료(들어오는 글자 opacity=1): ${lastMove ?? "-"} ms`);
console.log(`  두 이름이 동시에 보인 총 시간: ${overlapMs} ms (동시 최소 opacity 최대 ${maxBoth})`);
const sample = trace.filter((s) => s.ms % 200 < 20).slice(0, 22);
for (const s of sample) {
  const f = (x) => `${x.t || "-"}@${x.o}`;
  console.log(`  ${String(s.ms).padStart(4)}ms out=${f(s.rows[0][1])} in=${f(s.rows[1][1])} held=${f(s.rows[2][1])} goo=${s.goo.slice(0, 28)}`);
}
await browser.close();
server.close();
