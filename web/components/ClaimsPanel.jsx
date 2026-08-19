"use client";

import { useEffect, useRef, useState } from "react";
import { CLAIMS, CLAIMS_INTRO, CLAIM_STATUS } from "./ring/claims";

const FACE = '"Freesentation", ui-sans-serif, system-ui, sans-serif';
const IN = "cubic-bezier(.16,.84,.44,1)";

/**
 * 이 사이트가 하는 주장을 한자리에 모아 놓은 면. 링에서 카드로 여는 것이
 * 아니라 따로 열린다 — 특정 작업의 이야기가 아니라 사이트 전체에 대한
 * 이야기라서, 어느 카드 안에 들어가면 그 카드의 주장으로만 읽힌다.
 *
 * 상세 레이어와 같은 규칙을 따른다: 배경은 inert 가 되고, 포커스는 안에
 * 머물고, Escape 로 닫히고, 닫으면 링으로 초점이 돌아간다. 다른 점은 링이
 * 뒤로 물러나지 않는다는 것뿐이다 — 카드 속으로 들어가는 동작이 아니므로
 * 비행도 없다.
 */
export default function ClaimsPanel() {
  const [open, setOpen] = useState(false);
  const [shown, setShown] = useState(false);
  const dialogRef = useRef(null);
  const timerRef = useRef(0);

  const show = () => {
    clearTimeout(timerRef.current);
    // 링을 inert 로 만들어 달라는 신호. 상세 레이어가 쓰는 것과 같은 통로다.
    window.dispatchEvent(new CustomEvent("viscose:overlay", { detail: true }));
    setOpen(true);
  };

  const close = () => {
    setShown(false);
    window.dispatchEvent(new CustomEvent("viscose:overlay", { detail: false }));
    timerRef.current = setTimeout(() => setOpen(false), 360);
  };

  // Escape 는 열려 있을 때만 듣는다. 항상 걸어 두면 다른 레이어의 Escape 와
  // 겹쳐서, 닫을 것이 없는데도 신호를 흘리게 된다.
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => () => clearTimeout(timerRef.current), []);

  useEffect(() => {
    if (!open) return;
    const raf = requestAnimationFrame(() => {
      setShown(true);
      dialogRef.current?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(raf);
  }, [open]);

  const rise = (i) => ({
    opacity: shown ? 1 : 0,
    transform: shown ? "none" : "translate3d(0, 14px, 0)",
    transitionProperty: "opacity, transform",
    transitionDuration: shown ? "440ms" : "160ms",
    transitionTimingFunction: shown ? IN : "ease-in",
    transitionDelay: shown ? `${i * 70}ms` : "0ms",
  });

  return (
    <>
      {/* 색인 아래에 조용히 선다. 이 사이트가 스스로에 대해 하는 말이라
          작업 카드들과 나란히 두지 않는다. */}
      <button
        type="button"
        onClick={show}
        style={{ fontFamily: FACE }}
        className="pointer-events-auto fixed bottom-[2.4vh] right-[5.5vw] z-20 rounded-full border border-black/15 px-3.5 py-1.5 text-xs text-black/50 transition hover:bg-black/5 hover:text-black/70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#a2542f]"
      >
        주장과 근거
      </button>

      {open ? (
        <div
          className={`fixed inset-0 z-50 overflow-y-auto bg-[#fafafa]/[.96] text-[#0a0a0a] transition-opacity duration-[360ms] ease-out ${
            shown ? "opacity-100" : "opacity-0"
          }`}
          onClick={close}
          role="presentation"
        >
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            tabIndex={-1}
            aria-label={CLAIMS_INTRO.title}
            onClick={(e) => e.stopPropagation()}
            style={{ fontFamily: FACE }}
            className="mx-auto flex min-h-full w-full max-w-2xl flex-col justify-center gap-9 px-6 py-16 sm:px-8"
          >
            <header
              style={rise(0)}
              className="flex items-start justify-between gap-6"
            >
              {" "}
              {/* prettier-ignore */}
              <div>
                <h2 className="text-[clamp(1.6rem,5vw,2.4rem)] font-medium leading-tight tracking-[-0.015em]">
                  {CLAIMS_INTRO.title}
                </h2>
                <p className="mt-4 max-w-prose text-[15px] leading-[1.7] text-black/70">
                  {CLAIMS_INTRO.body}
                </p>
              </div>
              <button
                type="button"
                onClick={close}
                aria-label="닫기"
                className="mt-1 shrink-0 rounded-full border border-black/15 px-4 py-1.5 text-sm text-black/60 transition hover:bg-black/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#a2542f]"
              >
                닫기
              </button>
            </header>

            <ol className="flex flex-col gap-8 border-t border-black/10 pt-8">
              {CLAIMS.map((c, i) => {
                const st = CLAIM_STATUS[c.status];
                return (
                  <li key={c.id} style={rise(1 + i)}>
                    <p className="flex items-center gap-2 text-[11px] font-medium tracking-[0.08em]">
                      <span
                        aria-hidden="true"
                        className="h-1.5 w-1.5 rounded-full"
                        style={{ background: st.tone }}
                      />
                      <span style={{ color: st.tone }}>{st.label}</span>
                    </p>
                    <p className="mt-2 text-[17px] leading-[1.5]">{c.what}</p>
                    <p className="mt-1 text-[13px] text-black/45">{c.where}</p>

                    <dl className="mt-4 grid grid-cols-[4.5rem_minmax(0,1fr)] gap-x-4 gap-y-2 text-[14px] leading-[1.65]">
                      <dt className="pt-px text-[11px] tracking-[0.08em] text-black/35">
                        출처
                      </dt>
                      <dd className="text-black/70">{c.source}</dd>
                      <dt className="pt-px text-[11px] tracking-[0.08em] text-black/35">
                        근거
                      </dt>
                      <dd className="text-black/70">
                        {c.evidence ?? "아직 공개 가능한 근거가 없다."}
                      </dd>
                      <dt className="pt-px text-[11px] tracking-[0.08em] text-black/35">
                        확인하려면
                      </dt>
                      <dd className="text-black/70">{c.toVerify}</dd>
                    </dl>
                  </li>
                );
              })}
            </ol>

            <p
              style={rise(1 + CLAIMS.length)}
              className="border-t border-black/10 pt-5 text-xs leading-relaxed text-black/40"
            >
              회사 내부 자료·고객 데이터·사내 URL은 근거로 올리지 않는다.
              비식별화해 옮길 수 있는 것만 여기에 쌓는다.
            </p>
          </div>
        </div>
      ) : null}
    </>
  );
}
