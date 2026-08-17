// 복합 점수 산출 (Level 1.5). 가중치는 outer/metric_weights.json에서 읽는다.
// 사용: node eval/score.mjs  (measure.mjs 실행 후)

import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const r = JSON.parse(readFileSync(join(here, "last_result.json"), "utf8"));
const w = JSON.parse(
  readFileSync(join(here, "..", "outer", "metric_weights.json"), "utf8"),
);

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const mapMs = (ms) =>
  ms == null
    ? 0
    : clamp(
        ((w.motion.worstMs - ms) / (w.motion.worstMs - w.motion.bestMs)) * 100,
        0,
        100,
      );
// 대표값: (mean + p95) / 2 — 분포 이동(mean)과 스파이크(p95)를 함께 본다.
const rep = (s) => (s ? (s.meanMs + s.p95Ms) / 2 : null);
const repEntry = (s) => (s ? (s.medianMs + s.p95Ms) / 2 : null);

const errorScore = clamp(100 - 20 * r.consoleErrors.length, 0, 100);
const domScore = r.dom.total ? (r.dom.passed / r.dom.total) * 100 : 0;
// 모프가 아예 발동하지 않으면(miss) 그만큼 감점 — 모션을 없애서 점수를 따는
// 치팅 방지. 모프 자체가 사라진 실험은 visual/dom에서 걸러진다.
const attempts = (r.morph?.windows ?? 0) + (r.morphMisses ?? 0);
const missFactor = attempts > 0 ? (r.morph?.windows ?? 0) / attempts : 0;
const motionScore =
  (w.motion.morphShare * mapMs(rep(r.morph)) +
    w.motion.entryShare * mapMs(repEntry(r.entry))) *
  missFactor;
const visualScore = r.visual?.passed ? 100 : 0;

const total =
  errorScore * w.weights.error +
  domScore * w.weights.dom +
  motionScore * w.weights.motion +
  visualScore * w.weights.visual;

const out = {
  label: r.label,
  morph_p95Ms: r.morph?.p95Ms ?? null,
  morph_pctOver33: r.morph?.pctOver33 ?? null,
  entry_p95Ms: r.entry?.p95Ms ?? null,
  idle_p95Ms: r.idle?.p95Ms ?? null,
  errors: r.consoleErrors.length,
  scores: {
    error: +errorScore.toFixed(1),
    dom: +domScore.toFixed(1),
    motion: +motionScore.toFixed(1),
    visual: +visualScore.toFixed(1),
  },
  total: +total.toFixed(2),
};
console.log(JSON.stringify(out, null, 2));
console.log(`SCORE ${out.total}`);
