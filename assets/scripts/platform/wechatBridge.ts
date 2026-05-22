import type { IPlatformBridge, PlatformId, VibrateType } from "./bridge.js";

type WxLike = Readonly<{
  getStorageSync(key: string): string;
  setStorageSync(key: string, value: string): void;
  showToast(args: { title: string; icon?: "none" | "success" | "error" }): void;
  vibrateShort(args?: { type?: "light" | "medium" | "heavy" }): void;
}>;

function wx(): WxLike {
  return (globalThis as unknown as { wx: WxLike }).wx;
}

export class WechatPlatformBridge implements IPlatformBridge {
  public getPlatformId(): PlatformId {
    return "wechat";
  }

  public storageGet(key: string): string | null {
    try {
      const v = wx().getStorageSync(key);
      return typeof v === "string" ? v : null;
    } catch {
      return null;
    }
  }

  public storageSet(key: string, value: string): void {
    wx().setStorageSync(key, value);
  }

  public showToast(message: string): void {
    try {
      wx().showToast({ title: message, icon: "none" });
    } catch {
      console.log(message);
    }
  }

  public vibrate(type: VibrateType): void {
    try {
      wx().vibrateShort({ type });
    } catch {
      void type;
    }
  }
}

