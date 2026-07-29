# Project Memory — Career Systems Portfolio

## Current status

- Updated: 2026-07-29
- Application: `portfolio/`
- Stack: Vite, semantic HTML, CSS, Vanilla JavaScript ES modules
- Runtime dependencies: none
- Deployment target: Cloudflare Pages
- Existing root career dashboard remains separate and unchanged.

## Product intent

Present operational frontend and publishing experience as a progression from
repeated problems to rules, reusable modules, and tools. The site is a
single-page studio experience with six career scenes:

1. Megastudy Education
2. Bucketstore
3. Lotte Department Store
4. CHA Bio Newsroom
5. Hama Group
6. Synthesis

The public captions follow role → recurring problem → changed structure →
verified scope. Unverified claims in `data/claims.json` must never be published.

## Architecture

- `portfolio/content/portfolio.json`: only public content input
- `portfolio/src/main.js`: rendering, mode selection, hash navigation, scrub runtime
- `portfolio/src/lib/timeline.js`: timeline and media-source calculations
- `portfolio/src/lib/media-pool.js`: Blob fetching, retry, abort, LRU eviction
- `portfolio/src/styles.css`: video and static layouts
- `portfolio/scripts/`: prototype asset generation and build validation
- `portfolio/tests/`: Vitest and Playwright coverage
- `portfolio/docs/media-prompt-pack.md`: final media generation contract

## Implemented behavior

- Six scene clips and five connector clips for desktop and mobile
- Poster-first rendering and deferred MP4 loading
- Maximum five retained Blob/video segments
- Abort, URL revocation, one retry after 1.5 seconds, poster fallback, manual retry
- Hash navigation and keyboard timeline controls
- Static mode for reduced motion and Save-Data
- `portfolio.motion = auto | video | static` preference
- Zero MP4 requests in static mode
- Aspect-ratio source remount while preserving progress
- Cloudflare Pages headers and SPA redirect
- Optional Cloudflare Web Analytics token in `portfolio/index.html`

## Validation snapshot

The following passed on 2026-07-29:

- `npm run test:unit`: 10 tests
- `npm run test:e2e`: 40 tests across Chromium, Edge, Firefox, WebKit, and mobile Safari
- `npm run build`
- Media contract: 22 MP4 and 34 WebP
- H.264, 30fps, yuv420p, GOP, faststart, no audio, size budgets, SSIM ≥ 0.99
- Production JavaScript: 7.3 KiB gzip
- Critical initial assets: 34.5 KiB

## Continue on another computer

```bash
git pull
cd portfolio
npm install
npm run test:unit
npm run build
npx playwright install chromium firefox webkit
npm run test:e2e
```

Prototype media is committed. Run `npm run assets:prototype` only when it needs
to be regenerated.

## Remaining external work

- Replace abstract prototype media with the approved GPT Image/Grok chain using
  `portfolio/docs/media-prompt-pack.md`.
- Add the Cloudflare Web Analytics token.
- Deploy `portfolio/` to Cloudflare Pages (`npm run build`, output `dist/`).
- Measure deployed p75 Core Web Vitals and real-device scrub FPS.

