"use client";

import { useEffect, useRef, useState } from "react";
import { PROJECTS } from "./ring/projects";

const SATOSHI = '"Satoshi", ui-sans-serif, system-ui, sans-serif';
const GEIST = '"Geist", ui-sans-serif, system-ui, sans-serif';

/**
 * 앞면 카드를 클릭하면 Carousel이 카드 속으로 날아 들어간 뒤(viscose:open)
 * 이 레이어가 확대된 카드 아트 위로 떠오른다. 팝업이 아니라 그 카드의
 * "안쪽 면"처럼 읽히도록 풀스크린 한 장으로 그린다. 닫기(버튼·ESC·배경
 * 클릭)는 viscose:close를 보내 같은 비행을 거꾸로 돌린다.
 */
export default function DetailPanel() {
  const [index, setIndex] = useState(-1);
  const [shown, setShown] = useState(false);
  const closeBtnRef = useRef(null);
  const timerRef = useRef(0);

  const close = () => {
    setShown(false);
    window.dispatchEvent(new CustomEvent("viscose:close"));
    // 페이드아웃이 끝난 뒤 언마운트 — 그 사이 뒤에서는 링이 되돌아온다.
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
    // close는 상태를 읽지 않아 첫 렌더 인스턴스로 충분하다.
  }, []);

  // 마운트 다음 프레임에 전환을 걸어야 opacity 0에서 실제로 페이드인한다.
  useEffect(() => {
    if (index < 0) return;
    const raf = requestAnimationFrame(() => {
      setShown(true);
      closeBtnRef.current?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(raf);
  }, [index]);

  const project = index >= 0 ? PROJECTS[index] : null;
  if (!project) return null;

  return (
    <div
      className={`fixed inset-0 z-50 overflow-y-auto bg-[#fafafa]/[.93] text-[#0a0a0a] transition-opacity duration-[420ms] ease-out ${
        shown ? "opacity-100" : "opacity-0"
      }`}
      onClick={close}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={project.name}
        onClick={(e) => e.stopPropagation()}
        style={{ fontFamily: SATOSHI }}
        className={`mx-auto flex min-h-full w-full max-w-2xl flex-col justify-center gap-8 px-6 py-16 transition-transform duration-[420ms] ease-out sm:px-8 ${
          shown ? "translate-y-0" : "translate-y-5"
        }`}
      >
        <header className="flex items-baseline justify-between gap-4">
          <p
            style={{ fontFamily: GEIST }}
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
            ref={closeBtnRef}
            type="button"
            onClick={close}
            aria-label="닫기"
            className="shrink-0 rounded-full border border-black/15 px-4 py-1.5 text-sm text-black/60 transition hover:bg-black/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#a2542f]"
          >
            닫기
          </button>
        </header>

        <div>
          <h2 className="text-[clamp(2.1rem,8vw,4rem)] font-medium leading-[1.08] tracking-[-0.015em]">
            {project.name}
          </h2>
          <p
            style={{ fontFamily: GEIST }}
            className="mt-3 text-sm text-black/45"
          >
            {project.period}
          </p>
        </div>

        <ul className="flex max-w-prose flex-col gap-3 text-[15px] leading-relaxed text-black/80">
          {project.desc.map((line) => (
            <li key={line} className="flex gap-2.5">
              <span
                aria-hidden="true"
                className="mt-[9px] h-1 w-1 shrink-0 rounded-full bg-[#a2542f]"
              />
              {line}
            </li>
          ))}
        </ul>

        <ul className="flex flex-wrap gap-2">
          {project.tags.map((tag) => (
            <li
              key={tag}
              style={{ fontFamily: GEIST }}
              className="rounded-full border border-black/10 px-3 py-1 text-xs text-black/55"
            >
              {tag}
            </li>
          ))}
        </ul>

        <footer className="border-t border-black/10 pt-4 text-xs leading-relaxed text-black/40">
          공개 가능한 사실만 사용한 비식별 재구성입니다. 검증되지 않은 수치는
          자기보고로 표시했습니다.
        </footer>
      </div>
    </div>
  );
}
