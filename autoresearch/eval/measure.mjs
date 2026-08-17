// Frozen Metric 측정 하네스 (Level 1.5 — Inner Loop 수정 금지)
//
// web/out 정적 빌드를 로컬 서버로 띄우고, 모바일 에뮬레이션(390x844 DPR3,
// CPU 4x 스로틀) Chromium에서 세 구간의 rAF 프레임 타임을 수집한다:
//   entry — 페이지 로드부터 엔트리 타임라인 완료(이름 라벨 첫 표시)까지.
//           인트로 헤딩 글리프 리빌이 이 구간에 포함된다.
//   morph — 휠 디스패치로 링을 한 슬롯 돌려 이름 모프(SVG goo 필터 활성
//           구간)를 정확히 브래킷해서 측정. 기본 4회.
//   idle  — 입력 없는 정지 상태. 비교 기준선.
//
// 사용: node eval/measure.mjs --label <실험명>
// 출력: eval/last_result.json + stdout 요약

import { createServer } from "node:http";
import { readFile, writeFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { join, extname, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const here = dirname(fileURLToPath(import.meta.url));
const config = JSON.parse(readFileSync(join(here, "test-routes.json"), "utf8"));

const label =
  process.argv[process.argv.indexOf("--label") + 1] &&
  process.argv.includes("--label")
    ? process.argv[process.argv.indexOf("--label") + 1]
    : "unlabeled";

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".webp": "image/webp",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".otf": "font/otf",
  ".ttf": "font/ttf",
  ".woff2": "font/woff2",
  ".txt": "text/plain",
  ".xml": "application/xml",
  ".ico": "image/x-icon",
};

function startServer(rootDir, port) {
  const server = createServer(async (req, res) => {
    try {
      let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
      if (p.endsWith("/")) p += "index.html";
      let file = join(rootDir, p);
      let body;
      try {
        body = await readFile(file);
      } catch {
        file = join(rootDir, p + ".html");
        try {
          body = await readFile(file);
        } catch {
          res.writeHead(404);
          res.end("not found");
          return;
        }
      }
      res.writeHead(200, {
        "content-type": MIME[extname(file)] ?? "application/octet-stream",
        "cache-control": "no-store",
      });
      res.end(body);
    } catch (e) {
      res.writeHead(500);
      res.end(String(e));
    }
  });
  return new Promise((ok) => server.listen(port, () => ok(server)));
}

function frameStats(frames, t0, t1) {
  const deltas = [];
  for (let i = 1; i < frames.length; i++) {
    if (frames[i - 1] >= t0 && frames[i] <= t1)
      deltas.push(frames[i] - frames[i - 1]);
  }
  if (deltas.length < 2) return null;
  const sorted = [...deltas].sort((a, b) => a - b);
  const q = (p) => sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))];
  const mean = deltas.reduce((a, b) => a + b, 0) / deltas.length;
  return {
    frames: deltas.length,
    meanMs: +mean.toFixed(2),
    medianMs: +q(0.5).toFixed(2),
    p95Ms: +q(0.95).toFixed(2),
    maxMs: +sorted[sorted.length - 1].toFixed(2),
    pctOver33: +((deltas.filter((d) => d > 33.4).length / deltas.length) * 100).toFixed(1),
    fps: +(1000 / mean).toFixed(1),
  };
}

function pooledStats(windows) {
  // 여러 모프 창의 델타를 합쳐 하나의 분포로 취급한다.
  const all = windows.flat();
  if (all.length < 2) return null;
  const sorted = [...all].sort((a, b) => a - b);
  const q = (p) => sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))];
  const mean = all.reduce((a, b) => a + b, 0) / all.length;
  return {
    windows: windows.length,
    frames: all.length,
    meanMs: +mean.toFixed(2),
    medianMs: +q(0.5).toFixed(2),
    p95Ms: +q(0.95).toFixed(2),
    maxMs: +sorted[sorted.length - 1].toFixed(2),
    pctOver33: +((all.filter((d) => d > 33.4).length / all.length) * 100).toFixed(1),
    fps: +(1000 / mean).toFixed(1),
  };
}

async function runOnce(browser, route) {
  const { device } = config;
  const context = await browser.newContext({
    viewport: device.viewport,
    deviceScaleFactor: device.deviceScaleFactor,
    isMobile: device.isMobile,
    hasTouch: device.hasTouch,
    userAgent:
      "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Mobile Safari/537.36",
  });
  const page = await context.newPage();

  const consoleErrors = [];
  page.on("console", (m) => {
    if (m.type() === "error") consoleErrors.push(m.text());
  });
  page.on("pageerror", (e) => consoleErrors.push(String(e)));

  await page.addInitScript(() => {
    window.__frames = [];
    const loop = (t) => {
      window.__frames.push(t);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
    // 모프 진행 감지: 구현(블러 필터든 크로스페이드든)과 무관하게, 메타
    // 레이어의 opacity가 분수값인 동안을 모프 창으로 본다. 정지 상태에서는
    // 레이어가 정확히 "0" 또는 "1"이다.
    window.__morphActive = () => {
      const goos = document.querySelectorAll('span[style*="will-change"]');
      for (const g of goos) {
        // opacity는 goo > layer > row > word 의 단어 span에 걸린다.
        for (const s of g.querySelectorAll("span")) {
          const o = parseFloat(s.style.opacity);
          if (!Number.isNaN(o) && o > 0.02 && o < 0.98) return true;
        }
      }
      return false;
    };
  });

  const cdp = await context.newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: device.cpuThrottle });

  const base = `http://127.0.0.1:${config.server.port}`;
  await page.goto(base + route.path, { waitUntil: "domcontentloaded" });
  const navT = await page.evaluate(() => performance.now());

  const gpu = await page.evaluate(() => {
    try {
      const gl = document.createElement("canvas").getContext("webgl");
      const ext = gl.getExtension("WEBGL_debug_renderer_info");
      return ext
        ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)
        : gl.getParameter(gl.RENDERER);
    } catch (e) {
      return "probe failed: " + e;
    }
  });

  const ph = route.phases;

  // ---- entry: aria-live에 첫 카드가 공지되면 엔트리 타임라인이 끝난 것 ----
  let entry = null;
  let entryEndT = null;
  try {
    await page.waitForFunction(
      () => {
        const el = document.querySelector('div[aria-live="polite"]');
        return el && el.textContent.trim().length > 0;
      },
      { timeout: ph.entryTimeoutMs },
    );
    entryEndT = await page.evaluate(() => performance.now());
    const frames = await page.evaluate(() => window.__frames);
    entry = frameStats(frames, navT, entryEndT);
    if (entry) entry.durationMs = +(entryEndT - navT).toFixed(0);
  } catch {
    consoleErrors.push("ENTRY TIMEOUT: name label never appeared");
  }

  // ---- morph: 휠 → goo 필터 활성 구간을 브래킷 ----
  const morphWindows = [];
  let morphMisses = 0;
  if (entryEndT !== null) {
    await page.waitForTimeout(1000);
    for (let k = 0; k < ph.morphCount; k++) {
      await page.evaluate((dy) => {
        document
          .querySelector("div.touch-none")
          .dispatchEvent(
            new WheelEvent("wheel", {
              deltaY: dy,
              cancelable: true,
              bubbles: true,
            }),
          );
      }, ph.morphWheelDeltaY);
      try {
        await page.waitForFunction(() => window.__morphActive(), {
          timeout: ph.morphTimeoutMs,
          polling: 30,
        });
        const t0 = await page.evaluate(() => performance.now());
        await page.waitForFunction(() => !window.__morphActive(), {
          timeout: ph.morphTimeoutMs,
          polling: 30,
        });
        const t1 = await page.evaluate(() => performance.now());
        const frames = await page.evaluate(() => window.__frames);
        const deltas = [];
        for (let i = 1; i < frames.length; i++) {
          if (frames[i - 1] >= t0 && frames[i] <= t1)
            deltas.push(frames[i] - frames[i - 1]);
        }
        morphWindows.push(deltas);
      } catch {
        morphMisses++;
      }
      await page.waitForTimeout(800);
    }
  }

  // ---- idle ----
  let idle = null;
  if (entryEndT !== null) {
    await page.waitForTimeout(500);
    const t0 = await page.evaluate(() => performance.now());
    await page.waitForTimeout(ph.idleSampleMs);
    const t1 = await page.evaluate(() => performance.now());
    const frames = await page.evaluate(() => window.__frames);
    idle = frameStats(frames, t0, t1);
  }

  // ---- DOM 검증 ----
  const domFailures = [];
  for (const sel of route.checks.required_elements) {
    const found = await page.$(sel);
    if (!found) domFailures.push(`missing: ${sel}`);
  }

  // ---- 시각 검증: tight 밴드에서 이름 라벨이 우하단에 실제로 보이는가 ----
  let visual = { passed: false, detail: "" };
  try {
    visual = await page.evaluate(() => {
      const boxes = document.querySelectorAll('div[aria-hidden="true"]');
      const left = boxes[0];
      if (!left) return { passed: false, detail: "no meta box" };
      if (left.style.display === "none")
        return { passed: false, detail: "left box hidden" };
      const r = left.getBoundingClientRect();
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const text = (left.textContent || "").trim();
      const inCorner =
        r.right > vw * 0.5 && r.bottom > vh * 0.5 && r.top < vh + 5;
      return {
        passed: inCorner && text.length > 0,
        detail: `rect=${Math.round(r.left)},${Math.round(r.top)},${Math.round(r.right)},${Math.round(r.bottom)} text="${text.slice(0, 40)}"`,
      };
    });
  } catch (e) {
    visual = { passed: false, detail: String(e) };
  }

  await context.close();
  return { gpu, consoleErrors, entry, morphWindows, morphMisses, idle, domFailures, visual };
}

const root = resolve(here, config.server.dir);
const server = await startServer(root, config.server.port);
// GPU를 끄고 소프트웨어 래스터(SwiftShader)로 강제한다. 데스크톱 GPU에서는
// 모바일 랙이 재현되지 않아 메트릭에 신호가 잡히지 않기 때문. 절대값이 아닌
// 베이스라인 대비 상대 비교가 목적이다.
const browser = await chromium.launch({
  headless: true,
  args: ["--disable-gpu", "--enable-unsafe-swiftshader"],
});

const route = config.routes[0];
const runs = [];
for (let r = 0; r < config.runs; r++) {
  runs.push(await runOnce(browser, route));
}

await browser.close();
server.close();

const allMorphWindows = runs.flatMap((r) => r.morphWindows);
const entryRuns = runs.map((r) => r.entry).filter(Boolean);
const idleRuns = runs.map((r) => r.idle).filter(Boolean);
const medianBy = (arr, key) => {
  const v = arr.map((s) => s[key]).sort((a, b) => a - b);
  return v.length ? v[Math.floor((v.length - 1) / 2)] : null;
};

const result = {
  label,
  timestamp: new Date().toISOString(),
  gpu: runs[0]?.gpu,
  device: config.device,
  consoleErrors: [...new Set(runs.flatMap((r) => r.consoleErrors))],
  entry: entryRuns.length
    ? {
        p95Ms: medianBy(entryRuns, "p95Ms"),
        medianMs: medianBy(entryRuns, "medianMs"),
        pctOver33: medianBy(entryRuns, "pctOver33"),
        fps: medianBy(entryRuns, "fps"),
        durationMs: medianBy(entryRuns, "durationMs"),
      }
    : null,
  morph: pooledStats(allMorphWindows),
  morphMisses: runs.reduce((a, r) => a + r.morphMisses, 0),
  idle: idleRuns.length
    ? {
        p95Ms: medianBy(idleRuns, "p95Ms"),
        medianMs: medianBy(idleRuns, "medianMs"),
        fps: medianBy(idleRuns, "fps"),
      }
    : null,
  dom: {
    total: route.checks.required_elements.length,
    failures: [...new Set(runs.flatMap((r) => r.domFailures))],
  },
  visual: runs[runs.length - 1]?.visual,
};
result.dom.passed = result.dom.total - result.dom.failures.length;

await writeFile(join(here, "last_result.json"), JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
