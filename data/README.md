# Career Data Layer

이 폴더는 포트폴리오를 만들기 전의 **공개 안전한 커리어 지식 그래프**입니다.

## 폴더 구조

```text
data/
├── ontology/       # entity/relation/claim 구조와 규칙
├── entities/       # profile, experiences, projects, education, skills
├── evidence/       # 출처와 검증 상태
├── views/          # 목적별 큐레이션 뷰
├── templates/      # 새 데이터 입력 템플릿
├── private/        # 개인정보/원문. README 외 커밋 금지
├── index.json      # 대시보드가 읽는 컬렉션 매니페스트
└── relations.json  # 엔티티 간 관계
```

## 왜 이렇게 나누는가

- `entities`: 무엇이 있었는지 — 경험, 프로젝트, 역량
- `evidence`: 그것을 어디서 확인할 수 있는지
- `relations`: 경험이 어떤 역량·성과·프로젝트로 이어지는지
- `views`: 특정 지원 직무나 포트폴리오 페이지에 어떤 데이터만 보여줄지
- `private`: 공개 저장소에 노출하면 안 되는 원문

수치가 들어간 성과는 `claims`와 `evidence`를 통해 **사실 / 자기보고 / 검증 필요**를 구분합니다.
