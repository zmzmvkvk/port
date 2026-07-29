# Architecture Decisions

## ADR-001: Independent Vite application

The career studio lives under `portfolio/` and does not replace the existing
root data dashboard.

## ADR-002: Pre-rendered video instead of WebGL

The spatial effect uses H.264 video scrubbing. This keeps the runtime small,
avoids a 3D engine dependency, and supports a complete static fallback.

## ADR-003: Public content boundary

`portfolio/content/portfolio.json` is the only public content input. Build
validation compares it with `data/claims.json` and fails on unverified claim
references, private locators, contact details, or oversized files.

## ADR-004: Accessible static path

Reduced motion and Save-Data default to static mode. A user can explicitly
enable video, and the choice is kept in local storage.

## ADR-005: Prototype media is replaceable

The committed 22 MP4 and 34 WebP files are non-identifying technical prototype
assets. Final generated media must preserve the filenames and handoff contract.

