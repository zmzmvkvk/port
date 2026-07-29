import { describe, expect, it } from "vitest";
import content from "../content/portfolio.json";
import {
  activeSectionIndex,
  buildSegments,
  locateSegment,
  sectionTarget,
  segmentsWithinRadius,
  selectRatio
} from "../src/lib/timeline.js";

describe("timeline model", () => {
  const segments = buildSegments(content, "desktop");

  it("alternates six scenes with five connectors", () => {
    expect(segments).toHaveLength(11);
    expect(segments.filter((segment) => segment.type === "scene")).toHaveLength(6);
    expect(segments.filter((segment) => segment.type === "connector")).toHaveLength(5);
    expect(segments.map((segment) => segment.type)).toEqual([
      "scene", "connector", "scene", "connector", "scene", "connector",
      "scene", "connector", "scene", "connector", "scene"
    ]);
  });

  it("locates a segment and preserves local progress", () => {
    const location = locateSegment(segments, segments[2].start + segments[2].weight * 0.25);
    expect(location.index).toBe(2);
    expect(location.localProgress).toBeCloseTo(0.25);
  });

  it("targets the center of a scene for hash navigation", () => {
    const target = sectionTarget(segments, "lotte");
    const location = locateSegment(segments, target);
    expect(location.segment.section.id).toBe("lotte");
    expect(location.localProgress).toBeCloseTo(0.5);
    expect(sectionTarget(segments, "missing")).toBeNull();
  });

  it("switches the active caption halfway through a connector", () => {
    const connector = segments[1];
    expect(activeSectionIndex(locateSegment(segments, connector.start + connector.weight * 0.49))).toBe(0);
    expect(activeSectionIndex(locateSegment(segments, connector.start + connector.weight * 0.51))).toBe(1);
  });

  it("only selects media inside the preload radius", () => {
    const near = segmentsWithinRadius(segments, segments[4].start, 0.1);
    expect(near.some((segment) => segment.key === segments[4].key)).toBe(true);
    expect(near.some((segment) => segment.key === segments[0].key)).toBe(false);
  });

  it("chooses a source without mixing aspect ratios", () => {
    expect(selectRatio(720)).toBe("mobile");
    expect(selectRatio(721)).toBe("desktop");
  });
});
