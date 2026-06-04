import { type PlatformAdapter } from "./PlatformAdapter";
import { WebPlatformAdapter } from "./WebPlatformAdapter";

type RuntimeGlobal = Record<string, unknown>;

export function createPlatformAdapter(runtime: RuntimeGlobal = globalThis as RuntimeGlobal): PlatformAdapter {
  if (runtime.wx) {
    return new WebPlatformAdapter();
  }
  if (runtime.tt) {
    return new WebPlatformAdapter();
  }
  if (runtime.harmony) {
    return new WebPlatformAdapter();
  }
  return new WebPlatformAdapter();
}
