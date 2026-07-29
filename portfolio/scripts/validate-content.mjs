import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const portfolio = JSON.parse(readFileSync(join(root, "content", "portfolio.json"), "utf8"));
const claims = JSON.parse(readFileSync(join(root, "..", "data", "claims.json"), "utf8"));
const errors = [];
const requiredSectionFields = [
  "id", "label", "organization", "period", "role", "problem", "action", "tags", "artworkLabel", "assets"
];

if (portfolio.sections.length !== 6) errors.push(`Expected 6 sections, found ${portfolio.sections.length}.`);
if (portfolio.connectors.length !== 5) errors.push(`Expected 5 connectors, found ${portfolio.connectors.length}.`);

const ids = new Set();
for (const section of portfolio.sections) {
  for (const field of requiredSectionFields) {
    if (section[field] === undefined || section[field] === "") {
      errors.push(`${section.id ?? "unknown"} is missing ${field}.`);
    }
  }
  if (ids.has(section.id)) errors.push(`Duplicate section id: ${section.id}.`);
  ids.add(section.id);
  if (!Array.isArray(section.tags) || section.tags.length === 0) errors.push(`${section.id} has no tags.`);
  for (const ratio of ["desktop", "mobile"]) {
    for (const field of ["video", "poster", "staticImage"]) {
      if (!section.assets?.[ratio]?.[field]) errors.push(`${section.id}.${ratio}.${field} is missing.`);
    }
  }
}

portfolio.connectors.forEach((connector, index) => {
  const expectedFrom = portfolio.sections[index]?.id;
  const expectedTo = portfolio.sections[index + 1]?.id;
  if (connector.from !== expectedFrom || connector.to !== expectedTo) {
    errors.push(`Connector ${index + 1} must connect ${expectedFrom} to ${expectedTo}.`);
  }
  for (const ratio of ["desktop", "mobile"]) {
    for (const field of ["video", "poster"]) {
      if (!connector.assets?.[ratio]?.[field]) errors.push(`Connector ${index + 1}.${ratio}.${field} is missing.`);
    }
  }
});

const serialized = JSON.stringify(portfolio);
const riskyClaims = claims.filter((claim) => claim.needsEvidence === true);
for (const claim of riskyClaims) {
  if (serialized.includes(claim.id)) errors.push(`Unverified claim reference is public: ${claim.id}.`);
  if (claim.object && serialized.includes(claim.object)) errors.push(`Unverified claim text is public: ${claim.id}.`);
}

const forbiddenPatterns = [
  [/local-only:/i, "private source locator"],
  [/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i, "personal email"],
  [/(?:\+?82[-.\s]?)?0?1[016789][-.\s]?\d{3,4}[-.\s]?\d{4}/, "phone number"],
  [/"needsEvidence"\s*:\s*true/i, "needsEvidence flag"]
];
for (const [pattern, label] of forbiddenPatterns) {
  if (pattern.test(serialized)) errors.push(`Public content contains a ${label}.`);
}

if (errors.length) {
  console.error(errors.map((error) => `- ${error}`).join("\n"));
  process.exit(1);
}
console.log("Content contract passed: 6 sections, 5 connectors, no private or unverified claims.");
