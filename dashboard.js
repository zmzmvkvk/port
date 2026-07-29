const state = { data: null, index: new Map() };

const $ = (selector) => document.querySelector(selector);
const escapeHtml = (value = "") => String(value).replace(/[&<>'"]/g, (char) => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;","\"":"&quot;"}[char]));
const labelStatus = (status) => ({"self-reported":"SELF-REPORTED","captured":"CAPTURED","corroborated":"CORROBORATED","portfolio-ready":"PORTFOLIO-READY","needs-evidence":"NEEDS EVIDENCE"}[status] || String(status || "UNKNOWN").toUpperCase());
const formatDate = (date) => date ? date.replace("-", ".") : "현재";
const range = (item) => `${formatDate(item.start)} — ${item.end ? formatDate(item.end) : "현재"}`;
const byId = (id) => state.index.get(id);

async function loadData() {
  const manifest = await fetch("./data/index.json").then((response) => {
    if (!response.ok) throw new Error(`data/index.json: ${response.status}`);
    return response.json();
  });
  const entries = Object.entries(manifest.collections);
  const loaded = await Promise.all(entries.map(async ([key, path]) => [key, await fetch(`./data/${path.replace(/^\.\/data\//, "")}`).then((r) => {
    if (!r.ok) throw new Error(`${path}: ${r.status}`);
    return r.json();
  })]));
  const data = Object.fromEntries(loaded);
  data.manifest = manifest;
  state.data = data;
  [data.experiences, data.projects, data.education, data.skills, data.claims, data.evidence, data.relations].flat().forEach((item) => state.index.set(item.id, item));
  state.index.set(data.profile.id, data.profile);
  return data;
}

function render() {
  const { profile, experiences, projects, education, skills, claims, evidence, relations, manifest } = state.data;
  $("#profile-name").textContent = profile.name;
  $("#profile-headline").textContent = profile.headline;
  $("#profile-summary").textContent = profile.summary;
  $("#target-roles").innerHTML = profile.targetRoles.map((role) => `<span class="tag">${escapeHtml(role)}</span>`).join("");
  $("#stat-experiences").textContent = experiences.length;
  $("#stat-projects").textContent = projects.length;
  $("#stat-skills").textContent = skills.length;
  $("#stat-gaps").textContent = claims.filter((claim) => claim.needsEvidence).length;
  $("#experience-count").textContent = `${experiences.length} nodes`;
  $("#project-count").textContent = `${projects.length} nodes`;
  $("#claim-count").textContent = `${claims.length} claims`;
  $("#updated-at").textContent = `updated ${manifest.updatedAt}`;

  renderExperiences(experiences);
  renderProjects(projects);
  renderClaims(claims, evidence);
  renderEducation(education);
  renderCategories(skills);
}

function renderExperiences(experiences) {
  const sorted = [...experiences].sort((a, b) => String(b.start).localeCompare(String(a.start)));
  $("#experience-list").innerHTML = sorted.map((item) => `<button class="timeline-item" type="button" data-detail="${escapeHtml(item.id)}">
    <span class="timeline-date">${escapeHtml(range(item))}</span>
    <span class="timeline-main"><strong>${escapeHtml(item.organization)}</strong><span>${escapeHtml(item.role)} · ${escapeHtml(item.team || item.type)}</span></span>
    <span class="timeline-arrow" aria-hidden="true">↗</span>
  </button>`).join("");
}

function renderProjects(projects) {
  $("#project-grid").innerHTML = projects.map((item, index) => `<button class="project-tile" type="button" data-detail="${escapeHtml(item.id)}">
    <span class="project-top"><h3>${escapeHtml(item.name)}</h3><span class="project-icon">${index % 2 ? "◌" : "✳"}</span></span>
    <p>${escapeHtml(item.summary)}</p>
    <span class="mini-tags">${item.skills.slice(0, 3).map((skillId) => `<span class="mini-tag">#${escapeHtml(byId(skillId)?.name || skillId.replace("skill:", ""))}</span>`).join("")}</span>
  </button>`).join("");
}

function renderClaims(claims) {
  $("#claim-list").innerHTML = claims.map((claim) => `<button class="claim-item" type="button" data-detail="${escapeHtml(claim.id)}">
    <strong>${escapeHtml(claim.object)}</strong>
    <p>${escapeHtml(claim.predicate)}</p>
    <span class="claim-status">${escapeHtml(labelStatus(claim.status))}${claim.needsEvidence ? " · VERIFY" : ""}</span>
  </button>`).join("");
}

function renderEducation(education) {
  $("#education-list").innerHTML = education.map((item) => `<article class="edu-item"><strong>${escapeHtml(item.institution)}</strong><span>${escapeHtml(item.program)}</span><p>${escapeHtml(item.degree)} · ${escapeHtml(range(item))}<br>${escapeHtml(item.transferableSignals[0])}</p></article>`).join("");
}

function renderCategories(skills) {
  const counts = skills.reduce((map, skill) => { map[skill.category] = (map[skill.category] || 0) + 1; return map; }, {});
  const max = Math.max(...Object.values(counts));
  const labels = { foundation: "foundation", frontend: "frontend", quality: "quality", systems: "systems", product: "product", automation: "automation" };
  $("#category-bars").innerHTML = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([key, count]) => `<div class="category-row"><span>${escapeHtml(labels[key] || key)}</span><span class="bar"><i style="width:${Math.round((count / max) * 100)}%"></i></span><b>${count}</b></div>`).join("");
}

function listBlock(title, values) {
  if (!values?.length) return "";
  return `<section class="detail-block"><h3>${escapeHtml(title)}</h3><ul>${values.map((value) => `<li>${escapeHtml(value)}</li>`).join("")}</ul></section>`;
}

function openDetail(id) {
  const item = byId(id);
  if (!item) return;
  const type = item.type || id.split(":")[0];
  $("#modal-kicker").textContent = type.toUpperCase();
  $("#modal-title").textContent = item.name || item.organization || item.object || id;
  let html = "";
  if (type === "employment" || type === "freelance") {
    html += `<section class="detail-block"><h3>Role / period</h3><p>${escapeHtml(item.role)} · ${escapeHtml(range(item))}</p></section>`;
    html += listBlock("Responsibilities", item.responsibilities);
    html += detailTags("Capabilities", item.skills);
  } else if (type === "project") {
    html += `<section class="detail-block"><h3>Summary</h3><p>${escapeHtml(item.summary)}</p></section>`;
    html += `<section class="detail-block"><h3>Problem</h3><p>${escapeHtml(item.problem)}</p></section>`;
    html += listBlock("Actions", item.actions);
    html += listBlock("Outcomes", item.outcomes);
    html += detailTags("Capabilities", item.skills);
  } else if (type === "claim") {
    html += `<section class="detail-block"><h3>Claim</h3><p>${escapeHtml(item.predicate)} → ${escapeHtml(item.object)}</p></section>`;
    html += `<section class="detail-block"><h3>Status</h3><p>${escapeHtml(labelStatus(item.status))} · confidence ${escapeHtml(item.confidence)}</p></section>`;
    html += `<section class="detail-block"><h3>Next evidence</h3><p>${escapeHtml(item.nextEvidence || "추가 근거가 필요하지 않음")}</p></section>`;
    html += `<section class="detail-block"><h3>Evidence refs</h3><p>${escapeHtml(item.evidenceRefs.join(" · "))}</p></section>`;
  } else { html += `<section class="detail-block"><p>${escapeHtml(JSON.stringify(item, null, 2))}</p></section>`; }
  $("#modal-content").innerHTML = html;
  $("#detail-modal").hidden = false;
  document.body.style.overflow = "hidden";
}

function detailTags(title, refs = []) {
  return `<section class="detail-block"><h3>${escapeHtml(title)}</h3><div class="detail-tags">${refs.map((id) => `<span class="detail-tag">${escapeHtml(byId(id)?.name || id)}</span>`).join("")}</div></section>`;
}

function closeModal() { $("#detail-modal").hidden = true; document.body.style.overflow = ""; }
function showError(error) { document.querySelector(".shell").innerHTML = `<div class="error-state"><strong>데이터를 불러오지 못했습니다.</strong><p>${escapeHtml(error.message || error)}</p><p>이 대시보드는 JSON fetch를 사용하므로 <code>python -m http.server 8787</code>로 열어 주세요.</p></div>`; }

document.addEventListener("click", (event) => {
  const detailTarget = event.target.closest("[data-detail]");
  if (detailTarget) openDetail(detailTarget.dataset.detail);
  if (event.target.closest("[data-close-modal]")) closeModal();
});
document.addEventListener("keydown", (event) => { if (event.key === "Escape") closeModal(); });

loadData().then(render).catch(showError);
