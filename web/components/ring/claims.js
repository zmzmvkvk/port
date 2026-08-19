/**
 * 이 사이트가 하는 주장과, 그 주장이 지금 어디까지 확인됐는지.
 *
 * 저장소의 `data/claims.json` 을 웹이 읽을 수 있게 옮겨 둔 것이다. 원본에는
 * status / needsEvidence / nextEvidence 가 처음부터 들어 있었는데 화면에는
 * "자기보고" 딱지 하나로만 나오고 있었다 — 03번 카드가 "사실·근거·주장을
 * 나눠 둔 위에서 링을 돌린다"고 말해 놓고, 정작 그 분리를 보여 주지 않았다.
 *
 * 셋 다 아직 자기보고다. 근거 폴더(`data/evidence/`)는 비어 있고, 그 사실을
 * 숨기지 않고 적는다. 수치를 지우면 정직해지지만 아무 말도 안 하는 이력서가
 * 되고, 그냥 두면 검증할 곳이 없는 자랑이 된다. 남는 길은 수치를 두되 그것이
 * 무엇인지, 무엇이 있으면 확인되는지 같이 적는 것뿐이다.
 *
 * 새 근거가 생기면 `evidence` 를 채우고 `status` 를 옮긴다. 이 파일과
 * data/claims.json 은 손으로 맞춘다 — 정적 배포라 빌드 때 읽어 올 수 없다.
 */

export const CLAIM_STATUS = {
  verified: { label: "확인됨", tone: "#2f6b46" },
  reported: { label: "자기보고", tone: "#a2542f" },
  estimated: { label: "추정", tone: "#7a7a7a" },
};

export const CLAIMS = [
  {
    id: "lotte-productivity",
    where: "롯데백화점 앱 · 공통 템플릿 시스템",
    what: "운영 생산성 30% 이상 향상",
    status: "reported",
    source: "이력서에 적어 온 기록",
    // 원본 claims.json 의 nextEvidence 를 그대로 옮긴다. 이 문장이 이
    // 레이어의 핵심이다 — 무엇이 없는지 아는 사람만 쓸 수 있는 문장이라서.
    toVerify:
      "작업 전후 샘플 수, 평균 제작 시간, 기간을 다시 계산하고 가능하면 동료 확인을 붙인다.",
    evidence: null,
  },
  {
    id: "webview-stability",
    where: "롯데백화점 앱 · 공통 템플릿 시스템",
    what: "웹뷰에서 반복되던 스크롤·터치·모달 겹침을 마크업 가이드로 사전 차단",
    status: "reported",
    source: "재직 중 작성한 가이드 문서",
    toVerify:
      "문제 유형, 재현 환경, 해결 전후의 티켓·QA 기록을 비식별화해 남긴다.",
    evidence: null,
  },
  {
    id: "ai-publishing-standard",
    where: "AI 퍼블리싱 자동화",
    what: "개인 규칙으로 만든 자동화를 팀 공통 퍼블리싱 기준으로 공유",
    status: "reported",
    source: "사내에서 쓰는 도구",
    toVerify:
      "팀 공유 문서, 사용 전후 예시, 실제 사용 인원을 내부정보를 지운 뒤 기록한다.",
    evidence: null,
  },
];

// 레이어 맨 위에 서는 문장. 이 사이트에서 가장 중요한 카피일 수 있어서,
// 고칠 때는 여기만 고치면 되도록 한자리에 둔다.
export const CLAIMS_INTRO = {
  title: "주장과 근거",
  body: "포트폴리오의 수치는 대개 검증할 곳 없이 적힌다. 그래서 이 사이트는 수치를 지우는 대신, 그것이 어디까지 확인된 것인지 같이 적는다. 아래 셋은 모두 아직 자기보고다 — 공개 가능한 근거가 아직 없다는 뜻이고, 무엇이 있으면 확인되는지도 함께 적어 둔다.",
};
