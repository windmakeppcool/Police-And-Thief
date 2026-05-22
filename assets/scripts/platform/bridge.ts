export type PlatformId = "web" | "wechat" | "douyin" | "harmony" | "native";

export type VibrateType = "light" | "medium" | "heavy";

export interface IPlatformBridge {
  getPlatformId(): PlatformId;
  storageGet(key: string): string | null;
  storageSet(key: string, value: string): void;
  showToast(message: string): void;
  vibrate(type: VibrateType): void;
}

