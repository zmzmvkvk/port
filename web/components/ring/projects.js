// Ring order, not filename order. Art is dealt straight down this list, so
// entry n sits one slot along from n-1 and the column can count 01..09 as the
// carousel turns. Reordering these rows moves the ring, the column and the
// numbering together; nothing else needs touching.
//
// 김서준 — 프론트엔드 · 웹 퍼블리싱 경력. 회사·프로젝트 설명은 공개 가능한
// 사실만 사용한 비식별 재구성이며, 검증되지 않은 수치는 상세 패널에서
// 자기보고로 표시한다.
// 카드 그림은 import 로 들여온다. 문자열 경로로 두면 Next 의 해시를 못 타고,
// 파일명이 고정이라 그림을 바꿔도 캐시가 옛것을 계속 내준다 — 실제로 한 번
// 겪었다. import 하면 src 가 내용 해시를 물고 나오므로 교체가 그대로 반영된다.
import card01 from "./cards/01.webp";
import card02 from "./cards/02.webp";
import card03 from "./cards/03.webp";
import card04 from "./cards/04.webp";
import card05 from "./cards/05.webp";
import card06 from "./cards/06.webp";
import card07 from "./cards/07.webp";
import card08 from "./cards/08.webp";
import card09 from "./cards/09.webp";

export const PROJECTS = [
  {
    file: card01.src,
    name: "메가스터디교육",
    type: "정규직 · 프론트엔드",
    year: "2026",
    period: "2026.03 — 현재",
    desc: [
      "모집안내·마이페이지·합격스토리·모의고사 신청 등 웹서비스 페이지 제작·유지보수.",
      "PC/모바일 반응형, 웹 표준, 접근성, 크로스브라우징 대응.",
      "AI 보조 제작 흐름을 개인 작업 규칙으로 구조화.",
    ],
    tags: ["HTML/CSS/JS", "반응형", "접근성", "AI 워크플로"],
  },
  {
    file: card02.src,
    name: "AI 퍼블리싱 자동화",
    type: "사내 도구",
    year: "2026",
    period: "사용 중",
    desc: [
      "개인의 마크업·스타일 규칙을 AI가 재현하도록 정리해 반복적인 웹 제작 흐름을 자동화한 내부 도구.",
      "작업 입력 → 코드 생성 → 직접 검토 흐름 설계.",
      "팀 공통 퍼블리싱 기준으로 공유해 결과물 일관성 확보. (자기보고)",
    ],
    tags: ["AI 워크플로", "작업 규칙", "품질 게이트"],
  },
  {
    file: card03.src,
    name: "roomy.page",
    type: "웹사이트",
    year: "2026",
    period: "2026.08",
    desc: [
      "이 사이트. WebGL 셰이더 카드 캐러셀(Viscose, MIT) 기반 포트폴리오.",
      "경력 온톨로지(사실·근거·주장 분리)에서 공개 안전한 데이터만 추출해 구성.",
      "Cloudflare Pages 정적 배포.",
    ],
    tags: ["WebGL", "Next.js", "Cloudflare"],
  },
  {
    file: card04.src,
    name: "버킷스토어",
    type: "프리랜스 · 퍼블리셔",
    year: "2025",
    period: "2025.10 — 2026.01",
    desc: [
      "크리스에프앤씨 패션 커머스 웹 퍼블리싱 단독 수행.",
      "이미지 중심 페이지의 로딩과 모바일 반응형 최적화.",
      "기획전 일정에 맞춘 PC·모바일 화면 제작과 유지보수.",
    ],
    tags: ["반응형", "이미지 로딩", "운영"],
  },
  {
    file: card05.src,
    name: "롯데백화점 앱",
    type: "정규직 · 프론트엔드",
    year: "2022–25",
    period: "2022.04 — 2025.08",
    desc: [
      "아이엠폼 소속, 대형 유통 앱의 기획전·이벤트 페이지 퍼블리싱 및 운영.",
      "반복 UI를 React 기반 템플릿과 공통 모듈로 구조화.",
      "iOS/Android 웹뷰 호환성 이슈를 분석하고 마크업 가이드 수립.",
    ],
    tags: ["React", "공통 템플릿", "WebView"],
  },
  {
    file: card06.src,
    name: "공통 템플릿 시스템",
    type: "운영 개선",
    year: "2024",
    period: "롯데백화점 앱 재직 중",
    desc: [
      "반복되는 프로모션 페이지 요소를 재사용 가능한 React 템플릿과 공통 모듈로 구조화.",
      "웹뷰에서 재현되는 스크롤·터치·모달 겹침 문제를 마크업 가이드로 사전 차단.",
      "이력서 기준 운영 생산성 30% 이상 향상으로 기록. (자기보고 · 검증 자료 보강 예정)",
    ],
    tags: ["React", "컴포넌트화", "운영 UI"],
  },
  {
    file: card07.src,
    name: "차병원 뉴스룸",
    type: "프리랜스 · 퍼블리셔",
    year: "2022",
    period: "2022.09 — 2022.10",
    desc: [
      "차바이오그룹 뉴스룸 반응형 웹 구축.",
      "웹 접근성과 가독성을 고려한 시맨틱 마크업.",
      "모듈화된 유지보수 구조 제공, PC·모바일 구축 범위 완료.",
    ],
    tags: ["시맨틱 마크업", "접근성", "반응형"],
  },
  {
    file: card08.src,
    name: "하마그룹",
    type: "정규직 · 프론트엔드",
    year: "2021",
    period: "2021.06 — 2021.11",
    desc: [
      "Vue.js 공통 UI 컴포넌트 구현, SCSS 기반 디자인 시스템 코드화.",
      "반응형 레이아웃·라우터·다국어(i18n) 처리.",
      "공통 UI와 다국어 대응 화면의 구현 업무 수행.",
    ],
    tags: ["Vue.js", "SCSS", "i18n"],
  },
  {
    file: card09.src,
    name: "Taylor's University",
    type: "학력 · 학사",
    year: "2020",
    period: "2016.08 — 2020.10",
    desc: [
      "International Hospitality Management 학사, 말레이시아 · 졸업.",
      "다른 언어·문화권에서 학업을 완주.",
      "서비스 품질과 고객 경험을 다루는 도메인 감각.",
    ],
    tags: ["Hospitality", "글로벌"],
  },
];

export const IMAGE_FILES = PROJECTS.map((p) => p.file);
