import type { IPlatformBridge, PlatformId, VibrateType } from "./bridge.js";

export class MemoryPlatformBridge implements IPlatformBridge {
  private readonly platformId: PlatformId;
  private readonly storage = new Map<string, string>();

  public constructor(platformId: PlatformId = "web") {
    this.platformId = platformId;
  }

  public getPlatformId(): PlatformId {
    return this.platformId;
  }

  public storageGet(key: string): string | null {
    return this.storage.get(key) ?? null;
  }

  public storageSet(key: string, value: string): void {
    this.storage.set(key, value);
  }

  public showToast(message: string): void {
    void message;
  }

  public vibrate(type: VibrateType): void {
    void type;
  }
}

