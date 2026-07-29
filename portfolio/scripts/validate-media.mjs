import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import ffprobe from "ffprobe-static";
import ffmpegPath from "ffmpeg-static";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const publicRoot = join(root, "public");
const portfolio = JSON.parse(readFileSync(join(root, "content", "portfolio.json"), "utf8"));
const errors = [];

function localPath(assetPath) {
  return join(publicRoot, assetPath.replace(/^\//, ""));
}

function probe(file) {
  const result = spawnSync(ffprobe.path, [
    "-v", "error",
    "-show_streams",
    "-show_format",
    "-of", "json",
    file
  ], { encoding: "utf8" });
  if (result.status !== 0) throw new Error(result.stderr || `ffprobe failed for ${file}`);
  return JSON.parse(result.stdout);
}

const clips = [];
for (const section of portfolio.sections) {
  for (const ratio of ["desktop", "mobile"]) {
    clips.push({ kind: "scene", ratio, ...section.assets[ratio] });
  }
}
for (const connector of portfolio.connectors) {
  for (const ratio of ["desktop", "mobile"]) {
    clips.push({ kind: "connector", ratio, ...connector.assets[ratio] });
  }
}

for (const clip of clips) {
  for (const field of ["video", "poster"]) {
    const file = localPath(clip[field]);
    if (!existsSync(file)) errors.push(`Missing ${field}: ${clip[field]}`);
    else if (statSync(file).size > 25 * 1024 * 1024) errors.push(`Cloudflare 25 MiB limit exceeded: ${clip[field]}`);
  }
  if (clip.kind === "scene") {
    const staticImage = localPath(clip.staticImage);
    if (!existsSync(staticImage)) errors.push(`Missing static image: ${clip.staticImage}`);
  }
  const videoFile = localPath(clip.video);
  if (!existsSync(videoFile)) continue;
  try {
    const metadata = probe(videoFile);
    const video = metadata.streams.find((stream) => stream.codec_type === "video");
    const audio = metadata.streams.find((stream) => stream.codec_type === "audio");
    const expected = clip.ratio === "desktop"
      ? { width: 1920, height: 1080, gop: 8, maxMiB: clip.kind === "scene" ? 8 : 6 }
      : { width: 720, height: 1280, gop: 4, maxMiB: clip.kind === "scene" ? 4 : 3 };
    const expectedDuration = clip.kind === "scene" ? 5 : 4;
    const duration = Number(metadata.format.duration);
    if (video?.codec_name !== "h264") errors.push(`${clip.video}: codec must be H.264.`);
    if (video?.pix_fmt !== "yuv420p") errors.push(`${clip.video}: pixel format must be yuv420p.`);
    if (video?.width !== expected.width || video?.height !== expected.height) {
      errors.push(`${clip.video}: expected ${expected.width}x${expected.height}.`);
    }
    if (video?.avg_frame_rate !== "30/1") errors.push(`${clip.video}: expected 30fps.`);
    if (Math.abs(duration - expectedDuration) > 0.08) errors.push(`${clip.video}: expected ${expectedDuration}s.`);
    if (audio) errors.push(`${clip.video}: audio stream is not allowed.`);
    if (statSync(videoFile).size > expected.maxMiB * 1024 * 1024) {
      errors.push(`${clip.video}: exceeds ${expected.maxMiB} MiB budget.`);
    }
    if (Number(video?.has_b_frames) > 0) errors.push(`${clip.video}: B-frames make deterministic scrubbing less reliable.`);
    const atoms = readFileSync(videoFile);
    const moov = atoms.indexOf(Buffer.from("moov"));
    const mdat = atoms.indexOf(Buffer.from("mdat"));
    if (moov < 0 || mdat < 0 || moov > mdat) errors.push(`${clip.video}: faststart metadata is not placed before media data.`);

    const frameResult = spawnSync(ffprobe.path, [
      "-v", "error", "-select_streams", "v:0", "-show_entries", "frame=key_frame",
      "-of", "csv=p=0", videoFile
    ], { encoding: "utf8" });
    const frames = frameResult.stdout.trim().split(/\r?\n/).map(Number);
    const keyframes = frames.flatMap((key, index) => key === 1 ? [index] : []);
    const gaps = keyframes.slice(1).map((frame, index) => frame - keyframes[index]);
    if (!gaps.length || Math.max(...gaps) > expected.gop) {
      errors.push(`${clip.video}: GOP exceeds ${expected.gop}.`);
    }
  } catch (error) {
    errors.push(`${clip.video}: ${error.message}`);
  }
}

for (const ratio of ["desktop", "mobile"]) {
  const chain = [];
  portfolio.sections.forEach((section, index) => {
    chain.push({ path: section.assets[ratio].video, lastFrame: 149 });
    const connector = portfolio.connectors[index];
    if (connector) chain.push({ path: connector.assets[ratio].video, lastFrame: 119 });
  });
  for (let index = 0; index < chain.length - 1; index += 1) {
    const previous = chain[index];
    const next = chain[index + 1];
    const result = spawnSync(ffmpegPath, [
      "-hide_banner", "-i", localPath(previous.path), "-i", localPath(next.path),
      "-filter_complex",
      `[0:v]select='eq(n,${previous.lastFrame})',setpts=N/FRAME_RATE/TB[a];[1:v]select='eq(n,0)',setpts=N/FRAME_RATE/TB[b];[a][b]ssim`,
      "-frames:v", "1", "-f", "null", "-"
    ], { encoding: "utf8" });
    const output = `${result.stdout}\n${result.stderr}`;
    const score = Number(output.match(/All:([0-9.]+)/)?.[1]);
    if (result.status !== 0 || !Number.isFinite(score)) {
      errors.push(`Could not measure SSIM: ${previous.path} → ${next.path}`);
    } else if (score < 0.99) {
      errors.push(`SSIM ${score.toFixed(5)} is below 0.99: ${previous.path} → ${next.path}`);
    }
  }
}

if (errors.length) {
  console.error(errors.map((error) => `- ${error}`).join("\n"));
  process.exit(1);
}
console.log(`Media contract passed: ${clips.length} MP4 and ${clips.length + 12} WebP assets.`);
