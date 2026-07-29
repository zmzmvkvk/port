import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(root, "dist");
const claims = JSON.parse(readFileSync(join(root, "..", "data", "claims.json"), "utf8"));
const errors = [];

function walk(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? walk(path) : [path];
  });
}

if (!existsSync(dist)) {
  console.error("dist/ does not exist.");
  process.exit(1);
}

const files = walk(dist);
const jsFiles = files.filter((file) => extname(file) === ".js");
const jsGzip = jsFiles.reduce((sum, file) => sum + gzipSync(readFileSync(file)).length, 0);
if (jsGzip > 80 * 1024) errors.push(`Initial JavaScript is ${(jsGzip / 1024).toFixed(1)} KiB gzip; limit is 80 KiB.`);

for (const file of files) {
  if (statSync(file).size > 25 * 1024 * 1024) errors.push(`Cloudflare file limit exceeded: ${file}`);
}

const publicText = files
  .filter((file) => [".html", ".js", ".css", ".json", ".txt", ".xml"].includes(extname(file)))
  .map((file) => readFileSync(file, "utf8"))
  .join("\n");
for (const claim of claims.filter((entry) => entry.needsEvidence === true)) {
  if (publicText.includes(claim.id) || (claim.object && publicText.includes(claim.object))) {
    errors.push(`Built output contains unverified claim: ${claim.id}`);
  }
}
if (/local-only:/i.test(publicText)) errors.push("Built output contains a private source locator.");

const indexFile = join(dist, "index.html");
const indexSize = statSync(indexFile).size;
const cssSize = files.filter((file) => extname(file) === ".css").reduce((sum, file) => sum + statSync(file).size, 0);
const firstPoster = join(dist, "assets", "media", "desktop", "posters", "01-megastudy.webp");
const criticalBytes = indexSize + cssSize + jsFiles.reduce((sum, file) => sum + statSync(file).size, 0)
  + (existsSync(firstPoster) ? statSync(firstPoster).size : 0);
if (criticalBytes > 1024 * 1024) errors.push(`Critical initial transfer is ${(criticalBytes / 1024).toFixed(1)} KiB; limit is 1 MiB.`);

if (errors.length) {
  console.error(errors.map((error) => `- ${error}`).join("\n"));
  process.exit(1);
}
console.log(`Output passed: ${(jsGzip / 1024).toFixed(1)} KiB JS gzip, ${(criticalBytes / 1024).toFixed(1)} KiB critical assets.`);
