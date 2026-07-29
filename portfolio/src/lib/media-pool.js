const defaultWait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

export class MediaPool {
  constructor({
    limit = 5,
    retryDelay = 1500,
    fetcher = globalThis.fetch?.bind(globalThis),
    createUrl = (blob) => URL.createObjectURL(blob),
    revokeUrl = (url) => URL.revokeObjectURL(url),
    wait = defaultWait,
    onEvict = () => {}
  } = {}) {
    this.limit = limit;
    this.retryDelay = retryDelay;
    this.fetcher = fetcher;
    this.createUrl = createUrl;
    this.revokeUrl = revokeUrl;
    this.wait = wait;
    this.onEvict = onEvict;
    this.records = new Map();
    this.clock = 0;
  }

  async load(key, source, { force = false } = {}) {
    const existing = this.records.get(key);
    if (existing && !force) {
      existing.touched = ++this.clock;
      return existing.promise;
    }
    if (existing) this.evict(key);

    const controller = new AbortController();
    const record = {
      key,
      source,
      controller,
      touched: ++this.clock,
      objectUrl: null,
      status: "loading",
      promise: null
    };

    record.promise = this.fetchWithRetry(source, controller.signal)
      .then((blob) => {
        if (controller.signal.aborted) throw new DOMException("Aborted", "AbortError");
        record.objectUrl = this.createUrl(blob);
        record.status = "ready";
        record.touched = ++this.clock;
        this.trim();
        return record.objectUrl;
      })
      .catch((error) => {
        if (this.records.get(key) === record) {
          record.status = "failed";
          record.error = error;
        }
        throw error;
      });

    this.records.set(key, record);
    this.trim();
    return record.promise;
  }

  async fetchWithRetry(source, signal) {
    let lastError;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const response = await this.fetcher(source, { signal });
        if (!response.ok) throw new Error(`Media request failed (${response.status})`);
        return await response.blob();
      } catch (error) {
        if (signal.aborted || error?.name === "AbortError") throw error;
        lastError = error;
        if (attempt === 0) await this.wait(this.retryDelay);
      }
    }
    throw lastError;
  }

  touch(key) {
    const record = this.records.get(key);
    if (record) record.touched = ++this.clock;
  }

  get(key) {
    const record = this.records.get(key);
    if (record?.status === "ready") {
      this.touch(key);
      return record.objectUrl;
    }
    return null;
  }

  keep(keys) {
    const keep = new Set(keys);
    for (const key of this.records.keys()) {
      if (!keep.has(key)) this.evict(key);
    }
  }

  trim() {
    while (this.records.size > this.limit) {
      const oldest = [...this.records.values()].sort((a, b) => a.touched - b.touched)[0];
      this.evict(oldest.key);
    }
  }

  evict(key) {
    const record = this.records.get(key);
    if (!record) return;
    record.controller.abort();
    if (record.objectUrl) this.revokeUrl(record.objectUrl);
    this.records.delete(key);
    this.onEvict(key);
  }

  destroy() {
    for (const key of [...this.records.keys()]) this.evict(key);
  }
}
