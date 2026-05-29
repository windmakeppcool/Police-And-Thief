import { type PlatformAdapter, type PlatformLaunchOptions, type PlatformLoginResult, type SharePayload } from "./PlatformAdapter";

export class WebPlatformAdapter implements PlatformAdapter {
  readonly platform = "web" as const;
  private readonly memoryStorage = new Map<string, string>();

  async init(): Promise<void> {
    return Promise.resolve();
  }

  getLaunchOptions(): PlatformLaunchOptions {
    return {};
  }

  async login(): Promise<PlatformLoginResult> {
    return { anonymousId: "web-anonymous" };
  }

  async getStorage<T>(key: string): Promise<T | null> {
    const raw = this.readRaw(key);
    if (raw === null) {
      return null;
    }
    return JSON.parse(raw) as T;
  }

  async setStorage<T>(key: string, value: T): Promise<void> {
    const raw = JSON.stringify(value);
    const storage = this.getLocalStorage();
    if (storage) {
      storage.setItem(key, raw);
      return;
    }
    this.memoryStorage.set(key, raw);
  }

  async share(payload: SharePayload): Promise<void> {
    if (typeof navigator !== "undefined" && "share" in navigator) {
      await (navigator as Navigator & { share: (payload: SharePayload) => Promise<void> }).share(payload);
    }
  }

  reportEvent(name: string, params: Record<string, unknown> = {}): void {
    console.log(`[platform:web] ${name}`, params);
  }

  private readRaw(key: string): string | null {
    const storage = this.getLocalStorage();
    if (storage) {
      return storage.getItem(key);
    }
    return this.memoryStorage.get(key) ?? null;
  }

  private getLocalStorage(): Storage | null {
    if (typeof globalThis === "undefined") {
      return null;
    }
    const candidate = (globalThis as { localStorage?: Storage }).localStorage;
    if (!candidate) {
      return null;
    }
    if (typeof candidate.getItem !== "function" || typeof candidate.setItem !== "function") {
      return null;
    }
    return candidate;
  }
}
