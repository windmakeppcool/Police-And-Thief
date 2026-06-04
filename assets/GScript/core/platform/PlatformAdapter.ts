export type PlatformName = "web" | "wechat" | "douyin" | "harmony" | "native";

export type PlatformLaunchOptions = Readonly<Record<string, unknown>>;

export type PlatformLoginResult = Readonly<{
  code?: string;
  anonymousId?: string;
}>;

export type SharePayload = Readonly<{
  title: string;
  imageUrl?: string;
  query?: string;
}>;

export interface PlatformAdapter {
  readonly platform: PlatformName;

  init(): Promise<void>;

  getLaunchOptions(): PlatformLaunchOptions;

  login(): Promise<PlatformLoginResult | null>;

  getStorage<T>(key: string): Promise<T | null>;

  setStorage<T>(key: string, value: T): Promise<void>;

  showRewardedAd?(placement: string): Promise<boolean>;

  showInterstitialAd?(placement: string): Promise<void>;

  share?(payload: SharePayload): Promise<void>;

  reportEvent?(name: string, params?: Record<string, unknown>): void;
}
