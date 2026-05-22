import { DouyinPlatformBridge } from "./douyinBridge.js";
import { MemoryPlatformBridge } from "./memoryBridge.js";
import { WebPlatformBridge } from "./webBridge.js";
import { WechatPlatformBridge } from "./wechatBridge.js";
export function createPlatformBridge() {
    const g = globalThis;
    if (g.wx)
        return new WechatPlatformBridge();
    if (g.tt)
        return new DouyinPlatformBridge();
    try {
        if (typeof window !== "undefined")
            return new WebPlatformBridge();
    }
    catch {
        return new MemoryPlatformBridge("web");
    }
    return new MemoryPlatformBridge("web");
}
