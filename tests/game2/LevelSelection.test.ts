import { afterEach, describe, expect, it } from "vitest";
import {
    DEFAULT_LEVEL_ID,
    currentLevelId,
    resetLevelSelection,
    selectLevel,
} from "../../assets/GScript/game/level/LevelSelection";

describe("关卡选择状态", () => {
    afterEach(() => resetLevelSelection());

    it("默认关卡是 level_01", () => {
        resetLevelSelection();
        expect(DEFAULT_LEVEL_ID).toBe("level_01");
        expect(currentLevelId()).toBe(DEFAULT_LEVEL_ID);
    });

    it("selectLevel 之后返回新关卡 id", () => {
        selectLevel("level_03");
        expect(currentLevelId()).toBe("level_03");
    });

    it("空 id 抛错", () => {
        expect(() => selectLevel("")).toThrow();
    });

    it("resetLevelSelection 恢复默认", () => {
        selectLevel("level_02");
        resetLevelSelection();
        expect(currentLevelId()).toBe(DEFAULT_LEVEL_ID);
    });
});
