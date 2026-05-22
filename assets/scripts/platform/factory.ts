import type { IPlatformBridge } from "./bridge.js";
import { DouyinPlatformBridge } from "./douyinBridge.js";
import { MemoryPlatformBridge } from "./memoryBridge.js";
import { WebPlatformBridge } from "./webBridge.js";
import { WechatPlatformBridge } from "./wechatBridge.js";

type GlobalAny = Readonly<{ wx?: unknown; tt?: unknown }>;

export function createPlatformBridge(): IPlatformBridge {
  const g = globalThis as unknown as GlobalAny;

  if (g.wx) return new WechatPlatformBridge();
  if (g.tt) return new DouyinPlatformBridge();

  try {
    if (typeof window !== "undefined") return new WebPlatformBridge();
  } catch {
    return new MemoryPlatformBridge("web");
  }

  return new MemoryPlatformBridge("web");
}

