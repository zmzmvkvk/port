"use client";

import { useEffect, useState } from "react";
import { PROJECTS } from "./ring/projects";

/**
 * 앞면 카드를 클릭하면 Carousel이 "viscose:open" 이벤트를 보낸다.
 * 캔버스 위에 얹히는 유일한 본문 UI라서 DOM으로 그리고, 닫기는 ESC·배경
 * 클릭·버튼 세 가지 모두 받는다.
 */
export default function DetailPanel() {
  const [index, setIndex] = useState(-1);

  useEffect(() => {
    const onOpen = (e) => setIndex(e.detail);
    const onKey = (e) => {
      if (e.key === "Escape") setIndex(-1);
    };
    window.addEventListener("viscose:open", onOpen);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("viscose:open", onOpen);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  const project = index >= 0 ? PROJECTS[index] : null;
  if (!project) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-end bg-black/25 backdrop-blur-[2px]"
      onClick={() => setIndex(-1)}
      role="presentation"
    >
      <aside
        className="mx-4 flex max-h-[86vh] w-full max-w-md flex-col gap-5 overflow-y-auto rounded-2xl border border-black/10 bg-[#f5f4f0] p-7 text-[#1a1b1e] shadow-2xl sm:mr-10"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={project.name}
      >
        <header className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs tracking-wide text-[#8a6a52]">
              {String(index + 1).padStart(2, "0")} · {project.type}
            </p>
            <h2 className="mt-1 text-2xl font-medium">{project.name}</h2>
            <p className="mt-1 text-sm text-black/55">{project.period}</p>
          </div>
          <button
            type="button"
            onClick={() => setIndex(-1)}
            aria-label="닫기"
            className="rounded-full border border-black/15 px-3 py-1 text-sm text-black/60 transition hover:bg-black/5"
          >
            닫기
          </button>
        </header>

        <ul className="flex flex-col gap-2.5 text-[15px] leading-relaxed text-black/80">
          {project.desc.map((line) => (
            <li key={line} className="flex gap-2">
              <span aria-hidden="true" className="mt-[9px] h-1 w-1 shrink-0 rounded-full bg-[#a2542f]" />
              {line}
            </li>
          ))}
        </ul>

        <ul className="flex flex-wrap gap-2">
          {project.tags.map((tag) => (
            <li
              key={tag}
              className="rounded-full bg-black/[0.06] px-3 py-1 text-xs text-black/60"
            >
              {tag}
            </li>
          ))}
        </ul>

        <footer className="border-t border-black/10 pt-4 text-xs leading-relaxed text-black/45">
          공개 가능한 사실만 사용한 비식별 재구성입니다. 검증되지 않은 수치는
          자기보고로 표시했습니다.
        </footer>
      </aside>
    </div>
  );
}
