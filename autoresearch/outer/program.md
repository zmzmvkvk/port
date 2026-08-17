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

## 수정 불가

- `autoresearch/meta_eval/**` (Level 0)
- `autoresearch/eval/**` (Level 1.5 — Frozen Metric)
- `web/components/shaders/planeShaders.js`의 서드파티 노이즈 어트리뷰션
- `web/public/**` 라이선스 고지 관련 파일

## 가설 백로그 (한 번에 하나씩)

- H1: 모바일(coarse pointer 또는 tight 밴드)에서는 이름 모프를
  블러+SVG 필터 대신 순수 opacity 크로스페이드로 대체.
- H2: WebGL `antialias: false` (셰이더 자체 AA가 있으므로 무손실).
- H3: 모바일에서 renderer pixel ratio 상한을 2 → 1.5로.
- H4: `prefers-reduced-motion`이면 모프를 즉시 전환으로.
- H5: 데스크톱 모프도 blur 상한 100px → 32px로 (임계값 뒤라 시각 차 미미).

## 규칙

- 실험당 커밋 1개, 점수 악화 시 `git reset --hard HEAD~1`.
- 모든 실험을 `inner_results.tsv`에 기록 (실패 포함).
- eval 환경 설정(스로틀, 뷰포트)은 베이스라인에서 고정 후 절대 변경 금지.
