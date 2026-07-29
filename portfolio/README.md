# Career Systems Portfolio

기존 경력 데이터 대시보드와 분리된 Vite 기반 1페이지 포트폴리오다. 공개 콘텐츠의 유일한 입력은 `content/portfolio.json`이며 런타임 의존성은 없다.

## 로컬 실행

```bash
npm install
npm run assets:prototype
npm run dev
```

## 검증과 빌드

```bash
npm run test:unit
npm run validate
npm run build
npm run test:e2e -- --project=chromium
```

`npm run build`는 공개 콘텐츠, 미디어 규격, 파일당 25 MiB 제한, 초기 JavaScript 80 KiB gzip 제한, 중요 초기 전송량 1 MiB 제한을 검사한다.

## Cloudflare Pages

- 프로젝트 루트: `portfolio/`
- 빌드 명령: `npm run build`
- 출력 디렉터리: `dist/`
- Node.js: 22 이상

Cloudflare Web Analytics를 연결한 뒤 `index.html`의 `cf-beacon-token` 메타 값에 사이트 토큰을 넣으면 페이지뷰와 Web Vitals 수집 스크립트가 활성화된다. 토큰이 비어 있으면 외부 분석 요청을 만들지 않는다.

최종 생성 영상으로 교체할 때는 `docs/media-prompt-pack.md`의 프레임 인계 순서와 파일명을 유지한다.
