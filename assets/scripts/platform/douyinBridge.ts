import type { IPlatformBridge, PlatformId, VibrateType } from "./bridge.js";

type TtLike = Readonly<{
  getStorageSync(key: string): string;
  setStorageSync(key: string, value: string): void;
  showToast(args: { title: string; icon?: "none" | "success" | "fail" }): void;
  vibrateShort(args?: { type?: "light" | "medium" | "heavy" }): void;
}>;

function tt(): TtLike {
  return (globalThis as unknown as { tt: TtLike }).tt;
}

export class DouyinPlatformBridge implements IPlatformBridge {
  public getPlatformId(): PlatformId {
    return "douyin";
  }

  public storageGet(key: string): string | null {
    try {
      const v = tt().getStorageSync(key);
      return typeof v === "string" ? v : null;
    } catch {
      return null;
    }
  }

  public storageSet(key: string, value: string): void {
    tt().setStorageSync(key, value);
  }

  public showToast(message: string): void {
    try {
      tt().showToast({ title: message, icon: "none" });
    } catch {
      console.log(message);
    }
  }

  public vibrate(type: VibrateType): void {
    try {
      tt().vibrateShort({ type });
    } catch {
      void type;
    }
  }
}

