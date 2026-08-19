import { CLAIMS, CLAIMS_INTRO, CLAIM_STATUS } from "./ring/claims";
import { ASIDES, PROFILE, PROJECTS } from "./ring/projects";

/**
 * 이 페이지에서 유일하게 "읽을 수 있는" 문서.
 *
 * 링은 전부 WebGL 이라 문서에 남는 텍스트가 없었다. 측정해 보면 본문 텍스트는
 * 프로젝트 이름 아홉 개가 전부였고(당시 링은 아홉 장이었다), h1 도 링크도 랜드마크도 0개, 심지어
 * 지원자 이름조차 본문에 없었다(그것도 셰이더가 그린다). 결과적으로
 * 스크린리더 사용자는 작업의 내용에 도달할 방법이 없었고, 검색엔진이
 * 색인할 것은 아홉 단어였으며, WebGL 이 실패한 브라우저는 빈 화면을 봤다.
 *
 * 그래서 같은 내용을 마크업으로도 낸다. 상세 패널과 같은 순서 — 한 줄, 문제,
 * 한 일, 남긴 것 — 로 적어서 둘이 갈라지지 않게 한다. 평소에는 시각적으로 숨어
 * 있고(캔버스가 이미 같은 내용을 보여 준다), 스크린리더와 크롤러에게는 항상
 * 열려 있다. JavaScript 가 꺼져 있으면 layout.js 의 noscript 스타일이 클립만
 * 풀어 준다 — 마크업 한 벌이 세 경우를 모두 감당한다.
 *
 * 포커스 가능한 요소는 일부러 넣지 않았다. 보이지 않는 곳에 탭 정지점을 두면
 * 눈으로 보며 키보드를 쓰는 사람이 초점을 잃는다. 링 조작은 Carousel 이 캔버스
 * 자체에 키보드 핸들러를 달아 처리한다.
 */
export default function ReadableCopy() {
  return (
    <main id="copy" className="readable-copy">
      <h1>
        {PROFILE.name} — {PROFILE.role}
      </h1>
      <p>{PROFILE.summary}</p>

      <h2>작업</h2>
      <ol>
        {PROJECTS.map((p, i) => (
          <li key={p.name}>
            <h3>
              <span aria-hidden="true">{String(i + 1).padStart(2, "0")}. </span>
              {p.name}
            </h3>
            <p>
              {p.type} · {p.role} · {p.period}
            </p>
            <p>{p.line}</p>

            <h4>문제</h4>
            <p>{p.problem}</p>

            <h4>한 일</h4>
            <ul>
              {p.did.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>

            <h4>남긴 것</h4>
            <p>{p.left}</p>
            {p.reported ? <p>자기보고 — {p.reported}</p> : null}

            {/* 그 자리 안에서 따로 만든 것. 링에서는 부모 카드 안에 접혀
                있으므로, 문서에서도 같은 자리에 둔다. */}
            {p.inside ? (
              <>
                <h4>이 자리 안에서 — {p.inside.name}</h4>
                <p>{p.inside.line}</p>
                <p>
                  {p.inside.role} · {p.inside.period}
                </p>
                <p>{p.inside.problem}</p>
                <ul>
                  {p.inside.did.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
                <p>{p.inside.left}</p>
                {p.inside.reported ? (
                  <p>자기보고 — {p.inside.reported}</p>
                ) : null}
                <p>{p.inside.tags.join(", ")}</p>
              </>
            ) : null}

            <p>{p.tags.join(", ")}</p>
          </li>
        ))}
      </ol>

      {/* 화면의 '주장과 근거' 레이어와 같은 내용. 둘이 갈라지면 어느 쪽이
          맞는지 알 수 없게 되므로 같은 데이터에서 낸다. */}
      <h2>{CLAIMS_INTRO.title}</h2>
      <p>{CLAIMS_INTRO.body}</p>
      <ol>
        {CLAIMS.map((c) => (
          <li key={c.id}>
            <h3>{c.what}</h3>
            <p>
              {CLAIM_STATUS[c.status].label} · {c.where}
            </p>
            <p>출처 — {c.source}</p>
            <p>근거 — {c.evidence ?? "아직 공개 가능한 근거가 없다."}</p>
            <p>확인하려면 — {c.toVerify}</p>
          </li>
        ))}
      </ol>

      {/* 링에 두지 않은 것들. 맡아서 만든 화면과는 층위가 달라 카드로 세우지
          않았을 뿐, 지울 내용은 아니다. */}
      <h2>그 밖에</h2>
      <ol>
        {ASIDES.map((a) => (
          <li key={a.name}>
            <h3>{a.name}</h3>
            <p>
              {a.type} · {a.role} · {a.period}
            </p>
            <p>{a.line}</p>
            <p>{a.problem}</p>
            <ul>
              {a.did.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
            <p>{a.left}</p>
            <p>{a.tags.join(", ")}</p>
          </li>
        ))}
      </ol>

      <p>
        공개 가능한 사실만 사용한 비식별 재구성입니다. 검증되지 않은 수치는
        자기보고로 표시했습니다.
      </p>
    </main>
  );
}
