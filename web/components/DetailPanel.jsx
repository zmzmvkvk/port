"use client";

import { useEffect, useRef, useState } from "react";
import { PROJECTS } from "./ring/projects";

const FACE = '"Freesentation", ui-sans-serif, system-ui, sans-serif';
const IN = "cubic-bezier(.16,.84,.44,1)";

/**
 * 앞면 카드를 클릭하면 Carousel이 카드 속으로 날아 들어가고, 그 비행이
 * 끝나기 전에(viscose:open) 이 레이어가 확대된 카드 아트 위로 떠오른다.
 * 팝업이 아니라 그 카드의 안쪽 면 — 한 줄 주장, 그리고 문제 / 한 일 / 남긴 것.
 */
// 컴포넌트 밖에 둔다. render 안에서 정의하면 렌더마다 새로운 타입이 되어
// 자식이 매번 언마운트·재마운트되고, 방금 붙인 전환이 처음부터 다시 시작한다.
function Section({ style, label, children }) {
  return (
    <section
      style={style}
      className="grid grid-cols-[4.5rem_minmax(0,1fr)] gap-x-4 gap-y-1"
    >
      <h3
        style={{ fontFamily: FACE }}
        className="pt-1 text-[11px] font-medium tracking-[0.08em] text-[#a2542f]"
      >
        {label}
      </h3>
      <div className="text-[15px] leading-[1.65] text-black/80">{children}</div>
    </section>
  );
}

export default function DetailPanel() {
  const [index, setIndex] = useState(-1);
  const [shown, setShown] = useState(false);
  const dialogRef = useRef(null);
  const timerRef = useRef(0);

  const close = () => {
    setShown(false);
    window.dispatchEvent(new CustomEvent("viscose:close"));
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setIndex(-1), 420);
  };

  useEffect(() => {
    const onOpen = (e) => {
      clearTimeout(timerRef.current);
      setIndex(e.detail);
    };
    const onKey = (e) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("viscose:open", onOpen);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("viscose:open", onOpen);
      window.removeEventListener("keydown", onKey);
      clearTimeout(timerRef.current);
    };
  }, []);

  useEffect(() => {
    if (index < 0) return;
    const raf = requestAnimationFrame(() => {
      setShown(true);
      // 닫기 버튼이 아니라 레이어 자신에 초점을 준다. 스크린리더가
      // 먼저 읽어야 하는 것은 "닫기 버튼"이 아니라 어떤 작업을 열었는가다.
      dialogRef.current?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(raf);
  }, [index]);

  const project = index >= 0 ? PROJECTS[index] : null;
  if (!project) return null;

  const rise = (i) => ({
    opacity: shown ? 1 : 0,
    transform: shown ? "none" : "translate3d(0, 16px, 0)",
    transitionProperty: "opacity, transform",
    transitionDuration: shown ? "440ms" : "160ms",
    transitionTimingFunction: shown ? IN : "ease-in",
    transitionDelay: shown ? `${i * 70}ms` : "0ms",
  });

  return (
    <div
      className={`fixed inset-0 z-50 overflow-y-auto bg-[#fafafa]/[.93] text-[#0a0a0a] transition-opacity duration-[360ms] ease-out ${
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
        aria-label={project.name}
        onClick={(e) => e.stopPropagation()}
        style={{ fontFamily: FACE }}
        className="mx-auto flex min-h-full w-full max-w-2xl flex-col justify-center gap-8 px-6 py-16 sm:px-8"
      >
        <header
          style={rise(0)}
          className="flex items-baseline justify-between gap-4"
        >
          <p
            style={{ fontFamily: FACE }}
            className="text-sm tracking-[0.02em] text-black/50"
          >
            <span className="text-[#a2542f]">
              {String(index + 1).padStart(2, "0")}
            </span>
            {"  ·  "}
            {project.type}
            {"  ·  "}
            {project.year}
          </p>
          <button
            type="button"
            onClick={close}
            aria-label="닫기"
            className="shrink-0 rounded-full border border-black/15 px-4 py-1.5 text-sm text-black/60 transition hover:bg-black/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#a2542f]"
          >
            닫기
          </button>
        </header>

        <div style={rise(1)}>
          <h2 className="text-[clamp(2.1rem,8vw,4rem)] font-medium leading-[1.08] tracking-[-0.015em]">
            {project.name}
          </h2>
          <p className="mt-4 max-w-prose text-[17px] leading-[1.55] text-black/80">
            {project.line}
          </p>
          <p
            style={{ fontFamily: FACE }}
            className="mt-3 text-sm text-black/45"
          >
            {project.role}
            {"  ·  "}
            {project.period}
          </p>
        </div>

        <div className="flex max-w-prose flex-col gap-6 border-t border-black/10 pt-7">
          <Section style={rise(2)} label="문제">
            <p>{project.problem}</p>
          </Section>
          <Section style={rise(3)} label="한 일">
            <ul className="flex flex-col gap-2">
              {project.did.map((line) => (
                <li key={line} className="flex gap-2.5">
                  <span
                    aria-hidden="true"
                    className="mt-[11px] h-1 w-1 shrink-0 rounded-full bg-[#a2542f]"
                  />
                  {line}
                </li>
              ))}
            </ul>
          </Section>
          <Section style={rise(4)} label="남긴 것">
            <p>{project.left}</p>
            {project.reported ? (
              <p className="mt-2 text-[13px] leading-relaxed text-black/45">
                자기보고 — {project.reported}
              </p>
            ) : null}
          </Section>
        </div>

        {/* 이 자리 안에서 따로 만든 것. 형제 카드로 두면 3년짜리 재직과 그 안의
            작업이 같은 무게로 보이므로, 안에 접어 둔 채로 제 몫만큼만 낸다. */}
        {project.inside ? (
          <div
            style={rise(5)}
            className="max-w-prose border-t border-black/10 pt-7"
          >
            <p
              style={{ fontFamily: FACE }}
              className="text-[11px] font-medium tracking-[0.08em] text-[#a2542f]"
            >
              이 자리 안에서
            </p>
            <h3 className="mt-2 text-[19px] font-medium leading-snug">
              {project.inside.name}
            </h3>
            <p className="mt-2 text-[15px] leading-[1.65] text-black/80">
              {project.inside.line}
            </p>
            <p
              style={{ fontFamily: FACE }}
              className="mt-2 text-[13px] text-black/45"
            >
              {project.inside.role}
              {"  ·  "}
              {project.inside.period}
            </p>
            <p className="mt-4 text-[15px] leading-[1.65] text-black/70">
              {project.inside.problem}
            </p>
            <ul className="mt-3 flex flex-col gap-2 text-[15px] leading-[1.65] text-black/80">
              {project.inside.did.map((line) => (
                <li key={line} className="flex gap-2.5">
                  <span
                    aria-hidden="true"
                    className="mt-[11px] h-1 w-1 shrink-0 rounded-full bg-[#a2542f]"
                  />
                  {line}
                </li>
              ))}
            </ul>
            <p className="mt-3 text-[15px] leading-[1.65] text-black/70">
              {project.inside.left}
            </p>
            {project.inside.reported ? (
              <p className="mt-2 text-[13px] leading-relaxed text-black/45">
                자기보고 — {project.inside.reported}
              </p>
            ) : null}
          </div>
        ) : null}

        <ul style={rise(6)} className="flex flex-wrap gap-2">
          {project.tags.map((tag) => (
            <li
              key={tag}
              style={{ fontFamily: FACE }}
              className="rounded-full border border-black/10 px-3 py-1 text-xs text-black/55"
            >
              {tag}
            </li>
          ))}
        </ul>

        <footer
          style={rise(7)}
          className="border-t border-black/10 pt-4 text-xs leading-relaxed text-black/40"
        >
          공개 가능한 사실만 사용한 비식별 재구성입니다. 검증되지 않은 수치는
          자기보고로 표시했습니다.
        </footer>
      </div>
    </div>
  );
}
