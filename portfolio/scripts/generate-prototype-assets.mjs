import { mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import ffmpegPath from "ffmpeg-static";
import portfolio from "../content/portfolio.json" with { type: "json" };

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const publicRoot = join(root, "public");
const base = "#e7e2d8";
const accentColors = ["#627d8f", "#b78667", "#384c5c", "#8d9a84", "#7e6b83", "#2f4654"];

function outputPath(assetPath) {
  return join(publicRoot, assetPath.replace(/^\//, ""));
}

function run(args) {
  const result = spawnSync(ffmpegPath, ["-hide_banner", "-loglevel", "error", "-y", ...args], {
    stdio: "inherit"
  });
  if (result.status !== 0) {
    throw new Error(`ffmpeg failed with exit code ${result.status}`);
  }
}

function studioFilter(width, height, accent, duration, animated) {
  const boxW = Math.round(width * 0.28);
  const boxH = Math.round(height * 0.34);
  const left = Math.round(width * 0.54);
  const top = Math.round(height * 0.28);
  const line = Math.max(2, Math.round(width / 900));
  const common = [
    `drawbox=x=${Math.round(width * 0.08)}:y=${Math.round(height * 0.14)}:w=${Math.round(width * 0.84)}:h=${Math.round(height * 0.72)}:color=#c8c2b8@0.48:t=${line}`,
    `drawbox=x=${Math.round(width * 0.11)}:y=${Math.round(height * 0.76)}:w=${Math.round(width * 0.78)}:h=${line}:color=#98938b@0.55:t=fill`,
    `drawbox=x=${Math.round(width * 0.16)}:y=${Math.round(height * 0.21)}:w=${Math.round(width * 0.18)}:h=${Math.round(height * 0.46)}:color=#f3f0e9@0.8:t=fill`
  ];
  const active = animated ? `:enable='between(t,0.35,${duration - 0.75})'` : "";
  const motionX = animated ? `${left}+sin(t*0.85)*${Math.round(width * 0.025)}` : `${left}`;
  const art = [
    `drawbox=x='${motionX}':y=${top}:w=${boxW}:h=${boxH}:color=${accent}@0.82:t=fill${active}`,
    `drawbox=x='${motionX}+${Math.round(boxW * 0.13)}':y=${top + Math.round(boxH * 0.15)}:w=${Math.round(boxW * 0.74)}:h=${Math.round(boxH * 0.7)}:color=#edf0ed@0.64:t=${line}${active}`,
    `drawbox=x=${Math.round(width * 0.38)}:y=${Math.round(height * 0.62)}:w=${Math.round(width * 0.38)}:h=${Math.round(height * 0.06)}:color=#2b3033@0.14:t=fill${active}`
  ];
  return [...common, ...art, "format=yuv420p"].join(",");
}

function createStill(path, width, height, accent, rich) {
  mkdirSync(dirname(path), { recursive: true });
  const filter = studioFilter(width, height, accent, 5, false);
  run([
    "-f", "lavfi",
    "-i", `color=c=${base}:s=${width}x${height}:r=1`,
    "-vf", rich ? filter : filter,
    "-frames:v", "1",
    "-c:v", "libwebp",
    "-quality", rich ? "82" : "76",
    path
  ]);
}

function createVideo(path, width, height, duration, gop, accent) {
  mkdirSync(dirname(path), { recursive: true });
  run([
    "-f", "lavfi",
    "-i", `color=c=${base}:s=${width}x${height}:r=30:d=${duration}`,
    "-vf", studioFilter(width, height, accent, duration, true),
    "-an",
    "-c:v", "libx264",
    "-preset", "veryfast",
    "-crf", "25",
    "-pix_fmt", "yuv420p",
    "-r", "30",
    "-g", String(gop),
    "-keyint_min", String(gop),
    "-bf", "0",
    "-sc_threshold", "0",
    "-movflags", "+faststart",
    path
  ]);
}

for (const [sectionIndex, section] of portfolio.sections.entries()) {
  for (const [ratio, dimensions] of Object.entries({
    desktop: { width: 1920, height: 1080, gop: 8 },
    mobile: { width: 720, height: 1280, gop: 4 }
  })) {
    const assets = section.assets[ratio];
    const accent = accentColors[sectionIndex];
    if (!existsSync(outputPath(assets.video))) {
      createVideo(outputPath(assets.video), dimensions.width, dimensions.height, 5, dimensions.gop, accent);
    }
    if (!existsSync(outputPath(assets.poster))) {
      createStill(outputPath(assets.poster), dimensions.width, dimensions.height, accent, false);
    }
    if (!existsSync(outputPath(assets.staticImage))) {
      createStill(outputPath(assets.staticImage), dimensions.width, dimensions.height, accent, true);
    }
  }
}

for (const [connectorIndex, connector] of portfolio.connectors.entries()) {
  for (const [ratio, dimensions] of Object.entries({
    desktop: { width: 1920, height: 1080, gop: 8 },
    mobile: { width: 720, height: 1280, gop: 4 }
  })) {
    const assets = connector.assets[ratio];
    const accent = accentColors[connectorIndex + 1];
    if (!existsSync(outputPath(assets.video))) {
      createVideo(outputPath(assets.video), dimensions.width, dimensions.height, 4, dimensions.gop, accent);
    }
    if (!existsSync(outputPath(assets.poster))) {
      createStill(outputPath(assets.poster), dimensions.width, dimensions.height, accent, false);
    }
  }
}

console.log("Prototype media generated: 22 MP4, 22 first-frame WebP, 12 static WebP.");
