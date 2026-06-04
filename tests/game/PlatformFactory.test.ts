import { describe, expect, it } from "vitest";
import { createPlatformAdapter } from "../../assets/GScript/core/platform/PlatformFactory";

describe("createPlatformAdapter", () => {
  it("returns a web adapter when no mini-game globals exist", async () => {
    const adapter = createPlatformAdapter({});

    await adapter.init();
    expect(adapter.platform).toBe("web");

    await adapter.setStorage("progress", { level: 2 });
    await expect(adapter.getStorage("progress")).resolves.toEqual({ level: 2 });
  });
});
