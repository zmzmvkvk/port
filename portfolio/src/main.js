import content from "../content/portfolio.json";
import "./styles.css";
import {
  TIMING,
  activeSectionIndex,
  buildSegments,
  locateSegment,
  sectionTarget,
  segmentsWithinRadius,
  selectRatio
} from "./lib/timeline.js";
import { MediaPool } from "./lib/media-pool.js";

const STORAGE_KEY = "portfolio.motion";
const app = document.querySelector("#app");
const state = {
  preference: readPreference(),
  mode: "static",
  ratio: selectRatio(window.innerWidth),
  segments: [],
  pool: null,
  videos: new Map(),
  currentLocation: null,
  currentSection: 0,
  raf: 0,
  hasActivatedVideo: false,
  resizeTimer: 0
};

function readPreference() {
  const saved = localStorage.getItem(STORAGE_KEY);
  return ["auto", "video", "static"].includes(saved) ? saved : "auto";
}

function autoMode() {
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const saveData = navigator.connection?.saveData === true;
  return reduced || saveData ? "static" : "video";
}

function resolvedMode() {
  return state.preference === "auto" ? autoMode() : state.preference;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function sectionCard(section, index) {
  const outcome = section.verifiedOutcome
    ? `<p class="evidence"><span>확인 범위</span>${escapeHtml(section.verifiedOutcome)}</p>`
    : "";
  return `
    <section class="career-card" id="career-${escapeHtml(section.id)}" data-section-index="${index}" aria-labelledby="${section.id}-title">
      <div class="career-visual">
        <img src="${section.assets[state.ratio].staticImage}" alt="${escapeHtml(section.artworkLabel)}" loading="${index === 0 ? "eager" : "lazy"}" width="${state.ratio === "desktop" ? 1920 : 720}" height="${state.ratio === "desktop" ? 1080 : 1280}" />
        <span>${escapeHtml(content.meta.reconstructionLabel)}</span>
      </div>
      <div class="career-copy">
        <p class="eyebrow">${escapeHtml(section.label)} · ${escapeHtml(section.period)}</p>
        <h2 id="${section.id}-title">${escapeHtml(section.organization)}</h2>
        <p class="role">${escapeHtml(section.role)}</p>
        <dl>
          <div><dt>반복 문제</dt><dd>${escapeHtml(section.problem)}</dd></div>
          <div><dt>바꾼 구조</dt><dd>${escapeHtml(section.action)}</dd></div>
        </dl>
        ${outcome}
        <ul class="tags" aria-label="관련 기술">${section.tags.map((tag) => `<li>${escapeHtml(tag)}</li>`).join("")}</ul>
      </div>
    </section>`;
}

function renderShell() {
  app.innerHTML = `
    <header class="site-header">
      <a class="identity" href="#megastudy" aria-label="첫 경력 장면으로 이동">
        <strong>${escapeHtml(content.meta.name)}</strong>
        <span>${escapeHtml(content.meta.headline)}</span>
      </a>
      <div class="motion-control" role="group" aria-label="표현 방식">
        ${["auto", "video", "static"].map((value) => `
          <button type="button" data-motion="${value}" aria-pressed="${state.preference === value}">
            ${value === "auto" ? "자동" : value === "video" ? "영상" : "정적"}
          </button>`).join("")}
      </div>
    </header>
    <div class="video-experience" aria-hidden="true"></div>
    <main id="career-list" class="career-list">
      <header class="list-intro">
        <p class="eyebrow">CAREER SYSTEMS · 2011—PRESENT</p>
        <h1>반복을<br />구조로 바꾸다.</h1>
        <p>${escapeHtml(content.meta.description)}</p>
      </header>
      ${content.sections.map(sectionCard).join("")}
    </main>
    <footer class="site-footer">
      <p>${escapeHtml(content.meta.reconstructionLabel)}</p>
      <p>공개 가능한 경력 사실을 바탕으로 구성했습니다.</p>
    </footer>`;

  app.querySelectorAll("[data-motion]").forEach((button) => {
    button.addEventListener("click", () => setPreference(button.dataset.motion));
  });
}

function captionMarkup(section) {
  return `
    <p class="caption-index">${escapeHtml(section.label)} / 06</p>
    <p class="caption-period">${escapeHtml(section.period)}</p>
    <h2>${escapeHtml(section.organization)}</h2>
    <p class="caption-role">${escapeHtml(section.role)}</p>
    <dl>
      <div><dt>반복 문제</dt><dd>${escapeHtml(section.problem)}</dd></div>
      <div><dt>바꾼 구조</dt><dd>${escapeHtml(section.action)}</dd></div>
      ${section.verifiedOutcome ? `<div><dt>확인 범위</dt><dd>${escapeHtml(section.verifiedOutcome)}</dd></div>` : ""}
    </dl>`;
}

function mountVideoExperience() {
  const host = app.querySelector(".video-experience");
  const first = content.sections[0];
  host.innerHTML = `
    <div class="studio-stage">
      <img class="stage-poster" src="${first.assets[state.ratio].poster}" alt="" width="${state.ratio === "desktop" ? 1920 : 720}" height="${state.ratio === "desktop" ? 1080 : 1280}" />
      <div class="video-layers" aria-hidden="true"></div>
      <div class="stage-wash"></div>
      <aside class="stage-caption" aria-live="polite">${captionMarkup(first)}</aside>
      <p class="reconstruction">${escapeHtml(content.meta.reconstructionLabel)}</p>
      <div class="media-error" hidden>
        <span>영상 장면을 불러오지 못했습니다. 포스터와 경력 정보는 계속 볼 수 있습니다.</span>
        <button type="button">다시 불러오기</button>
      </div>
      <nav class="timeline" aria-label="경력 타임라인">
        <ol>
          ${content.sections.map((section, index) => `
            <li>
              <button type="button" data-index="${index}" data-section="${section.id}" aria-current="${index === 0 ? "step" : "false"}">
                <span>${section.label}</span><strong>${escapeHtml(section.organization)}</strong>
              </button>
            </li>`).join("")}
        </ol>
      </nav>
      <p class="scroll-cue" aria-hidden="true">SCROLL TO TRAVEL <span></span></p>
    </div>
    <div class="scroll-space"></div>`;
  host.setAttribute("aria-hidden", "false");

  state.segments = buildSegments(content, state.ratio);
  host.querySelector(".scroll-space").style.height = `${state.segments.at(-1).total * 100}vh`;
  host.querySelectorAll(".timeline button").forEach((button) => {
    button.addEventListener("click", () => navigateToSection(button.dataset.section, true));
    button.addEventListener("keydown", handleTimelineKeys);
  });
  host.querySelector(".media-error button").addEventListener("click", retryCurrent);

  state.pool = new MediaPool({
    limit: 5,
    onEvict: (key) => {
      state.videos.get(key)?.remove();
      state.videos.delete(key);
    }
  });
  const activate = () => {
    state.hasActivatedVideo = true;
    updateFromScroll();
  };
  window.addEventListener("pointerdown", activate, { once: true, passive: true });
  window.addEventListener("keydown", activate, { once: true });
  const idle = window.requestIdleCallback ?? ((callback) => setTimeout(callback, 800));
  idle(activate, { timeout: 1800 });
}

function unmountVideoExperience() {
  cancelAnimationFrame(state.raf);
  state.pool?.destroy();
  state.pool = null;
  state.videos.clear();
  state.hasActivatedVideo = false;
  const host = app.querySelector(".video-experience");
  if (host) {
    host.innerHTML = "";
    host.setAttribute("aria-hidden", "true");
  }
}

function setPreference(preference) {
  const progress = getAbsoluteProgress();
  state.preference = preference;
  localStorage.setItem(STORAGE_KEY, preference);
  applyMode(progress);
}

function applyMode(preserveProgress = 0) {
  const nextMode = resolvedMode();
  if (state.mode === "video") unmountVideoExperience();
  state.mode = nextMode;
  document.documentElement.dataset.mode = nextMode;
  app.querySelectorAll("[data-motion]").forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.motion === state.preference));
  });

  if (nextMode === "video") {
    mountVideoExperience();
    window.addEventListener("scroll", onScroll, { passive: true });
    requestAnimationFrame(() => {
      const hashId = location.hash.slice(1);
      if (content.sections.some((section) => section.id === hashId)) navigateToSection(hashId, false);
      else scrollToProgress(preserveProgress, false);
      requestAnimationFrame(updateFromScroll);
    });
  } else {
    window.removeEventListener("scroll", onScroll);
    const hashId = location.hash.slice(1);
    if (hashId) requestAnimationFrame(() => document.getElementById(`career-${hashId}`)?.scrollIntoView());
  }
}

function getAbsoluteProgress() {
  if (state.mode !== "video" || !state.segments.length) return 0;
  const maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
  return (window.scrollY / maxScroll) * state.segments.at(-1).total;
}

function scrollToProgress(progress, smooth = true) {
  const total = state.segments.at(-1)?.total ?? 1;
  const maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
  window.scrollTo({ top: (progress / total) * maxScroll, behavior: smooth ? "smooth" : "auto" });
}

function navigateToSection(sectionId, smooth) {
  if (state.mode !== "video") {
    document.getElementById(`career-${sectionId}`)?.scrollIntoView({ behavior: smooth ? "smooth" : "auto" });
    history.replaceState(null, "", `#${sectionId}`);
    return;
  }
  const target = sectionTarget(state.segments, sectionId);
  if (target !== null) {
    scrollToProgress(target, smooth);
    history.replaceState(null, "", `#${sectionId}`);
  }
}

function handleTimelineKeys(event) {
  const keys = ["ArrowLeft", "ArrowRight", "Home", "End"];
  if (!keys.includes(event.key)) return;
  event.preventDefault();
  const buttons = [...app.querySelectorAll(".timeline button")];
  const current = buttons.indexOf(event.currentTarget);
  const next = event.key === "Home" ? 0
    : event.key === "End" ? buttons.length - 1
      : event.key === "ArrowLeft" ? Math.max(0, current - 1)
        : Math.min(buttons.length - 1, current + 1);
  buttons[next].focus();
  buttons[next].click();
}

function onScroll() {
  if (state.raf) return;
  state.raf = requestAnimationFrame(() => {
    state.raf = 0;
    updateFromScroll();
  });
}

function updateFromScroll() {
  if (state.mode !== "video" || !state.segments.length) return;
  const position = getAbsoluteProgress();
  const locationState = locateSegment(state.segments, position);
  state.currentLocation = locationState;
  const sectionIndex = activeSectionIndex(locationState);
  updateCaption(sectionIndex);
  updateTimeline(sectionIndex);
  updateHash(sectionIndex);
  updatePoster(sectionIndex);
  if (!state.hasActivatedVideo) return;

  const nearby = segmentsWithinRadius(state.segments, position);
  const keys = nearby.map((segment) => segment.key);
  state.pool.keep(keys);
  nearby.forEach((segment) => ensureVideo(segment));
  seekVisibleVideos(locationState);
}

function ensureVideo(segment, force = false) {
  state.pool.load(segment.key, segment.assets.video, { force })
    .then((objectUrl) => {
      if (state.videos.has(segment.key)) return;
      const video = document.createElement("video");
      video.muted = true;
      video.playsInline = true;
      video.preload = "auto";
      video.tabIndex = -1;
      video.dataset.key = segment.key;
      video.src = objectUrl;
      video.addEventListener("loadedmetadata", () => seekVisibleVideos(state.currentLocation));
      app.querySelector(".video-layers")?.append(video);
      state.videos.set(segment.key, video);
      hideMediaError();
      seekVisibleVideos(state.currentLocation);
    })
    .catch((error) => {
      if (error?.name !== "AbortError" && state.currentLocation?.segment.key === segment.key) showMediaError();
    });
}

function seekVisibleVideos(locationState) {
  if (!locationState?.segment) return;
  const current = locationState.segment;
  const next = state.segments[locationState.index + 1];
  const crossfadeFraction = Math.min(0.45, TIMING.crossfade / current.weight);
  const fade = Math.max(0, (locationState.localProgress - (1 - crossfadeFraction)) / crossfadeFraction);
  for (const [key, video] of state.videos) {
    const segment = state.segments.find((item) => item.key === key);
    let opacity = 0;
    let local = 0;
    if (key === current.key) {
      opacity = 1 - fade;
      local = locationState.localProgress;
    } else if (next && key === next.key) {
      opacity = fade;
      local = 0;
    }
    video.style.opacity = String(opacity);
    if (opacity > 0 && Number.isFinite(video.duration) && video.readyState >= 1) {
      const target = Math.min(video.duration - 0.034, Math.max(0, local * video.duration));
      if (Math.abs(video.currentTime - target) > 0.045) {
        try { video.currentTime = target; } catch { /* metadata race */ }
      }
    }
  }
  const poster = app.querySelector(".stage-poster");
  if (poster) poster.style.opacity = state.videos.has(current.key) ? "0" : "1";
}

function updateCaption(index) {
  if (state.currentSection === index && app.querySelector(".stage-caption h2")) return;
  state.currentSection = index;
  const caption = app.querySelector(".stage-caption");
  if (caption) caption.innerHTML = captionMarkup(content.sections[index]);
}

function updateTimeline(index) {
  app.querySelectorAll(".timeline button").forEach((button, buttonIndex) => {
    button.setAttribute("aria-current", buttonIndex === index ? "step" : "false");
  });
}

function updateHash(index) {
  const id = content.sections[index].id;
  if (location.hash !== `#${id}`) history.replaceState(null, "", `#${id}`);
}

function updatePoster(index) {
  const poster = app.querySelector(".stage-poster");
  const source = content.sections[index].assets[state.ratio].poster;
  if (poster && poster.getAttribute("src") !== source) poster.setAttribute("src", source);
}

function showMediaError() {
  const notice = app.querySelector(".media-error");
  if (notice) notice.hidden = false;
}

function hideMediaError() {
  const notice = app.querySelector(".media-error");
  if (notice) notice.hidden = true;
}

function retryCurrent() {
  const segment = state.currentLocation?.segment;
  if (segment) {
    hideMediaError();
    ensureVideo(segment, true);
  }
}

function handleResize() {
  clearTimeout(state.resizeTimer);
  state.resizeTimer = setTimeout(() => {
    const nextRatio = selectRatio(window.innerWidth);
    if (nextRatio === state.ratio) return;
    const progress = getAbsoluteProgress();
    state.ratio = nextRatio;
    renderShell();
    applyMode(progress);
  }, 160);
}

function enableAnalyticsIfConfigured() {
  const token = document.querySelector('meta[name="cf-beacon-token"]')?.content.trim();
  if (!token) return;
  const script = document.createElement("script");
  script.defer = true;
  script.src = "https://static.cloudflareinsights.com/beacon.min.js";
  script.dataset.cfBeacon = JSON.stringify({ token });
  document.head.append(script);
}

renderShell();
applyMode();
enableAnalyticsIfConfigured();
window.addEventListener("resize", handleResize, { passive: true });
document.querySelector(".skip-link")?.addEventListener("click", () => {
  if (state.mode === "video") setPreference("static");
});
