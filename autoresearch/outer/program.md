# 연구 디렉티브 — roomy.page 모바일 텍스트 모션 랙 제거

## 문제

roomy.page(= `web/` Next.js WebGL 캐러셀)에서 **모바일로 볼 때 텍스트가
생기는 모션이 심하게 랙**이 걸린다.

## 진단 (베이스라인 분석)

1. **메타 이름 모프가 주범 후보.** 카드가 바뀔 때 `ring/meta.js`가 매 프레임
   DOM 텍스트 2겹에 `filter: blur(최대 100px)`를 갱신하고, 부모 span에
   SVG `feColorMatrix` 임계값 필터(`url(#name-goo) blur(...)`)를 씌운다.
   tight 밴드(≤640px)에서 필터 영역은 70vw × (이름높이×3), 확장 영역까지
   합치면 사실상 화면 폭 전체. 모바일 DPR 3에서 매 프레임 CPU 래스터.
2. 동시에 풀스크린 SDF fragment shader(WebGL)가 DPR 2로 돌고 있어
   메인/래스터 스레드 여유가 없다.
3. `prefers-reduced-motion` 미지원.
4. `antialias: true`는 풀스크린 단일 쿼드에서 실효 없음 (셰이더가 자체 AA).

## 목표

- **모프/텍스트 등장 구간의 p95 프레임 타임을 최소화** (Frozen Metric의
  motion 축). 데스크톱 비주얼은 유지한다.
- 콘솔 에러 0, DOM/시각 검증 통과 유지.

## 수정 대상 (Level 2 — Inner Loop가 수정 가능)

- `web/components/ring/meta.js`
- `web/components/Carousel.jsx`
- `web/components/ring/params.js`
- `web/app/globals.css`
- `web/components/shaders/planeShaders.js` (Ashima/Gustavson 노이즈 고지 블록은 제외)

## 수정 불가

- `autoresearch/meta_eval/**` (Level 0)
- `autoresearch/eval/**` (Level 1.5 — Frozen Metric)
- `web/components/shaders/planeShaders.js`의 서드파티 노이즈 어트리뷰션
- `web/public/**` 라이선스 고지 관련 파일

## 가설 백로그 (한 번에 하나씩)

완료 (2026-08-17 ~ 08-18):
- H1: 모바일 이름 모프를 블러+SVG 대신 opacity/릴레이로. keep.
- H2: WebGL `antialias: false`. keep.
- H5: 데스크톱 blur 상한 — goo 멜트 제거로 대체됨 (feat-typo). keep.

리그가 못 보는 것 (점수 안 움직임, 실기기/접근성 작업):
- H3: 모바일 renderer pixel ratio 상한 2 → 1.5. 리그 DPR 1.
- H4: `prefers-reduced-motion`이면 모프/엔트리를 즉시 전환.
  → 009 keep (기본 경로 90.04, 회귀 없음).

다음 Inner (엔트리 p95가 83.4ms로 전 실험 고정 — 남은 신호):
- H6: 이미 녹아 사라진 허니 링크(rEnd ≤ −3)를 업로드/평가하지 않는다.
  정지·모프에서 8개가 −2.9로 살아 매 픽셀 `sdBridge`를 탄다.
  → 007a discard (점수 변화 없음, vsync 양자화).
- H7: tight 밴드에서 글래스 립을 끄고 패스를 링 AABB로 시저.
  빈 픽셀이 전 화면 SDF를 돌던 것이 엔트리 p95의 바닥이었다.
  → 007 keep (77.49 → 90.03).
- H8: 시드 탄생 워블(`uWobble`/snoise)을 끈다. discard 전에 전 픽셀
  simplex가 돈다. 엔트리 초반만 — p95는 이미 시저로 내려감.
- H9: 엔트리 동안(interactive 전) 허니 링크를 만들지 않는다.
- H10: tight에서 chromatic fringe만 0.
- H11: 시저 위에서 H6 재시도 — 이제 남는 픽셀이 카드 위라
  죽은 브릿지 8개가 모프 mean에 보일 수 있다.
- H12: 데스크톱(wide/narrow)은 글래스를 유지하되, 립 밖만
  시저로 자를 수 있는지 (두 밴드가 시저를 풀스크린으로 강제).

## 규칙

- 실험당 커밋 1개, 점수 악화 시 `git reset --hard HEAD~1`.
- 모든 실험을 `inner_results.tsv`에 기록 (실패 포함).
- eval 환경 설정(스로틀, 뷰포트)은 베이스라인에서 고정 후 절대 변경 금지.
