export const TIMING = Object.freeze({
  scene: 1.6,
  connector: 0.9,
  linger: 0.35,
  crossfade: 0.12,
  preloadRadius: 1.6
});

export function buildSegments(content, ratio = "desktop") {
  const segments = [];
  let cursor = 0;

  content.sections.forEach((section, index) => {
    const sceneWeight = TIMING.scene + TIMING.linger;
    segments.push({
      key: `scene:${section.id}`,
      type: "scene",
      sectionIndex: index,
      section,
      assets: section.assets[ratio],
      start: cursor,
      end: cursor + sceneWeight,
      weight: sceneWeight
    });
    cursor += sceneWeight;

    const connector = content.connectors[index];
    if (connector) {
      segments.push({
        key: `connector:${connector.from}:${connector.to}`,
        type: "connector",
        sectionIndex: index,
        connector,
        assets: connector.assets[ratio],
        start: cursor,
        end: cursor + TIMING.connector,
        weight: TIMING.connector
      });
      cursor += TIMING.connector;
    }
  });

  return segments.map((segment) => ({ ...segment, total: cursor }));
}

export function locateSegment(segments, absoluteProgress) {
  const total = segments.at(-1)?.total ?? 0;
  const position = Math.min(Math.max(absoluteProgress, 0), Math.max(0, total - Number.EPSILON));
  const index = Math.max(0, segments.findIndex((segment) => position < segment.end));
  const segment = segments[index];
  return {
    index,
    segment,
    localProgress: segment ? (position - segment.start) / segment.weight : 0,
    absoluteProgress: position
  };
}

export function sectionTarget(segments, sectionId) {
  const segment = segments.find((item) => item.type === "scene" && item.section.id === sectionId);
  return segment ? segment.start + segment.weight * 0.5 : null;
}

export function segmentsWithinRadius(segments, position, radius = TIMING.preloadRadius) {
  return segments.filter((segment) => {
    const distance = position < segment.start
      ? segment.start - position
      : position > segment.end
        ? position - segment.end
        : 0;
    return distance <= radius;
  });
}

export function activeSectionIndex(location) {
  if (!location.segment) return 0;
  if (location.segment.type === "scene") return location.segment.sectionIndex;
  return location.localProgress >= 0.5
    ? Math.min(location.segment.sectionIndex + 1, 5)
    : location.segment.sectionIndex;
}

export function selectRatio(width, breakpoint = 720) {
  return width <= breakpoint ? "mobile" : "desktop";
}
