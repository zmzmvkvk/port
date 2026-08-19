"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import gsap from "gsap";

import {
  vertexShader,
  fragmentShader,
  MAX_PLANES,
  MAX_LINKS,
} from "./shaders/planeShaders";
import { buildAtlas } from "./ring/atlas";
import { createMeta } from "./ring/meta";
import { createSplitText } from "./ring/splitText";
import { createTag, TAG_W, TAG_H } from "./ring/tag";
import { defaultParams } from "./ring/params";
import { ASIDES, IMAGE_FILES, PROJECTS } from "./ring/projects";
import {
  TAU,
  HALF_PI,
  DEG,
  chase,
  clamp01,
  easeInOutCubic,
  easeOutCubic,
  signedOffset,
  smoothstep,
} from "./ring/utils";

// The fan starts fractionally into the spread so the seed reads first.
const FAN_START = 0.06;

const blankTexture = () => {
  const t = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
  t.needsUpdate = true;
  return t;
};

export default function Carousel() {
  const containerRef = useRef(null);
  const listRef = useRef(null);
  const itemsRef = useRef([]);
  const loaderRef = useRef(null);
  const liveRef = useRef(null);
  const skipRef = useRef(null);
  // Per side: the box that positions the lockup, a wrapper that promotes the
  // pair onto its own layer, and the two rows that relay within it. See
  // ring/meta.js.
  const metaRef = useRef({
    left: { box: null, pair: null, layers: [] },
    right: { box: null, pair: null, layers: [] },
  });

  useEffect(() => {
    const container = containerRef.current;
    const listEl = listRef.current;
    const loaderEl = loaderRef.current;
    const skipEl = skipRef.current;
    // Async work (atlas decode, the lil-gui import) can land after cleanup
    // under StrictMode's double mount. Everything deferred checks this.
    let disposed = false;

    const params = defaultParams();
    // The entry, the name relay and the dive are the motion. Off, they
    // become a cut. Detected once at mount: a mid-session toggle would have
    // to rebuild the timeline, and this is not a control people flick.
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (reduceMotion) {
      params.holdAfter = 0;
      params.loaderOut = 0.15;
      params.launchTime = 0.001;
      params.spreadTime = 0.001;
      params.spinTurns = 0;
      params.spinTime = 0.001;
      params.moveTime = 0.001;
      params.moveDelay = 0;
      params.text = "";
      params.textOut = false;
      params.diveTime = 0.28;
      params.diveOutTime = 0.22;
      params.wobble = 0;
      params.nameMorphTime = 0.01;
    }
    // progress: the seed is born at screen centre
    // launch:   the seed travels out to its place on the ring
    // spread:   the rest peel off it and the ring draws
    // spin:     whole-ring rotation, radians
    // shift:    the ring moves off centre and resizes
    // dive:     flying into the front card, 0 = ring, 1 = card fills screen
    const state = {
      progress: 0,
      launch: 0,
      spread: 0,
      spin: 0,
      shift: 0,
      dive: 0,
    };
    // Read-only panel readouts, so an invalid ring is visible rather than
    // silent and the reference window can be matched to the live one.
    const info = { restingGap: 0, window: "", scale: 1, band: "wide" };

    // Browsers cap the number of live WebGL contexts (~16 in Chrome). If that
    // is hit, this throws and the rest of the effect never runs — no canvas is
    // appended and the page is simply blank, which is a miserable thing to
    // debug. Fail loudly instead. See the cleanup for why it should not
    // happen: the context is released explicitly rather than left to GC.
    let renderer;
    try {
      // No MSAA: everything drawn is a full-screen quad whose edges are
      // antialiased inside the fragment shader (SDF smoothstep), so the
      // multisample resolve is pure cost — worst exactly where it matters,
      // on phone GPUs.
      //
      // Opaque canvas for the same reason: the page behind it is the one
      // flat colour the shader already knows (uPage), so it is cleared in GL
      // instead of composited per pixel against the DOM every frame.
      renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false });
      renderer.setClearColor(0xfafafa, 1);
      // Cleared by hand each frame so a tight-band scissor can skip the
      // empty canvas without leaving uncleared trails around the ring.
      renderer.autoClear = false;
    } catch (err) {
      console.error("[ring] could not create a WebGL context:", err);
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -100, 100);

    const uniforms = {
      uResolution: { value: new THREE.Vector2(1, 1) },
      uSize: { value: new THREE.Vector2(150, 100) },
      uRadius: { value: params.radius },
      uCount: { value: params.count },
      uPos: {
        value: Array.from({ length: MAX_PLANES }, () => new THREE.Vector2()),
      },
      uRot: { value: new Float32Array(MAX_PLANES) },
      // xy = birth scale, z = brightness, w = atlas cell. Packed because a
      // uniform array costs a full vec4 row per element either way.
      uScale: {
        value: Array.from(
          { length: MAX_PLANES },
          () => new THREE.Vector4(0, 0, 1, 0),
        ),
      },
      uLinkCount: { value: 0 },
      uLinkA: {
        value: Array.from({ length: MAX_LINKS }, () => new THREE.Vector2()),
      },
      uLinkB: {
        value: Array.from({ length: MAX_LINKS }, () => new THREE.Vector2()),
      },
      // (rEnd, rMid, sag, fillet), packed to stay inside the uniform budget.
      uLinkPar: {
        value: Array.from({ length: MAX_LINKS }, () => new THREE.Vector4()),
      },
      uK: { value: params.goo },
      uWobble: { value: params.wobble },
      uTime: { value: 0 },
      uColor: { value: new THREE.Color("#0a0a0a") },
      uAtlas: { value: blankTexture() }, // placeholder so the sampler is bound
      uGrid: { value: new THREE.Vector2(1, 1) },
      uBlend: { value: params.blend },
      uTextured: { value: 0 },
      uBandTop: { value: 0 },
      uBandBottom: { value: 0 },
      uGlass: { value: new THREE.Vector4() },
      uFringe: { value: 0 },
      uSheen: { value: 0 },
      uMouse: { value: new THREE.Vector4() },
      uMelt: { value: new THREE.Vector4() },
      uTagTex: {
        value: new THREE.DataTexture(new Uint8Array([0, 0, 0, 0]), 1, 1),
      },
      uTag: { value: new THREE.Vector4() },
      uTagP: { value: new THREE.Vector4() },
      uTagQ: { value: new THREE.Vector4() },
      uPage: { value: new THREE.Color("#fafafa") },
    };

    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.ShaderMaterial({
        vertexShader,
        fragmentShader,
        uniforms,
        transparent: true,
        depthWrite: false,
      }),
    );
    // Above the type, so the planes occlude it as the ring sweeps past.
    mesh.renderOrder = 10;
    scene.add(mesh);

    const textGroup = new THREE.Group();
    scene.add(textGroup);
    const textBounds = new THREE.Box3();

    const splitText = createSplitText(textGroup, params);
    const tag = createTag(params, uniforms);
    const meta = createMeta(
      {
        groups: metaRef.current,
        list: listEl,
        loader: loaderEl,
        live: liveRef.current,
      },
      params,
    );

    /* ---------------------------------------------------------------- art */
    // The atlas is bound on frame one and fills in as images arrive, so the
    // seed can be born already wearing its own art while the rest are still
    // in flight. It is also what gives the counter something to count.
    let firstIn = false; // the seed's own cell is on the texture
    let loadProg = 0; // and how much of the rest has arrived, 0..1

    // Opened on the frame the counter reads 100, and by nothing else — that is
    // what makes the number landing and the ring launching the same moment.
    let launchReady = false;
    const readyWaiters = [];
    const whenReady = (fn) => (launchReady ? fn() : readyWaiters.push(fn));

    const atlas = buildAtlas(IMAGE_FILES, (p) => {
      if (!disposed) loadProg = p;
    });

    uniforms.uAtlas.value.dispose();
    atlas.texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
    uniforms.uAtlas.value = atlas.texture;
    uniforms.uGrid.value.set(atlas.grid[0], atlas.grid[1]);
    // Up front, not on completion: the cell each plane wears is derived from
    // this and has to be right from the first frame, blank cells or not.
    const imageCount = atlas.count;

    atlas.first.then(() => {
      if (!disposed) firstIn = true;
    });
    atlas.ready.then(() => {
      if (!disposed) loadProg = 1;
    });

    /* --------------------------------------------------------------- size */
    let viewW = 1;
    let viewH = 1;
    // Cached: the pointer is tracked on every move, and reading the rect each
    // time is a forced layout. Only a resize can invalidate it.
    const bounds = { left: 0, top: 0 };

    // How far this window is from the reference one. Every px param is
    // multiplied through by it, so it is computed on resize and never in the
    // loop. planeK / radiusK / textK are the breakpoint bumps on top.
    let fit = 1;
    let planeK = 1;
    let radiusK = 1;
    let textK = 1;
    // Kept as flags rather than resolved into values here, so anything picked
    // off them still answers to the dev panel between resizes.
    let narrowNow = false;
    let tightNow = false;

    // 정지 상태의 링을 재는 데 쓰는 값들. 레이아웃 루프와 같은 규칙을 따른다.
    const ring = { outer: 0, cx: 0, cy: 0 };
    const endScaleFor = () =>
      narrowNow ? params.narrowEndScale : params.endScale;
    const restCx = (R, W) => {
      const posX = tightNow
        ? params.tightPosX
        : narrowNow
          ? params.narrowPosX
          : params.posX;
      let cx = posX * viewW * 0.5;
      if (tightNow) {
        const halfAcross = (params.radial ? W : W / 1.5) * 0.5;
        const over =
          viewW * 0.5 + cx + R + halfAcross - (viewW - params.tightInset * fit);
        if (over > 0) cx -= over;
      }
      return cx;
    };

    const refit = () => {
      const byW = viewW / Math.max(1, params.refWidth);
      const byH = viewH / Math.max(1, params.refHeight);
      const s =
        byW * (1 - params.fitHeight) + Math.min(byW, byH) * params.fitHeight;
      fit = Math.min(params.maxScale, Math.max(params.minScale, s));

      const narrow = viewW <= params.narrowAt;
      const tight = viewW <= params.tightAt;
      narrowNow = narrow;
      tightNow = tight;
      planeK = narrow ? params.narrowPlane : 1;
      // The bands stack: tight sits inside narrow and pulls the arc back in
      // from where narrow had pushed it out to.
      radiusK =
        (narrow ? params.narrowRadius : 1) * (tight ? params.tightRadius : 1);
      textK = narrow ? params.narrowText : 1;

      info.window = `${Math.round(viewW)} x ${Math.round(viewH)}`;
      info.scale = Math.round(fit * 1000) / 1000;
      info.band = tight ? "tight" : narrow ? "narrow" : "wide";

      // The heading is rasterised per glyph, so it cannot be re-sized without
      // rebuilding every texture mid-animation. Scaling the group costs
      // nothing and stays sharp — the glyphs are drawn at 2x display already.
      const k = fit * textK * (tight ? params.tightSplit : 1);
      textGroup.scale.set(k, k, 1);

      // And it sits clear of the ring rather than inside its eye.
      //
      // Inside is where this started, and it worked while the heading was
      // short: a ring of this radius leaves a hole about 240px across at the
      // reference window, which "Works '26" fits inside and "김서준 — Works"
      // does not. So the first and last glyphs sat behind cards for over a
      // second at every width, and on a phone the name lost its first syllable
      // for the whole entry — the one word on the page that cannot be allowed
      // to break.
      //
      // Drawing the type over the planes instead is not the fix it looks like:
      // a third of the cards are near-black grounds and so is the type. And
      // shrinking it to fit the hole ends at ~15px on a phone. Lifting it off
      // the ring's own outer edge keeps it whole in every band at full size.
      const cardW = params.planeSize * planeK * fit;
      const cardDepth = (params.radial ? cardW / 1.5 : cardW) * 0.5;
      // Measured before the stage move, because that is the ring the heading
      // actually shares the screen with — once the ring grows and leaves, the
      // heading is already fading.
      const outer = params.ringRadius * radiusK * fit + cardDepth;
      const halfType = params.textSize * 0.5 * k;
      // Never pushed off the top: a short window would rather have the heading
      // a little tight against the ring than not have it on screen.
      textGroup.position.y = Math.min(
        outer + halfType + params.textGap * fit,
        viewH * 0.5 - halfType - 8,
      );

      // 정지 상태(shift=1)의 링. 이름 자리를 정하는 쪽이 링이 어디까지
      // 뻗는지 알아야 한다 — 좁은 폰에서는 호가 우하단 이름 행까지 올라온다.
      const endG = endScaleFor() * fit;
      const restW = params.planeSize * planeK * endG;
      const restR = params.ringRadius * radiusK * endG;
      // 카드는 회전해 있으므로 반지름이 아니라 반대각선까지가 바깥 한계다.
      const restReach = restR + Math.hypot(restW, restW / 1.5) * 0.5;
      ring.outer = restReach;
      ring.cx = viewW * 0.5 + restCx(restR, restW);
      ring.cy = viewH * 0.5;
    };

    const styleMeta = () =>
      meta.style({
        textK,
        tight: tightNow,
        narrow: narrowNow,
        viewW: viewW,
        viewH: viewH,
        ring,
      });

    // Tight: shade at 3/4 of the usual cap. The ring already fills most of
    // a phone, so cutting empty pixels (007) cannot get the morph p95 off
    // 50ms — only fewer fragments on the cards themselves can. 0.75 of
    // min(dpr,2) is 1.5 on a typical phone (H3) and 0.75 in the DPR-1
    // harness, which is what lets the rig see it.
    const applyPixelRatio = () => {
      const cap = Math.min(window.devicePixelRatio, 2);
      renderer.setPixelRatio(tightNow ? cap * 0.75 : cap);
    };

    const resize = () => {
      viewW = container.clientWidth;
      viewH = container.clientHeight;
      refit();
      applyPixelRatio();
      renderer.setSize(viewW, viewH);
      camera.left = -viewW / 2;
      camera.right = viewW / 2;
      camera.top = viewH / 2;
      camera.bottom = -viewH / 2;
      camera.updateProjectionMatrix();
      mesh.scale.set(viewW, viewH, 1);
      uniforms.uResolution.value.set(viewW, viewH);

      const rect = renderer.domElement.getBoundingClientRect();
      bounds.left = rect.left;
      bounds.top = rect.top;
    };

    // styleMeta too, because the breakpoint bumps are steps that vw units
    // cannot express on their own.
    const onResize = () => {
      resize();
      styleMeta();
    };

    resize();
    window.addEventListener("resize", onResize);

    /* ------------------------------------------------------- spin & input */
    const ringCentre = { x: 0, y: 0 };
    // How far the nearest plane is from front, in radians. Measured in the
    // layout pass and read by the meta gate at the end of the frame, which is
    // why it outlives the pass that sets it.
    let frontGap = Infinity;
    // 그리고 그 평면이 누구인지. 키보드로 여는 쪽은 커서가 없으므로 hover 로
    // 고른 `over` 를 쓸 수 없다.
    let frontPlane = -1;
    // 건너뛴 뒤에는 대기 중이던 콜백이 타임라인을 다시 굴리면 안 된다.
    let skipped = false;
    // Which way "front" is: from the ring's centre toward the middle of the
    // screen. Once the ring is off centre that is no longer 3 o'clock.
    let frontAngle = 0;
    let interactive = false;
    let spinVel = 0; // rad/s
    let dragging = false;
    let dragPrevAngle = 0;
    let dragPrevTime = 0;

    // The snap is a phase, not a force that is always on: a flick coasts
    // untouched, and once it is nearly spent the ring commits to a slot and
    // runs itself in. snapTo is that slot, snapCap the speed it came in at.
    let settling = false;
    let snapTo = 0;
    let snapCap = 0;

    // A click is turning the ring to a card. While this is up the momentum
    // above is suspended entirely, so the two cannot both drive spin.
    let picking = false;

    let pointerTravel = 0; // tells a click from a drag
    let travelX = 0;
    let travelY = 0;

    const pointerAngle = (e) => {
      const dx = e.clientX - bounds.left - ringCentre.x;
      const dy = e.clientY - bounds.top - ringCentre.y;
      return Math.atan2(-dy, dx);
    };

    const stopPick = () => {
      if (!picking) return;
      gsap.killTweensOf(state);
      picking = false;
    };

    // Turn the ring until plane i faces front. A tween rather than a target
    // handed to the snap: the snap is a run-in for a throw that is nearly
    // spent and is shaped so it can only slow down, but a pick starts from a
    // standstill and has to accelerate.
    const pick = (i) => {
      const slot = TAU / Math.round(params.count);
      // Spread, plane i sits at seed + signedOffset(i) * slot + spin.
      const base = frontAngle - params.seed * DEG - signedOffset(i) * slot;
      // Nearest equivalent winding, so it takes the short way round rather
      // than unwinding whole turns. Every card is within half a ring.
      const target = base + Math.round((state.spin - base) / TAU) * TAU;

      const slots = Math.abs(target - state.spin) / slot;
      // Already there — dive into the card instead of turning.
      if (slots < 0.01) {
        if (shown >= 0) openCard(i);
        return;
      }

      spinVel = 0;
      settling = false;
      picking = true;
      gsap.killTweensOf(state);
      gsap.to(state, {
        spin: target,
        // Root of the distance, not linear: a card eight slots round should
        // take longer than its neighbour but not eight times longer.
        duration: params.pickTime * Math.sqrt(Math.max(1, slots)),
        ease: params.pickEase,
        onComplete: () => {
          picking = false;
        },
      });
    };

    /* --------------------------------------------------------------- dive */
    // Clicking the front card does not open a panel over the ring — the view
    // flies into the card. The layout loop zooms every plane about the picked
    // one, so it swallows the screen while its neighbours slide off the
    // edges; the detail layer only fades in once the art is the whole
    // backdrop. Closing plays the same flight backwards.
    let diveI = -1;

    // The DOM type would sit on top of the flight, so it gets out of the way.
    // Quickly on the way out — it is over the card the moment the card starts
    // growing — and late on the way back, after the ring is home, so it does
    // not ghost across the return.
    const fadeChrome = (to) => {
      const els = [
        listEl,
        metaRef.current.left.box,
        metaRef.current.right.box,
      ].filter(Boolean);
      gsap.to(els, {
        opacity: to,
        duration: to ? 0.4 : 0.22,
        delay: to ? params.diveOutTime * 0.45 : 0,
        ease: to ? "power2.out" : "power2.in",
        overwrite: "auto",
      });
    };

    const openCard = (i) => {
      if (diveI >= 0) return;
      diveI = i;
      interactive = false;
      // 상세는 모달이다 (aria-modal). 뒤에 남은 링이 계속 포커스를 받으면
      // 모달이라고 말해 놓고 Tab 은 뒤로 새는 화면이 된다 — 실제로 그랬다.
      // inert 하나로 포커스와 포인터와 접근성 트리가 한꺼번에 빠지고, 남는
      // 포커스 대상이 레이어 안뿐이라 가둠(trap)이 저절로 생긴다.
      container.inert = true;
      // Latched now: `shown` cannot change mid-dive, but the panel should
      // open on what was clicked, not on whatever is front on completion.
      const opened = shown;
      // Handed over while the card is still growing, not once it has stopped.
      // The detail layer's own arrival then overlaps the tail of the flight
      // and the two read as one move; waiting for the end left a dead beat
      // with a full-screen picture and nothing happening.
      let handed = false;
      const hand = () => {
        if (handed) return;
        handed = true;
        window.dispatchEvent(
          new CustomEvent("viscose:open", { detail: opened }),
        );
      };
      gsap.killTweensOf(state, "dive");
      gsap.to(state, {
        dive: 1,
        duration: params.diveTime,
        ease: params.diveEase,
        onUpdate: () => {
          if (state.dive >= params.diveHand) hand();
        },
        onComplete: hand,
      });
      fadeChrome(0);
    };

    const closeCard = () => {
      if (diveI < 0) return;
      container.inert = false;
      // 닫기 버튼은 곧 사라지므로, 초점을 명시적으로 링에 돌려준다. 두지
      // 않으면 body 로 떨어져 키보드 사용자가 있던 자리를 잃는다.
      container.focus({ preventScroll: true });
      gsap.killTweensOf(state, "dive");
      gsap.to(state, {
        dive: 0,
        duration: params.diveOutTime,
        ease: params.diveOutEase,
        onComplete: () => {
          diveI = -1;
          interactive = true;
        },
      });
      fadeChrome(1);
    };

    const onCloseEvent = () => closeCard();
    // The panel sends viscose:close for its own reasons; Escape here covers
    // the gap where the dive is in flight and the panel does not exist yet.
    const onDiveKey = (e) => {
      if (e.key === "Escape") closeCard();
    };
    window.addEventListener("viscose:close", onCloseEvent);
    window.addEventListener("keydown", onDiveKey);

    /* ------------------------------------------------------------ pointer */
    // World px, origin at screen centre, Y up — the space the shader works in,
    // so nothing is converted twice.
    //
    // `inside` means the position is worth reading, which is what the card hit
    // test needs. Whether the softening is *on* is a separate question,
    // because on touch it is not simply "is there a pointer".
    const pointer = { x: 0, y: 0, inside: false, seeded: false };
    // What the ring actually follows: the cursor, smoothed. How far this
    // trails the real pointer stands in for speed and drives the wake.
    const cursor = { x: 0, y: 0, amt: 0, wake: 0 };

    // Read off the events rather than a media query, so a laptop with a
    // touchscreen behaves as whichever is being used at the time.
    let coarse = false;
    let held = false;
    let holdTimer = 0;

    const endHold = () => {
      clearTimeout(holdTimer);
      holdTimer = 0;
      held = false;
    };

    const beginHold = () => {
      clearTimeout(holdTimer);
      holdTimer = setTimeout(() => {
        held = true;
      }, params.touchHold * 1000);
    };

    // Mouse: being over it is the whole gesture. Touch: only a press held
    // still long enough to mean it.
    const engaged = () => (coarse ? held : pointer.inside);

    const trackPointer = (e) => {
      coarse = e.pointerType === "touch";
      pointer.x = e.clientX - bounds.left - viewW * 0.5;
      pointer.y = viewH * 0.5 - (e.clientY - bounds.top);
      pointer.inside = true;
      // Otherwise the first move sweeps the softening across the ring from
      // wherever the cursor was last left.
      if (!pointer.seeded) {
        pointer.seeded = true;
        cursor.x = pointer.x;
        cursor.y = pointer.y;
      }
    };

    const onPointerLeave = () => {
      pointer.inside = false;
    };

    const onWheel = (e) => {
      if (!interactive) return;
      e.preventDefault();
      // Trackpads send horizontal deltas too; take whichever dominates.
      const d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      // Fresh input hands the ring back to its own momentum.
      stopPick();
      settling = false;
      spinVel += d * params.scrollSpeed;
      spinVel = Math.max(-params.maxSpeed, Math.min(params.maxSpeed, spinVel));
    };

    const onPointerDown = (e) => {
      pointerTravel = 0;
      travelX = e.clientX;
      travelY = e.clientY;
      trackPointer(e);
      if (!interactive) return;
      stopPick();
      if (coarse) beginHold();
      dragging = true;
      settling = false;
      spinVel = 0;
      dragPrevAngle = pointerAngle(e);
      dragPrevTime = performance.now();
      renderer.domElement.setPointerCapture?.(e.pointerId);
    };

    const onPointerMove = (e) => {
      trackPointer(e);

      // From coordinates, not movementX/Y: those are zero for touch in Safari,
      // which would make every swipe look stationary and end in a tap.
      pointerTravel +=
        Math.abs(e.clientX - travelX) + Math.abs(e.clientY - travelY);
      travelX = e.clientX;
      travelY = e.clientY;
      // Only before the hold takes. After that, moving drags the ring and the
      // melt together, same as a drag with the cursor down.
      if (coarse && !held && pointerTravel > params.touchSlop) endHold();

      if (!dragging) return;

      const a = pointerAngle(e);
      let delta = a - dragPrevAngle;
      // Short way round, so crossing the +/-pi seam does not snap.
      if (delta > Math.PI) delta -= TAU;
      if (delta < -Math.PI) delta += TAU;

      const turn = delta * params.dragSpeed;
      state.spin += turn;

      const now = performance.now();
      spinVel = turn / (Math.max(8, now - dragPrevTime) / 1000);
      dragPrevAngle = a;
      dragPrevTime = now;
    };

    const onPointerUp = (e) => {
      // Releasing the capture fires a leave at the container even though the
      // cursor never went anywhere, so re-track before anything else.
      trackPointer(e);
      // The finger is gone; a cursor is still there.
      endHold();
      if (!dragging) return;
      dragging = false;
      renderer.domElement.releasePointerCapture?.(e.pointerId);
    };

    // A drag ends in a click too, so only a near-stationary press counts.
    // `over` comes from the same hit test that decides the tag, so a click
    // only ever lands on the card the tag was offering.
    const onClick = () => {
      if (!interactive || pointerTravel >= 5 || over < 0) return;
      pick(over);
    };

    container.addEventListener("wheel", onWheel, { passive: false });
    container.addEventListener("pointerdown", onPointerDown);
    container.addEventListener("pointermove", onPointerMove);
    container.addEventListener("pointerup", onPointerUp);
    container.addEventListener("pointercancel", onPointerUp);
    container.addEventListener("pointerleave", onPointerLeave);
    container.addEventListener("click", onClick);

    /* ----------------------------------------------------------- keyboard */
    // 이 링은 포인터로만 돌릴 수 있었다. 측정해 보면 포커스 가능한 요소가 0개라
    // Tab 을 아무리 눌러도 초점이 body 를 벗어나지 않았고, 화살표로도 Enter 로도
    // 아무 일이 없었다 — 키보드나 스크린리더를 쓰는 사람은 아홉 개 작업의
    // 상세에 도달할 방법이 아예 없었다는 뜻이다. 접근성을 직무로 적은 사람의
    // 포트폴리오에서 이것보다 나쁜 결함은 없다.
    //
    // 캔버스를 감싼 컨테이너 하나만 포커스를 받게 하고 거기서 전부 처리한다.
    // 카드마다 탭 정지점을 두는 편이 얼핏 친절해 보이지만, 아홉 개를 지나야
    // 다음으로 갈 수 있게 되고 시각적으로는 하나만 앞에 있으므로 초점이 어디에
    // 있는지 읽히지 않는다.
    const slotStep = (dir) => {
      if (!interactive || diveI >= 0) return;
      const slot = TAU / Math.round(params.count);
      stopPick();
      spinVel = 0;
      settling = false;
      picking = true;
      gsap.killTweensOf(state);
      gsap.to(state, {
        spin: state.spin + dir * slot,
        duration: params.pickTime,
        ease: params.pickEase,
        onComplete: () => {
          picking = false;
        },
      });
    };

    const onKeyDown = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      switch (e.key) {
        // 오른쪽 화살표가 목록의 다음 장(01 -> 02)이다. 링을 앞으로 돌리면
        // 앞 슬롯은 뒤로 걸어가므로 부호가 뒤집혀 있다 — cellOf 와 같은 이유다.
        case "ArrowRight":
        case "ArrowDown":
          e.preventDefault();
          slotStep(1);
          break;
        case "ArrowLeft":
        case "ArrowUp":
          e.preventDefault();
          slotStep(-1);
          break;
        case "Enter":
        case " ":
          e.preventDefault();
          if (interactive && diveI < 0 && frontPlane >= 0 && shown >= 0) {
            openCard(frontPlane);
          }
          break;
        default:
          break;
      }
    };
    container.addEventListener("keydown", onKeyDown);

    /* --------------------------------------------------------------- skip */
    // 엔트리는 스스로 10초 가까이 돌고, 그동안 읽을 수 있는 것이 없다. WCAG 2.2
    // SC 2.2.2 (Pause, Stop, Hide, Level A) 는 자동으로 시작해 5초를 넘기고 다른
    // 내용과 함께 제시되는 움직임에 멈출 수단을 요구한다 — 이 연출이 정확히
    // 그것이다. prefers-reduced-motion 을 켠 사람은 이미 2.3초에 도착하지만,
    // 그 설정을 쓰지 않는 사람에게도 빠져나갈 문은 있어야 한다.
    //
    // 셰이더 자체는 대상이 아니다. wobble 은 탄생이 끝나면 0으로 죽고 wake 는
    // 커서가 움직일 때만 살아 있어서, 가만히 둔 화면은 실제로 정지해 있다.
    const showSkip = (on) => {
      if (!skipEl) return;
      skipEl.hidden = !on;
    };

    const skipEntry = () => {
      if (!tl || interactive) return;
      skipped = true;
      // 재생목록 자체를 끝으로 보낸다. 여기서 gsap.killTweensOf(state) 를 부르면
      // 안 된다 — 링을 펼치고 옮기는 트윈이 바로 이 타임라인의 자식이라,
      // 죽이고 나면 progress(1) 이 적용할 것이 남지 않아 씨앗만 덩그러니 남는다.
      // 실제로 그렇게 나갔고, "이름이 공지되는가"만 보던 검증이 그걸 놓쳤다.
      // 대기 중인 resume 은 위의 skipped 플래그가 막는다.
      //
      // 이벤트는 죽인 채 보낸다. 콜백까지 재생하면 타임라인이 중간에 걸어 둔
      // addPause 가 다시 playhead 를 붙잡는다.
      tl.progress(1, true).pause();
      textGroup.visible = false;
      if (loaderEl) gsap.set(loaderEl, { opacity: 0 });
      if (listEl) gsap.set(listEl, { opacity: 1 });
      showSkip(false);
      interactive = true;
      container.focus({ preventScroll: true });
    };
    if (skipEl) skipEl.addEventListener("click", skipEntry);

    const updatePointer = (dt) => {
      // Held off until the entry finishes, so the cursor cannot soften the
      // ring while the timeline is still drawing it.
      const live = params.hover && engaged() && pointer.seeded && interactive;
      cursor.amt += ((live ? 1 : 0) - cursor.amt) * chase(dt, 0.12);

      const k = chase(dt, params.lag);
      cursor.x += (pointer.x - cursor.x) * k;
      cursor.y += (pointer.y - cursor.y) * k;

      // The gap left behind the real pointer stands in for speed. Instant
      // attack, slow release, so the wake outlives the movement.
      const trail = Math.hypot(pointer.x - cursor.x, pointer.y - cursor.y);
      cursor.wake = Math.max(
        cursor.wake * Math.pow(0.94, dt * 60),
        clamp01(trail / (Math.max(dt, 0.001) * 2600)),
      );

      // Scaled by fit like the ring: a reach in raw px would cross two cards
      // on a small window and half of one on a large. Frequencies are not.
      uniforms.uMouse.value.set(
        cursor.x,
        cursor.y,
        cursor.amt,
        params.melt * fit,
      );
      uniforms.uMelt.value.set(
        params.meltReach * fit,
        params.wave * fit * cursor.wake * cursor.amt,
        params.waveFreq,
        params.waveSpeed,
      );
    };

    /* ------------------------------------------------------- load counter */
    // Reads whichever of the two is further behind: the art arriving, or the
    // seed's own birth. Both have to finish before there is anything to
    // launch, so counting bytes alone leaves the number sitting on 100 waiting
    // for a condition nobody told the viewer about.
    const loading = { shown: 0 };

    const tickLoader = (dt) => {
      const target = Math.min(loadProg, clamp01(state.progress));
      loading.shown += (target - loading.shown) * chase(dt, params.loaderChase);

      // Never 000; that reads as nothing happening.
      const n = Math.min(100, Math.max(1, Math.round(loading.shown * 100)));
      if (loaderEl) loaderEl.textContent = String(n).padStart(3, "0");

      if (!launchReady && n >= 100) {
        launchReady = true;
        for (const fn of readyWaiters) fn();
        readyWaiters.length = 0;
      }
    };

    /* ------------------------------------------------------- the carousel */
    const travel = new Float32Array(MAX_PLANES);
    const cum = new Float32Array(MAX_PLANES);
    const order = [];
    // Where each plane would sit with no cursor near it. The honey is measured
    // off these, so hovering cannot feed back into the unfurl's geometry.
    const rest = Array.from({ length: MAX_PLANES }, () => new THREE.Vector2());

    // Per-plane response to the pointer, eased rather than recomputed from
    // where it is, so the ring trails the cursor and settles back on its own.
    const hoverF = new Float32Array(MAX_PLANES);
    const leanX = new Float32Array(MAX_PLANES);
    const leanY = new Float32Array(MAX_PLANES);
    const webF = new Float32Array(MAX_LINKS);
    // The other half of it: how much a plane is standing aside for the card
    // being pointed at. Zero on that card, zero when there isn't one.
    const sideF = new Float32Array(MAX_PLANES);
    // Where the hovered card is, latched at the end of a frame for the next
    // one. The hit test runs inside the loop and every plane needs an answer
    // before the loop reaches that card, so this is deliberately one frame
    // behind — it is eased over ten of them anyway. Not reset when the cursor
    // leaves: the direction has to stay meaningful while the push decays.
    const focusPos = new THREE.Vector2();

    const swellOf = (i) =>
      Math.max(
        0.05,
        1 + params.swell * hoverF[i] - params.sideScale * sideF[i],
      );

    // Which card is at the front, and which is under the cursor.
    let shown = -1;
    let announced = -1;
    let over = -1;
    let tagUp = false;

    const paintList = () => {
      const items = itemsRef.current;
      for (let i = 0; i < items.length; i++) {
        const el = items[i];
        if (!el) continue;
        const on = i === shown;
        el.style.opacity = on ? "1" : "0.2";
        if (on) el.setAttribute("aria-current", "true");
        else el.removeAttribute("aria-current");
      }
    };

    const layout = (dt) => {
      const count = Math.round(params.count);
      uniforms.uCount.value = count;

      const step = TAU / count;
      const spread = clamp01(state.spread);

      // Band values are picked per frame rather than latched on resize, so
      // dragging any of these sliders shows up straight away.
      const endScale = narrowNow ? params.narrowEndScale : params.endScale;
      const posX = tightNow
        ? params.tightPosX
        : narrowNow
          ? params.narrowPosX
          : params.posX;

      // The stage transform. Everything in plane-pixels goes through g, which
      // is why the window fit rides in here rather than on a dozen params.
      const shift = clamp01(state.shift);
      const g = (1 + (endScale - 1) * shift) * fit;

      // Hoisted above the offset, because on a phone the offset has to answer
      // to how big the ring actually came out.
      const cardLong = params.planeSize * planeK * g;
      const ringR = params.ringRadius * radiusK * g;

      let cx = posX * viewW * 0.5 * shift;
      // Tight: minScale pins the ring's size below about 756px while posX goes
      // on scaling with the window, so the front card overruns the right edge
      // — by about 56px on a 390 phone, and worse the narrower it gets. The
      // offset is a fraction of the window; the overrun is not. So the ring is
      // pulled left by exactly the overrun, which lands the card being read
      // against the same inset at any phone width instead of off the screen.
      if (tightNow && shift > 0) {
        const halfAcross = (params.radial ? cardLong : cardLong / 1.5) * 0.5;
        const over =
          viewW * 0.5 +
          cx +
          ringR +
          halfAcross -
          (viewW - params.tightInset * fit);
        if (over > 0) cx -= over * shift;
      }
      const cy = params.posY * viewH * 0.5 * shift;

      // Screen-space centre, for pointer maths. World Y is up, page Y is down.
      ringCentre.x = viewW * 0.5 + cx;
      ringCentre.y = viewH * 0.5 - cy;
      // A plane faces front when the ring centre, that plane and the middle of
      // the screen line up. Before the stage move there is no front, so 3
      // o'clock stands in.
      frontAngle = cx !== 0 || cy !== 0 ? Math.atan2(-cy, -cx) : 0;

      // Anything measured in plane long edges — hover reach, thread reach,
      // side falloff — comes off W, so the narrow bump reaches them for free.
      const W = cardLong;
      const H = W / 1.5;
      uniforms.uSize.value.set(W, H);
      // Tracks the plane, not the window: a card 25% bigger with the same
      // corner is a differently shaped card, not a bigger one.
      uniforms.uRadius.value = params.radius * planeK * g;

      // Radial: the long edge points outward, so a plane's reach toward its
      // neighbour is its short axis and the facing edges are the long ones.
      const sepExtent = params.radial ? H : W;
      const faceEdge = params.radial ? W : H;

      const R = ringR;
      const restingGap = 2 * R * Math.sin(step / 2) - sepExtent;
      info.restingGap = Math.round((restingGap / g) * 10) / 10;
      // The whole stretch plays out across this, so it is the yardstick.
      const finalSep = Math.max(1, restingGap);

      // Every generation is in flight at once, offset by a small phase, so
      // this is one continuous unfurl and not a queue of separate pops.
      const maxN = Math.max(1, Math.abs(signedOffset(count - 1)));
      const dur = Math.max(0.1, 1 - FAN_START - params.stagger);

      // Cumulative, so an unborn plane sits exactly on top of its parent and
      // is peeled out of it one ring step at a time.
      cum[0] = 0;
      for (let n = 1; n <= maxN; n++) {
        const start = FAN_START + ((n - 1) / maxN) * params.stagger;
        const t = clamp01((spread - start) / dur);
        const e = t * t * (3 - 2 * t);
        travel[n] = e;
        cum[n] = cum[n - 1] + e;
      }

      const seedAngle = params.seed * DEG;
      // The seed is born flat at centre then rides out. Applied as the radius
      // rather than an offset on plane 0, so scrubbing the timeline stays
      // consistent — the unborn are stacked on the seed either way.
      const launch = easeInOutCubic(clamp01(state.launch));
      const Rnow = R * launch;

      order.length = 0;

      const track = cursor.amt > 0.001;
      const reach = Math.max(1, params.reach * W);
      const sideReach = Math.max(1, params.sideReach * W);
      // Asymmetric on purpose: the ring takes up a lean quickly and lets go
      // slowly. Equal rates read as a mechanism following the cursor; the gap
      // between them is what reads as something viscous.
      const kRise = chase(dt, params.grab);
      const kFall = chase(dt, params.release);

      // Nearest plane to front, in angle rather than screen distance: two
      // planes can sit equally far from the middle, but only one faces it.
      let frontI = -1;
      let frontD = 1e9;
      let frontCell = 0;

      // Art is dealt by ring slot, not plane index. Planes are numbered in fan
      // order, so dealing by index puts every other project side by side and
      // steps the column two names per slot. Negated because turning the ring
      // forward walks the front slot backwards.
      const imgOff = Math.round(params.imageOffset);
      const cellOf = (slot) =>
        imageCount > 0
          ? (((imgOff - slot) % imageCount) + imageCount) % imageCount
          : 0;

      // Which card the cursor is on. Independent of the hover falloff above:
      // turning the goo off should not take the tag with it.
      const probe = pointer.inside && pointer.seeded && interactive;
      let overI = -1;
      // Which card the rest are standing aside for, from last frame.
      const focusI = track ? over : -1;

      for (let i = 0; i < count; i++) {
        const sIdx = signedOffset(i);
        const n = Math.abs(sIdx);
        const u = i === 0 ? clamp01(state.progress) : travel[n];
        const cell = cellOf(sIdx);

        const angle = seedAngle + Math.sign(sIdx) * step * cum[n] + state.spin;
        const px = Math.cos(angle) * Rnow + cx;
        const py = Math.sin(angle) * Rnow + cy;
        rest[i].set(px, py);

        // atan2 of the difference wraps to +/-pi, so the seam costs nothing.
        const da = angle - frontAngle;
        const toFront = Math.abs(Math.atan2(Math.sin(da), Math.cos(da)));
        if (toFront < frontD) {
          frontD = toFront;
          frontI = i;
          frontCell = cell;
        }

        // Lean toward the cursor. Scaled by u so the unborn keep out of it:
        // they are stacked on their parent, and without this the whole stack
        // would lean at once and drag the seed off the ring.
        let f = 0;
        let toX = 0;
        let toY = 0;
        if (track) {
          const dx = cursor.x - px;
          const dy = cursor.y - py;
          const dist = Math.hypot(dx, dy);
          f = smoothstep(reach, reach * 0.22, dist) * cursor.amt * u;
          if (f > 0.0001 && dist > 0.0001) {
            const lean = (params.pull * fit * f) / dist;
            toX = dx * lean;
            toY = dy * lean;
          }
        }

        // One rate for the whole of a plane's response, so the swell, the lean
        // and the honey it feeds move together instead of drifting apart.
        const k = f > hoverF[i] ? kRise : kFall;
        hoverF[i] += (f - hoverF[i]) * k;
        leanX[i] += (toX - leanX[i]) * k;
        leanY[i] += (toY - leanY[i]) * k;

        // Standing aside. Measured from the hovered card, not the cursor, so
        // the response holds steady while the cursor moves around inside it.
        let sf = 0;
        if (focusI >= 0 && i !== focusI) {
          const d = Math.hypot(focusPos.x - px, focusPos.y - py);
          sf = smoothstep(sideReach, sideReach * 0.2, d) * u;
        }
        // Its own rate: a card can be letting go of a lean at the same moment
        // it is asked to back away, and sharing one would make the second
        // thing sluggish.
        sideF[i] += (sf - sideF[i]) * (sf > sideF[i] ? kRise : kFall);

        // Straight off the eased factor — sideF is already smooth, and easing
        // it twice would only add lag.
        let pushX = 0;
        let pushY = 0;
        if (sideF[i] > 0.0001) {
          const dx = px - focusPos.x;
          const dy = py - focusPos.y;
          const dist = Math.hypot(dx, dy);
          if (dist > 0.0001) {
            const away = (params.sidePush * fit * sideF[i]) / dist;
            pushX = dx * away;
            pushY = dy * away;
          }
        }

        uniforms.uPos.value[i].set(
          px + leanX[i] + pushX,
          py + leanY[i] + pushY,
        );
        uniforms.uRot.value[i] =
          (params.radial ? angle : angle + HALF_PI) * launch;

        // The seed grows over its whole birth. The others are already there,
        // merged inside their parent, so they reach full size early and spend
        // the rest of their travel pulling away.
        const sx =
          i === 0
            ? easeOutCubic(clamp01(u / 0.7))
            : easeOutCubic(clamp01(u / 0.34));
        const sy =
          i === 0
            ? easeOutCubic(clamp01((u - 0.18) / 0.74))
            : easeOutCubic(clamp01((u - 0.06) / 0.36));
        // The swell rides on the birth scale rather than uSize, so a plane
        // under the cursor grows about its own centre.
        const sw = swellOf(i);
        uniforms.uScale.value[i].set(
          sx * sw,
          sy * sw,
          1 - params.sideDim * sideF[i],
          cell,
        );

        // Same box the shader draws, tested in the plane's own frame, so it
        // answers for the card as it actually is: turned, leaned and swollen.
        // Cards never overlap once formed, so the first hit is the only hit.
        if (probe && overI < 0) {
          const rot = uniforms.uRot.value[i];
          const qx = cursor.x - (px + leanX[i] + pushX);
          const qy = cursor.y - (py + leanY[i] + pushY);
          const cr = Math.cos(rot);
          const sr = Math.sin(rot);
          if (
            Math.abs(qx * cr + qy * sr) <= W * 0.5 * sx * sw &&
            Math.abs(-qx * sr + qy * cr) <= H * 0.5 * sy * sw
          ) {
            overI = i;
          }
        }

        order.push(i);
      }

      for (let i = count; i < MAX_PLANES; i++) {
        uniforms.uScale.value[i].set(0, 0, 1, 0);
        hoverF[i] = 0;
        leanX[i] = 0;
        leanY[i] = 0;
        sideF[i] = 0;
      }

      /* ---- dive ---- */
      // A camera move about the picked card, in two beats laid over one
      // another rather than played in sequence.
      //
      //  peel — the card draws back a hair, then comes out of the ring: it
      //         swells, and its neighbours actively clear away and darken
      //         instead of merely being carried off by the zoom. This beat is
      //         what says the card *left* the ring.
      //  zoom — takes over from behind the peel and swallows the screen,
      //         carrying the card to the middle as it goes.
      //
      // Applied on top of the normal layout each frame, so a resize mid-dive
      // stays covered and the flight home lands exactly where the ring is.
      const dv = clamp01(state.dive);
      // Read below by the honey, which strings between the card and the two
      // it is pulling away from — so it has to be in scope past this block.
      const peel = smoothstep(0, 0.42, dv);
      if (dv > 0 && diveI >= 0) {
        const zoom = smoothstep(0.16, 1, dv);
        // Recoil: one short breath backwards before it goes. Half a beat, and
        // the launch stops looking like something the page decided on its own.
        const coil = Math.sin(Math.PI * clamp01(dv / 0.22)) * params.diveCoil;
        const cover =
          Math.max(viewW / Math.max(1, W), viewH / Math.max(1, H)) *
          params.diveCover;
        const z = 1 + (cover - 1) * zoom;
        const px0 = uniforms.uPos.value[diveI].x;
        const py0 = uniforms.uPos.value[diveI].y;
        for (let i = 0; i < count; i++) {
          const q = uniforms.uPos.value[i];
          const s = uniforms.uScale.value[i];
          // The pivot rides home on the zoom, not on raw progress, or the
          // card would be at centre screen before it was big enough to be
          // there and the two beats would read as a slide plus a zoom.
          let qx = (q.x - px0) * z + px0 * (1 - zoom);
          let qy = (q.y - py0) * z + py0 * (1 - zoom);

          if (i === diveI) {
            const lift = 1 + params.diveLift * peel * (1 - zoom) - coil;
            s.x *= lift;
            s.y *= lift;
          } else {
            // Straight out along the line from the card, so the ring opens
            // around it rather than everything drifting the same way.
            const dx = q.x - px0;
            const dy = q.y - py0;
            const d = Math.hypot(dx, dy) || 1;
            const away = params.divePart * fit * peel;
            qx += (dx / d) * away;
            qy += (dy / d) * away;
            s.z *= 1 - params.diveDim * peel;
          }

          q.set(qx, qy);
          s.x *= z;
          s.y *= z;
        }
      }

      frontGap = frontD;
      frontPlane = frontI;
      over = overI;
      // Both tests, not either: the width covers a small window on a mouse,
      // `coarse` covers a large tablet. Re-tested every frame so a window
      // dragged across the threshold resolves instead of stranding the tag.
      const wantTag = over >= 0 && !coarse && viewW > params.tagFrom;
      if (wantTag !== tagUp) {
        tagUp = wantTag;
        tag.show(wantTag);
      }
      // Off the resting centre, so a card being pushed cannot chase its own
      // shadow next frame.
      if (over >= 0) focusPos.copy(rest[over]);

      // Carried every frame whether present or not, so the tag is already in
      // the right place the moment it is asked to appear.
      uniforms.uTag.value.set(
        cursor.x + params.tagX,
        cursor.y + params.tagY,
        tag.box.sx,
        tag.box.sy,
      );
      uniforms.uTagP.value.set(
        TAG_W * 0.5,
        TAG_H * 0.5,
        TAG_H * 0.5,
        params.tagRefract,
      );
      uniforms.uTagQ.value.set(params.tagFrost, params.tagRim, 0, 0);

      // The column and the meta name whatever cell the front plane is wearing,
      // read off the same deal the shader was handed rather than recomputed —
      // so the highlight cannot disagree with the art.
      if (frontI >= 0 && imageCount > 0 && frontCell !== shown) {
        shown = frontCell;
        paintList();
      }

      /* ---- honey ---- */
      // One bridge per parent/child pair, in ring order. Deliberately none
      // closing the circle while the fan is opening: those two planes were
      // never merged, so there is nothing between them to stretch.
      order.sort((a, b) => signedOffset(a) - signedOffset(b));

      const edgeHalf = faceEdge * 0.5 * params.thread;
      // A card coming out of the ring drags on the two either side of it and
      // the threads snap, which is how everything else on this ring parts. A
      // dive that skipped it would be the one move made of different stuff.
      // Strung and broken inside the peel, so it is spent before the zoom.
      const peelWeb =
        diveI >= 0 && dv > 0
          ? params.diveWeb * Math.sin(Math.PI * clamp01(dv / 0.36))
          : 0;
      // Once closed the seam pair are neighbours like any other, and without a
      // link the one gap the fan never opened is the only one the cursor
      // cannot web back together.
      const closed = spread > 0.995 && count > 2;
      const linkCount = Math.min(closed ? count : count - 1, MAX_LINKS);

      for (let l = 0; l < linkCount; l++) {
        const ia = order[l];
        const ib = order[(l + 1) % count];

        const ca = uniforms.uPos.value[ia];
        const cb = uniforms.uPos.value[ib];
        const scA = uniforms.uScale.value[ia];
        const scB = uniforms.uScale.value[ib];

        // Measured between resting centres and birth scales, never hovered
        // ones. The unfurl's response to separation is ferociously steep — a
        // couple of percent of the gap is already a slab — so letting the lean
        // and the swell in turns a hover into a puzzle-piece join.
        const shrinkA = (params.radial ? scA.y : scA.x) / swellOf(ia);
        const shrinkB = (params.radial ? scB.y : scB.x) / swellOf(ib);
        const sep =
          rest[ia].distanceTo(rest[ib]) - sepExtent * 0.5 * (shrinkA + shrinkB);

        // 0 = faces still touching, 1 = landed at the resting gap.
        const v = clamp01(sep / finalSep);

        // Hover strings its own thread on its own curve, so it can be dialled
        // to a filament rather than inheriting the unfurl's slab. Taken at the
        // gap's midpoint, so the strongest pull lands between two planes.
        let fl = 0;
        if (track && params.web > 0.0001) {
          const mx = (ca.x + cb.x) * 0.5;
          const my = (ca.y + cb.y) * 0.5;
          const webReach = Math.max(1, params.webReach * W);
          const d = Math.hypot(cursor.x - mx, cursor.y - my);
          fl = smoothstep(webReach, webReach * 0.15, d) * cursor.amt;
        }
        // Eased on the same rates as the planes it hangs between, or the
        // thread would be there before the pull was.
        webF[l] += (fl - webF[l]) * (fl > webF[l] ? kRise : kFall);

        const strung =
          peelWeb > 0 && (ia === diveI || ib === diveI) ? peelWeb : 0;
        const w = Math.max(
          Math.pow(1 - v, params.thin),
          params.web * webF[l],
          strung,
        );
        // dissolve carries the radius past zero and out of antialiasing range
        // so the thread fades instead of bottoming out as a half-covered
        // hairline. In screen px, so unlike edgeHalf it does not carry g.
        const rEnd = edgeHalf * w - params.dissolve;
        const rMid = rEnd * (1 - (1 - params.pinch) * smoothstep(0, 0.7, v));

        uniforms.uLinkA.value[l].copy(ca);
        uniforms.uLinkB.value[l].copy(cb);
        uniforms.uLinkPar.value[l].set(
          rEnd,
          rMid,
          params.sag * g * Math.pow(v, 1.5),
          // Per link, not global: with staggered generations these are all at
          // different stages. Never wider than the neck it rounds.
          Math.min(
            params.fillet * g * smoothstep(0, 0.35, v),
            Math.max(rMid, 0) * 1.5,
          ),
        );
      }
      for (let l = linkCount; l < MAX_LINKS; l++) {
        uniforms.uLinkPar.value[l].set(-100, -100, 0, 0);
      }
      uniforms.uLinkCount.value = linkCount;

      // Both are px into the distance field, so they scale with the ring or
      // the merge reads as a different material at a different window size.
      uniforms.uK.value = params.goo * planeK * fit;
      uniforms.uWobble.value =
        params.wobble * fit * (1 - smoothstep(0.2, 0.95, state.progress));

      // Gated on the seed's own cell, not on the atlas existing: the texture
      // is bound from frame one but blank, and texturing before anything is
      // painted into it draws an empty cell.
      uniforms.uTextured.value = params.textured && firstIn ? 1 : 0;
      uniforms.uBlend.value = Math.max(0.5, params.blend * planeK * g);

      // Tight: the lip is a desktop flourish and it forces a full-screen
      // pass (the scissor below cannot cut around two opposite bands).
      const on = params.glass && !tightNow;
      uniforms.uBandTop.value = on ? params.bandTop * viewH : 0;
      uniforms.uBandBottom.value = on ? params.bandBottom * viewH : 0;
      uniforms.uGlass.value.set(
        params.refract,
        params.squeeze,
        params.ripple,
        params.rippleFreq,
      );
      uniforms.uFringe.value = on ? params.fringe : 0;
      uniforms.uSheen.value = on ? params.sheen : 0;
    };

    /* ------------------------------------------------------- entry timeline */
    // Bumped per build, so a hold left waiting on a run that has since been
    // replaced cannot resume a timeline nobody is watching.
    let entryGen = 0;

    const build = () => {
      interactive = false;
      skipped = false;
      showSkip(true);
      announced = -1;
      spinVel = 0;
      dragging = false;
      settling = false;
      // Off until the reveal wants it: pre-reveal every glyph quad drew and
      // discarded every fragment for the whole birth. The timeline switches
      // it on at textStart; the fade-out below switches it off for good.
      textGroup.visible = false;
      // The timeline tweens state.spin, so a pick in flight has to be off the
      // same property before it starts.
      stopPick();

      const gen = ++entryGen;
      // Only the first run has anything to wait for; a replay should not flash
      // the counter back up.
      if (loaderEl) gsap.set(loaderEl, { opacity: launchReady ? 0 : 1 });

      const tl = gsap.timeline({
        delay: reduceMotion ? 0 : 0.25,
        onComplete: () => {
          interactive = true;
          showSkip(false);
        },
      });

      tl.fromTo(
        state,
        { progress: 0, launch: 0, spread: 0, spin: 0, shift: 0 },
        { progress: 1, duration: 1.2, ease: "power2.out" },
      );

      // Formed and sitting at centre. It stays there until the counter lands,
      // so the ring can never unfurl into cards with nothing on them. Usually
      // there is nothing left to wait for by the time the playhead arrives —
      // the counter is paced against this same birth.
      tl.addPause(">", () => {
        whenReady(() => {
          gsap.delayedCall(params.holdAfter, () => {
            if (disposed || gen !== entryGen || skipped) return;
            tl.resume();
            if (loaderEl) {
              gsap.to(loaderEl, {
                opacity: 0,
                duration: params.loaderOut,
                ease: "power2.in",
              });
            }
          });
        });
      });

      tl.to(state, {
        launch: 1,
        duration: params.launchTime,
        ease: "power2.inOut",
      });

      // Absolute positions from here, so the stage can be dropped anywhere
      // inside the spread rather than only after it.
      const spreadStart = tl.duration() - 0.15;
      tl.to(
        state,
        { spread: 1, duration: params.spreadTime, ease: params.spreadEase },
        spreadStart,
      );

      const stageStart = spreadStart + params.stageAt * params.spreadTime;
      tl.to(
        state,
        {
          spin: params.spinTurns * TAU,
          duration: params.spinTime,
          ease: params.spinEase,
        },
        stageStart + params.spinDelay,
      );
      tl.to(
        state,
        { shift: 1, duration: params.moveTime, ease: params.moveEase },
        stageStart + params.moveDelay,
      );

      const textStart = spreadStart + params.textAt * params.spreadTime;

      if (splitText.chars.length) {
        tl.call(
          () => {
            textGroup.visible = true;
          },
          [],
          textStart,
        );
        tl.fromTo(
          splitText.chars,
          { value: 0 },
          {
            value: 1,
            duration: params.textTime,
            ease: params.textEase,
            stagger: params.textStagger,
          },
          textStart,
        );
      }

      // The heading leaves as the ring leaves, not once the ring has arrived.
      //
      // It used to be timed off the landing, which put it at full strength for
      // the whole of the stage move — and the stage move is the ring growing
      // several times over and sweeping across the middle of the screen, so
      // for about two seconds cards crossed the words while the words were
      // doing nothing about it. Keyed to the departure instead, the same
      // crossing reads as the ring wiping the heading away, which is what it
      // was always supposed to be.
      if (params.textOut && splitText.fades.length) {
        const landed = stageStart + params.moveDelay;
        tl.fromTo(
          splitText.fades,
          { value: 1 },
          {
            value: 0,
            duration: params.textOutTime,
            ease: params.textOutEase,
            stagger: params.textStagger,
            // Faded out is not free: every glyph quad still draws and samples
            // its texture each frame, only to discard. Drop the whole group
            // once nothing is visible.
            onComplete: () => {
              textGroup.visible = false;
            },
          },
          Math.max(0, landed + params.textOutAt),
        );
      }

      // The column arrives with the heading, by which point there is a front
      // for it to be reading.
      if (listEl) {
        tl.fromTo(
          listEl,
          { opacity: 0 },
          { opacity: 1, duration: params.textTime, ease: params.textEase },
          textStart,
        );
      }

      return tl;
    };

    tag.build();
    tag.load(() => {
      if (!disposed) tag.build();
    });
    styleMeta();

    let tl = null;
    const replay = () => {
      tl?.kill();
      tl = build();
    };

    // The entry is built once, and not until the faces are in. Every glyph
    // mask is sized by the glyph inside it, and the timeline holds direct
    // references to the uniforms those masks own — so rebuilding the text
    // later means rebuilding the timeline, which snaps state back to zero and
    // restarts the whole entry. On a warm cache fonts resolve in milliseconds
    // and that was invisible; on a cold one they arrive late and it reads as
    // the page going blank and starting over.
    const startEntry = () => {
      if (disposed || tl) return;
      splitText.build();
      // The group starts invisible, so without this the glyph uploads (and
      // mipmap generation) would all land on the reveal's first frame.
      for (const child of textGroup.children) {
        renderer.initTexture(child.material.uniforms.uTex.value);
      }
      tag.build();
      styleMeta();
      replay();
    };

    // fonts.ready is reliable, but nothing here is worth a permanently blank
    // page if it ever is not.
    const fontFallback = setTimeout(startEntry, 3000);
    (document.fonts?.ready ?? Promise.resolve())
      .then(startEntry)
      .catch(startEntry);

    /* ------------------------------------------------------- dev controls */
    let gui;

    if (process.env.NODE_ENV === "development") {
      Promise.all([import("lil-gui"), import("./ring/gui")]).then(
        ([{ default: GUI }, { mountGui }]) => {
          if (disposed) return;
          gui = mountGui(GUI, {
            params,
            state,
            info,
            actions: {
              replay,
              refit,
              styleMeta,
              setThreshold: meta.setThreshold,
              rebuildText: () => {
                splitText.build();
                replay();
              },
              rebuildTag: () => tag.build(),
              replayMeta: () => {
                announced = -1;
              },
              adoptWindow: () => {
                params.refWidth = Math.round(viewW);
                params.refHeight = Math.round(viewH);
                refit();
              },
            },
          });

          // REMOVE THIS IF YOU WANNA TWEAK
          gui.hide();
        },
      );
    }

    /* ---------------------------------------------------------------- loop */
    const start = performance.now();
    let prevT = start;

    renderer.setAnimationLoop(() => {
      const now = performance.now();
      // Clamped, so a backgrounded tab does not resume with one huge step.
      const dt = Math.min(0.05, (now - prevT) / 1000);
      prevT = now;
      uniforms.uTime.value = (now - start) * 0.001;

      if (interactive && !dragging && !picking) {
        state.spin += spinVel * dt;
        spinVel *= Math.pow(params.damping, dt * 60);

        // How far off the nearest slot the ring is. Zero while snap is off,
        // which leaves the parking test below reading as it always did.
        let off = 0;

        if (params.snap) {
          const slot = TAU / Math.round(params.count);
          // Rate the damping alone bleeds velocity off at, in 1/s. What is
          // left to coast is exactly v / this.
          const decay = Math.max(0.01, -Math.log(params.damping) * 60);

          // A flick is left alone until it is nearly spent, and this is what
          // counts as nearly. Never lower than the speed that leaves half a
          // slot of coast: above that the slot it is heading for is still in
          // front of it, so the run-in can only carry on forward. Later than
          // that and it has to back up, which is the one thing that looks
          // wrong.
          const engage = Math.max(params.snapFrom, decay * slot * 0.5);
          // Half a slot down to a pixel is about 4.8 e-foldings, which is what
          // lets snapTime read back as seconds.
          const rate = 4.8 / Math.max(0.05, params.snapTime);

          if (!settling && Math.abs(spinVel) < engage) {
            // Committed from where the coast alone would have left it, so it
            // carries on to the slot it was already heading for rather than
            // pulling up short. Measured off the seed and off wherever front
            // ended up, so a plane lands facing the viewer.
            const coast = state.spin + spinVel / decay;
            const phase = params.seed * DEG - frontAngle;
            snapTo = Math.round((coast + phase) / slot) * slot - phase;
            // Never quicker than it was already going, so the run-in can only
            // slow the ring down. Floored at what the worst case it can be
            // handed needs, or committing from a standstill caps itself at
            // zero and never moves.
            snapCap = Math.max(Math.abs(spinVel), slot * 0.5 * rate);
            settling = true;
          }

          if (settling) {
            off = snapTo - state.spin;
            // Speed proportional to what is left: the ring runs in on an
            // exponential and stops dead on the slot. Tying speed to distance
            // is what makes overshoot impossible, and overshoot would read as
            // a click rather than a glide.
            const aim = Math.max(-snapCap, Math.min(snapCap, off * rate));
            spinVel += (aim - spinVel) * clamp01(rate * dt);
          }
        } else {
          settling = false;
        }

        // Parked. Left running, the last hundredth of a degree creeps on for
        // ever, so put it down exactly on the slot.
        if (Math.abs(spinVel) < 0.0015 && Math.abs(off) < 0.0008) {
          spinVel = 0;
          state.spin += off;
        }
      }

      tickLoader(dt);
      updatePointer(dt);
      layout(dt);

      // Phone: only shade the ring. The page is a flat clear, so pixels
      // outside the cards (and the heading, while it is up) are money spent
      // to discard. The glass lip is already off in this band — a full-width
      // strip at both edges would force the scissor back to the whole canvas.
      renderer.setScissorTest(false);
      renderer.clear();
      if (tightNow) {
        const size = uniforms.uSize.value;
        const n = uniforms.uCount.value;
        let minX = Infinity;
        let minY = Infinity;
        let maxX = -Infinity;
        let maxY = -Infinity;
        let any = false;
        for (let i = 0; i < n; i++) {
          const sc = uniforms.uScale.value[i];
          if (Math.max(sc.x, sc.y) <= 0.0001) continue;
          const pos = uniforms.uPos.value[i];
          const rad = Math.hypot(size.x * sc.x, size.y * sc.y) * 0.5;
          minX = Math.min(minX, pos.x - rad);
          minY = Math.min(minY, pos.y - rad);
          maxX = Math.max(maxX, pos.x + rad);
          maxY = Math.max(maxY, pos.y + rad);
          any = true;
        }
        if (textGroup.visible) {
          textGroup.updateWorldMatrix(true, true);
          textBounds.setFromObject(textGroup);
          if (Number.isFinite(textBounds.min.x)) {
            minX = Math.min(minX, textBounds.min.x);
            minY = Math.min(minY, textBounds.min.y);
            maxX = Math.max(maxX, textBounds.max.x);
            maxY = Math.max(maxY, textBounds.max.y);
            any = true;
          }
        }
        if (any) {
          const pad =
            uniforms.uK.value +
            uniforms.uWobble.value +
            (cursor.amt > 0.001 ? params.meltReach : 0) +
            16;
          const x = Math.floor(viewW * 0.5 + minX - pad);
          const y = Math.floor(viewH * 0.5 + minY - pad);
          const w = Math.ceil(maxX - minX + pad * 2);
          const h = Math.ceil(maxY - minY + pad * 2);
          const sx = Math.max(0, x);
          const sy = Math.max(0, y);
          const sw = Math.min(viewW, x + w) - sx;
          const sh = Math.min(viewH, y + h) - sy;
          if (sw > 1 && sh > 1) {
            renderer.setScissorTest(true);
            renderer.setScissor(sx, sy, sw, sh);
          }
        }
      }

      // The name arrives *with* the card, not while one flicks past and not a
      // second after one lands.
      //
      // Once the snap has committed, the slot the ring is running in on is
      // decided and cannot change, so as soon as the winning card is within
      // metaLead of front the words can start moving — the morph then lands
      // about when the card does. Waiting for the ring to park instead waited
      // out the whole exponential tail: measured, the card was visually home
      // at 0.9s and the name did not begin until 1.6s.
      //
      // A pick drives spin by tween and its ease ends exactly on the slot, so
      // that one is still left to the parked test — as is a ring with the
      // snap switched off, which has no commitment to read.
      const slotAngle = TAU / Math.round(params.count);
      const parked = !picking && spinVel === 0;
      const landing = settling && frontGap < slotAngle * params.metaLead;
      if (
        interactive &&
        !dragging &&
        (parked || landing) &&
        shown >= 0 &&
        shown !== announced
      ) {
        announced = shown;
        meta.show(shown);
      }

      renderer.render(scene, camera);
    });

    return () => {
      disposed = true;
      clearTimeout(holdTimer);
      clearTimeout(fontFallback);
      renderer.setAnimationLoop(null);

      window.removeEventListener("resize", onResize);
      window.removeEventListener("viscose:close", onCloseEvent);
      window.removeEventListener("keydown", onDiveKey);
      container.removeEventListener("wheel", onWheel);
      container.removeEventListener("pointerdown", onPointerDown);
      container.removeEventListener("pointermove", onPointerMove);
      container.removeEventListener("pointerup", onPointerUp);
      container.removeEventListener("pointercancel", onPointerUp);
      container.removeEventListener("pointerleave", onPointerLeave);
      container.removeEventListener("click", onClick);
      container.removeEventListener("keydown", onKeyDown);
      skipEl?.removeEventListener("click", skipEntry);

      tl?.kill();
      gsap.killTweensOf(splitText.chars);
      gsap.killTweensOf(splitText.fades);
      gsap.killTweensOf(listEl);
      meta.dispose();
      tag.dispose();
      splitText.dispose();
      gui?.destroy();

      mesh.geometry.dispose();
      mesh.material.dispose();
      uniforms.uAtlas.value?.dispose();
      uniforms.uTagTex.value?.dispose();

      // dispose() frees GL resources but leaves the context itself alive until
      // the canvas is collected, which is not deterministic. This effect
      // re-runs on every StrictMode double mount and every hot update, so
      // without an explicit release they pile up, and once the browser's limit
      // is reached the renderer above cannot be constructed at all.
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
    };
  }, []);

  return (
    <>
      {/* 엔트리를 멈출 문. 문서 순서상 가장 앞에 둔다 — Tab 을 처음 눌렀을 때
          가장 먼저 잡혀야 의미가 있고, 마우스가 없는 사람에게도 보여야 한다.
          hover 로만 드러나는 방식은 키보드·음성 사용자를 빼놓는다. */}
      <button
        ref={skipRef}
        type="button"
        hidden
        data-ring
        className="fixed left-4 top-4 z-30 rounded-full border border-black/15 bg-[#fafafa]/80 px-3.5 py-1.5 text-xs text-black/60 backdrop-blur-sm transition hover:bg-black/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#a2542f]"
        style={{
          fontFamily: '"Freesentation", ui-sans-serif, system-ui, sans-serif',
        }}
      >
        인트로 건너뛰기
      </button>

      {/* touch-none, or the browser claims the gesture for panning and the
          pointermove stream dies mid-drag. Nothing here scrolls — the swipe
          is the carousel.

          tabIndex 0: 이 하나가 링 전체의 조작 지점이다. 화살표로 카드를 넘기고
          Enter 로 연다 (onKeyDown 참고). */}
      <div
        ref={containerRef}
        data-ring
        tabIndex={0}
        role="group"
        aria-label="작업 링. 좌우 화살표로 카드를 넘기고 Enter 로 자세히 봅니다."
        className="fixed inset-0 touch-none focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-[#a2542f]"
      />

      {/* Never takes the pointer: the canvas underneath handles the wheel and
          the drag, and the column has no business interrupting a throw that
          happens to pass under it. Sized from styleMeta, not a class, so it
          takes the narrow bump with every other label — 크기는 이 컨테이너에
          한 번만 걸고 안쪽 두 목록이 물려받는다. */}
      <div
        ref={listRef}
        style={{
          fontFamily: '"Freesentation", ui-sans-serif, system-ui, sans-serif',
        }}
        className="pointer-events-none fixed right-[12vw] top-[2.4vh] z-10 flex flex-col items-start text-right leading-[1.4] tracking-[0.01em] text-[#0a0a0a] opacity-0 max-sm:hidden"
      >
        <ul aria-label="Projects" className="flex flex-col items-start">
          {PROJECTS.map((p, i) => (
            <li
              key={p.name}
              ref={(el) => {
                itemsRef.current[i] = el;
              }}
              // No transition, deliberately: the colour turns over the moment
              // the ring passes the halfway point between two slots.
              style={{ opacity: 0.2 }}
            >
              {p.name}
            </li>
          ))}
        </ul>

        {/* 링에 세우지 않은 것들. 하나는 지금 보고 있는 이 사이트이고 하나는
            학력이라, 맡아서 만든 화면과 나란히 세우면 위계가 뭉갠다. 지울
            내용은 아니므로 색인 바로 아래에 각주로 남긴다. */}
        <ul
          aria-hidden="true"
          className="mt-[1.2em] flex flex-col items-start text-[#0a0a0a]/30"
        >
          {ASIDES.map((a) => (
            <li key={a.name}>
              {a.name}
              <span className="text-[#0a0a0a]/20">{"  ·  "}</span>
              {a.type}
            </li>
          ))}
        </ul>
      </div>

      {/* Two rows per side, identical in structure and both carrying both
          words: one relays out while the other relays in. Which row paints
          what is decided per change — see ring/meta.js.

          Hidden from the accessibility tree; a card is announced once, in
          full, from the live region below. */}
      {[
        { side: "left", justify: "flex-start" },
        { side: "right", justify: "flex-end" },
      ].map(({ side, justify }) => {
        // Baseline, not centre: the halves are set at different sizes, and a
        // shared baseline is what makes them read as one lockup.
        const row = (
          <span className="flex items-baseline whitespace-nowrap">
            <span />
            <span />
          </span>
        );
        return (
          <div
            key={side}
            ref={(el) => {
              metaRef.current[side].box = el;
            }}
            aria-hidden="true"
            className="pointer-events-none fixed top-1/2 z-10 -translate-y-1/2 tracking-[-0.01em] text-[#0a0a0a]"
          >
            <span
              ref={(el) => {
                metaRef.current[side].pair = el;
              }}
              className="absolute inset-0"
              // Promoted up front rather than at the start of each relay, so a
              // card change is not also a compositor layer being created and
              // thrown away. The frozen eval reads the morph window off this
              // attribute (autoresearch/eval/measure.mjs) — see the note in
              // autoresearch.md before removing it.
              style={{ willChange: "transform, opacity" }}
            >
              {[0, 1].map((i) => (
                <span
                  key={i}
                  ref={(el) => {
                    metaRef.current[side].layers[i] = el;
                  }}
                  className="absolute inset-0 flex items-center"
                  style={{ justifyContent: justify }}
                >
                  {row}
                </span>
              ))}
            </span>
          </div>
        );
      })}

      {/* 001 to 100. Holds the entry at the seed until it gets there. */}
      <div
        ref={loaderRef}
        aria-hidden="true"
        className="pointer-events-none fixed left-1/2 z-10 -translate-x-1/2 tracking-[-0.01em] text-[#0a0a0a]"
      />

      <div ref={liveRef} aria-live="polite" className="sr-only" />
    </>
  );
}
