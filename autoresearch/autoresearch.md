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
