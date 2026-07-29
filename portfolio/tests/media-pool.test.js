import { describe, expect, it, vi } from "vitest";
import { MediaPool } from "../src/lib/media-pool.js";

function okResponse(label = "media") {
  return {
    ok: true,
    blob: async () => new Blob([label])
  };
}

describe("MediaPool", () => {
  it("retries once after a failed request", async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 404 })
      .mockResolvedValueOnce(okResponse());
    const wait = vi.fn().mockResolvedValue();
    const pool = new MediaPool({
      fetcher,
      wait,
      createUrl: () => "blob:retry",
      revokeUrl: vi.fn()
    });

    await expect(pool.load("scene", "/scene.mp4")).resolves.toBe("blob:retry");
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(wait).toHaveBeenCalledWith(1500);
  });

  it("surfaces the final error after two attempts", async () => {
    const fetcher = vi.fn().mockResolvedValue({ ok: false, status: 404 });
    const pool = new MediaPool({
      fetcher,
      wait: async () => {},
      createUrl: () => "blob:never",
      revokeUrl: vi.fn()
    });

    await expect(pool.load("scene", "/missing.mp4")).rejects.toThrow("404");
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("evicts the least recently used blob and revokes its URL", async () => {
    const revoked = [];
    const evicted = [];
    let count = 0;
    const pool = new MediaPool({
      limit: 2,
      fetcher: async () => okResponse(String(count)),
      createUrl: () => `blob:${++count}`,
      revokeUrl: (url) => revoked.push(url),
      onEvict: (key) => evicted.push(key)
    });

    await pool.load("a", "/a.mp4");
    await pool.load("b", "/b.mp4");
    pool.touch("a");
    await pool.load("c", "/c.mp4");

    expect(pool.records.size).toBe(2);
    expect(pool.records.has("a")).toBe(true);
    expect(pool.records.has("b")).toBe(false);
    expect(revoked).toContain("blob:2");
    expect(evicted).toContain("b");
  });

  it("aborts in-flight fetches when a segment leaves the radius", async () => {
    let aborted = false;
    const fetcher = (_source, { signal }) => new Promise((_resolve, reject) => {
      signal.addEventListener("abort", () => {
        aborted = true;
        reject(new DOMException("Aborted", "AbortError"));
      });
    });
    const pool = new MediaPool({ fetcher, createUrl: vi.fn(), revokeUrl: vi.fn() });
    const promise = pool.load("far", "/far.mp4");
    pool.keep([]);
    await expect(promise).rejects.toMatchObject({ name: "AbortError" });
    expect(aborted).toBe(true);
  });
});
