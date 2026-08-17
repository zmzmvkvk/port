# autoresearch 세션 — roomy.page 모바일 텍스트 모션 랙

새 에이전트가 이 파일만 읽고 이어받을 수 있도록 유지한다.

## 무엇을 하고 있나

roomy.page(소스: `web/`, Next.js 정적 export → Cloudflare Pages)에서
모바일 텍스트 등장 모션(카드 전환 시 이름 모프 + 인트로 헤딩 리빌)의
프레임 드랍을 제거하는 Inner Loop.

## 환경 주의사항

- Chrome MCP가 없는 환경이라 스킬의 eval을 **Playwright**로 이식했다.
  헤드리스 Chromium은 WebGL을 SwiftShader(소프트웨어)로 돌릴 수 있어
  절대 fps는 실기기보다 낮다. **상대 비교(베이스라인 대비)만 의미 있다.**
- eval 설정(390x844 DPR3, CPU 4x 스로틀, 휠 델타 800)은 베이스라인 이후
  고정. `eval/` 파일은 Inner Loop가 수정 금지.

## 사이클 절차

1. `outer/program.md`의 가설 백로그에서 하나 선택.
2. `web/` 코드 수정 (한 번에 하나의 가설).
3. `cd web; npm run build` (out/ 재생성).
4. `cd autoresearch; node eval/measure.mjs --label <실험명>`
5. `node eval/score.mjs` → SCORE 확인.
6. 개선 → `git add -A; git commit -m "experiment: ..."` (keep)
   악화/동일 → `git reset --hard HEAD` 전에 워킹트리 복구
   (커밋 전이므로 `git checkout -- web/`), 기록만 남긴다.
7. `inner_results.tsv`에 한 줄 추가 (실패도 기록).

## 기록

- 결과: `inner_results.tsv`
- 전략: `outer/strategy_log.tsv` (Outer Loop 전용)
- 마지막 측정 원본: `eval/last_result.json` (gitignore)

## 히스토리

- (세션 시작) 베이스라인 커밋 `3e5c3de`에 web/ 소스 추가.
- 하네스 캘리브레이션: 실 GPU(RTX 4070 Ti)에서는 전 구간 60fps로 신호가
  없어 `--disable-gpu`(SwiftShader)로 전환. DPR 3에서는 WebGL 바닥이
  5fps라 morph 신호가 묻혀 DPR 1로 고정. 모프 감지는 필터 유무가 아닌
  단어 span의 분수 opacity로 (구현 독립적).
- Inner Loop 1차 세션 (2026-08-17): 6 실험 6 keep, 75.93 → 76.86.
  - 001 coarse 포인터 크로스페이드 (핵심 수정 — 모바일 텍스트 랙의 주범인
    SVG goo + 100px 블러 매프레임 래스터 제거)
  - 002 MSAA 제거 / 003 불투명 캔버스 / 004 글리프 밉맵
  - 005 페이드아웃 후 헤딩 그룹 draw 중단 / 006 리빌 전 draw 중단 + 텍스처
    사전 업로드
  - morph mean 59.24 → 53.71ms (−9.3%), idle 17.1 → 19.2fps (+12%),
    이 수치는 SwiftShader 리그 기준. 실폰에서는 001의 효과가 지배적일 것.
- 데스크톱 회귀: `smoke-desktop.mjs` (비동결 진단) — fine 포인터에서
  goo 블러 모프 유지 + 콘솔 에러 0 확인.

## 하네스가 못 보는 것 (다음 Outer Loop 후보)

- renderer DPR 상한 (min(dpr,2)) 조정 실험 — 리그가 DPR 1이라 측정 불가.
  실폰 entry 랙에는 유효할 수 있으나 선명도 트레이드오프 있음.
- `prefers-reduced-motion` 대응 — 리그가 no-preference 고정이라 점수에
  반영 안 됨. 접근성 관점에서 별도 작업 권장.
