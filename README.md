# 포트폴리오 백그라운드 온톨로지

취업용 포트폴리오를 만들기 전에 **경력·프로젝트·역량·성과·근거를 분리하고 서로 연결해 두는 작업공간**입니다. 여기서 정리한 사실을 골라 공개 페이지로 내보냅니다.

```text
port/
├─ data/           경력 온톨로지 (사실 · 근거 · 주장)
├─ index.html      백그라운드 대시보드
├─ dashboard.css
├─ dashboard.js
└─ site/           roomy.page 배포 소스 (HTML + CSS)
```

## 핵심 원칙

```text
원문/기억 → 사실(fact) → 근거(evidence) → 해석(insight) → 지원서 문장(narrative)
```

대시보드에는 현재 확인된 정보와 이력서 보관함에서 추출한 정보만 넣습니다. 수치나 성과는 출처와 검증 상태를 함께 표시하며, 근거가 없는 숫자는 공개 페이지에서 사실로 확정하지 않습니다.

## 백그라운드 대시보드

정적 파일이라 빌드가 없습니다.

```bash
python -m http.server 8787
# http://localhost:8787/
```

`fetch()`로 JSON을 읽기 때문에 `file://`로 직접 열지 말고 HTTP 서버를 사용합니다.

- 온톨로지 정의: `data/ontology/README.md`, `data/ontology/schema.json`
- 공개 가능한 경력 데이터: `data/`
- 로컬에서만 보관할 원문·개인정보: `data/private/` (Git에 커밋하지 않음)

## 데이터 추가 순서

1. 원문을 `data/private/` 또는 로컬 보관소에 보관합니다.
2. `data/templates/`의 템플릿을 복사해 공개 안전한 엔티티를 추가합니다.
3. 새로운 사실에는 `sourceRefs`, `confidence`, `verificationStatus`를 붙입니다.
4. 서로 다른 엔티티 사이의 의미는 `data/relations.json`에 연결합니다.
5. 대시보드에서 읽히는지 확인한 뒤 커밋합니다.

## 공개 페이지 — `site/`

https://roomy.page 에 올라가는 실제 페이지입니다. 빌드 도구·프레임워크·JavaScript 없이 HTML과 CSS 두 파일로만 구성했습니다.

```text
site/
  index.html    본문
  main.css      스타일
  _headers      보안 헤더 + 캐시 정책
  robots.txt
  sitemap.xml
  README.md     공개용 한 줄 설명
```

전체 약 25 KB, 외부 요청 0건입니다. 시스템 폰트와 인라인 SVG만 쓰고 CDN·분석 스크립트를 붙이지 않습니다. 경력 인덱스 숫자(01~05)는 CSS `counter()`로 생성하므로 본문 텍스트에 없습니다.

본문 대비는 WCAG AA(4.5:1) 이상을 유지합니다. `--fg-3`은 문제/한 일/결과 라벨과 푸터에 쓰이므로 톤을 바꿀 때 대비를 다시 확인하세요.

### 로컬 확인

```bash
cd site && python -m http.server 8791
# http://localhost:8791/
```

라이트/다크는 `prefers-color-scheme`로 자동 전환합니다. 히어로와 작업 원칙은 **반전 판**이라 본문과 항상 반대 톤으로 뒤집힙니다(라이트에선 검정, 다크에선 흰색). 좁은 화면에서 2단 그리드가 1단으로 접히고, 인쇄 시 반전 판은 흰 배경으로 되돌아갑니다. 전체 톤은 `main.css` 상단의 커스텀 속성만 바꾸면 됩니다. 액센트는 러스트 계열 하나(`--accent`)만 씁니다.

### CSS 파일명 규칙 — 중요

Cloudflare 존 설정이 브라우저 캐시 TTL을 4시간으로 강제하고 있어서, `_headers`에 `max-age=0`을 적어도 덮어써집니다. **CSS를 크게 고쳤는데 반영이 안 되면 캐시 때문입니다.** 두 가지 중 하나로 해결합니다.

1. 파일명을 바꾼다 (`main.css` → `main2.css`). `index.html`의 `href`와 `_headers` 경로도 같이 바꿉니다. 확실하고 즉시 반영됩니다.
2. Cloudflare 대시보드 → roomy.page → Caching → Configuration에서 Browser Cache TTL을 "Respect Existing Headers"로 바꿉니다. 한 번 바꿔두면 이후 파일명을 고정해도 됩니다.

### 배포

Cloudflare Pages 프로젝트 `roomy-portfolio`에 직접 업로드합니다. 저장소 루트에서 실행합니다.

```bash
npx wrangler login                    # 최초 1회
npx wrangler pages deploy site --project-name=roomy-portfolio --branch=main
```

| 항목 | 값 |
| --- | --- |
| Pages 프로젝트 | `roomy-portfolio` |
| 프로덕션 브랜치 | `main` |
| 기본 도메인 | https://roomy-portfolio.pages.dev |
| 커스텀 도메인 | https://roomy.page, https://www.roomy.page |

DNS는 `roomy.page` 존에 아래 두 레코드가 프록시(주황 구름) 상태로 등록되어 있습니다.

```text
CNAME  roomy.page      -> roomy-portfolio.pages.dev  (proxied)
CNAME  www.roomy.page  -> roomy-portfolio.pages.dev  (proxied)
```

### 문구를 고칠 때

`site/index.html`을 직접 수정합니다. 고친 문구가 `data/claims.json`의 `status`와 어긋나지 않게 맞춥니다. 검증되지 않은 수치는 본문에 `자기보고` 배지를 달아 구분하고, 근거가 생기면 배지를 걷어냅니다.

## 개인정보 안전

연락처·주소·생년월일·병역 세부정보·지원서 원문·회사 내부 자료는 공개 저장소에 넣지 않습니다. 이 저장소에는 이름과 공개용 경력 요약만 두고, 민감한 원문은 `data/private/`에만 둡니다. `site/`의 회사·프로젝트 설명은 공개 가능한 사실만 사용한 비식별 재구성입니다.
