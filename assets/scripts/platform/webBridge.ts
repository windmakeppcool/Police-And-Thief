import type { IPlatformBridge, PlatformId, VibrateType } from "./bridge.js";

type StorageLike = Readonly<{
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}>;

function getStorage(): StorageLike | null {
  const g = globalThis as unknown as { localStorage?: StorageLike };
  if (!g.localStorage) return null;
  try {
    g.localStorage.setItem("__pat_probe__", "1");
    g.localStorage.getItem("__pat_probe__");
    return g.localStorage;
  } catch {
    return null;
  }
}

export class WebPlatformBridge implements IPlatformBridge {
  private readonly storage: StorageLike | null = getStorage();
  private readonly mem = new Map<string, string>();

  public getPlatformId(): PlatformId {
    return "web";
  }

  public storageGet(key: string): string | null {
    if (this.storage) return this.storage.getItem(key);
    return this.mem.get(key) ?? null;
  }

  public storageSet(key: string, value: string): void {
    if (this.storage) {
      this.storage.setItem(key, value);
      return;
    }
    this.mem.set(key, value);
  }

  public showToast(message: string): void {
    console.log(message);
  }

  public vibrate(type: VibrateType): void {
    void type;
  }
}

