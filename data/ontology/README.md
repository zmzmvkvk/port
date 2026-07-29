# Career Ontology v1

이 온톨로지는 취업용 포트폴리오 제작 전 단계에서 **경험을 과장 없이 재구성하고 재사용**하기 위한 최소 모델입니다.

## 모델

### 1. Entity — 존재하는 대상

| 타입 | 의미 | 예시 |
|---|---|---|
| `person` | 후보자 | 김서준 |
| `employment` | 회사/팀에서의 고용 경험 | 메가스터디교육 웹제작팀 |
| `freelance` | 외부 계약/프리랜스 경험 | 버킷스토어 |
| `project` | 제품·도구·서비스 단위 | 퍼블리싱 자동화 도구, Roomy |
| `education` | 학력·교육 | Taylor's University |
| `skill` | 실제 작업으로 입증 가능한 역량 | Vue, 접근성, 자동화 |
| `claim` | 포트폴리오 문장으로 발전할 수 있는 원자 주장 | 제작 시간 30% 이상 단축 |
| `evidence` | 주장이나 경험을 뒷받침하는 출처 | 이력서 보관함, 캡처, 링크 |

### 2. Relation — 대상 사이의 의미

- `person HELD_ROLE_IN employment`
- `person BUILT project`
- `employment PRODUCED claim`
- `project DEMONSTRATES skill`
- `claim SUPPORTED_BY evidence`
- `experience USED skill`
- `project EVOLVED_FROM employment`

### 3. Claim lifecycle — 주장 상태

```text
captured → self-reported → corroborated → portfolio-ready
                       ↘ needs-evidence
```

- `self-reported`: 이력서/기억에 있으나 외부 증거가 아직 없음
- `corroborated`: 캡처·로그·동료 확인·공개 URL 등 추가 근거가 있음
- `portfolio-ready`: 공개해도 안전하고 범위·역할·결과가 명확함
- `needs-evidence`: 숫자·영향을 최종 문장에 쓰기 전 증거 보강 필요

## 기록 규칙

1. 한 레코드에는 한 가지 의미만 기록합니다.
2. 기간은 `YYYY-MM` 또는 `YYYY-MM-DD`를 사용합니다.
3. `sourceRefs` 없는 강한 주장은 만들지 않습니다.
4. 숫자는 `metric`, `measurement`, `provenance`를 함께 기록합니다.
5. 회사 내부 정보는 회사명·제품명·고객 데이터를 공개 가능한 수준으로 추상화합니다.
6. 성공담보다 **문제 → 행동 → 결과 → 검증 근거**의 연결을 우선합니다.

## 포트폴리오 생성 관점

최종 포트폴리오 페이지는 이 그래프에서 다음 경로를 선택해 생성할 수 있습니다.

```text
지원 직무 → 필요한 capability → 관련 project/employment → claim → evidence → case study
```
