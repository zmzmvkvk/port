// Level 0 — 어떤 루프도 이 파일을 수정하지 않는다.
// Outer Loop의 Frozen Metric: Inner Loop 세션 하나의 품질을 평가한다.
//
// outer_score = final_score * 0.5 + convergence_speed * 0.3
//             + improvement_per_experiment * 0.2
//
// 사용: node meta_eval/outer_score.mjs  (inner_results.tsv를 읽는다)

import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const tsv = readFileSync(join(here, "..", "inner_results.tsv"), "utf8")
  .trim()
  .split("\n");
const rows = tsv.slice(1).map((l) => l.split("\t"));
const scores = rows
  .map((r) => parseFloat(r[7]))
  .filter((v) => !Number.isNaN(v));

if (scores.length < 2) {
  console.log("need at least baseline + 1 experiment");
  process.exit(0);
}

const baseline = scores[0];
const finalScore = Math.max(...scores);
// 수렴 속도: 최고점의 95%에 도달한 실험 번호가 빠를수록 높다.
const target = baseline + (finalScore - baseline) * 0.95;
let convergedAt = scores.length - 1;
for (let i = 1; i < scores.length; i++) {
  if (scores[i] >= target) {
    convergedAt = i;
    break;
  }
}
const convergence = (1 - convergedAt / scores.length) * 100;
const improvementPerExp = ((finalScore - baseline) / (scores.length - 1)) * 10;

const outer =
  finalScore * 0.5 +
  convergence * 0.3 +
  Math.max(0, Math.min(100, improvementPerExp)) * 0.2;

console.log(
  JSON.stringify(
    {
      experiments: scores.length - 1,
      baseline,
      finalScore,
      convergedAtExperiment: convergedAt,
      convergenceScore: +convergence.toFixed(1),
      improvementPerExp: +improvementPerExp.toFixed(2),
      outerScore: +outer.toFixed(2),
    },
    null,
    2,
  ),
);
