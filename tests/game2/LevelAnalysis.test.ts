import { describe, expect, it } from "vitest";
import { analyze } from "../../tools/level-editor/src/analysis";
import { emptyDoc, withPlacementAdded, withThief } from "../../tools/level-editor/src/doc";

describe("关卡编辑器分析：开局已围住", () => {
    // 6×6，小偷在右上角内部坐标 (2,2)；Structure-004 放在 (1,1) 后同时堵住两条去路。
    // 这等价于「开局小偷已被围住，但 6 枚警察都还在托盘」。
    const doc = withThief(emptyDoc("captured-start", 6), { x: 5, y: 0 });
    const placed = withPlacementAdded(doc, "buildings", "Structure-004", { x: 4, y: 1 }, 0);

    it("开局围住不再阻止保存，只要求剩余警察能全部放下", () => {
        expect(placed.ok).toBe(true);
        if (!placed.ok) return;

        const report = analyze(placed.doc);
        expect(report.errors).toEqual([]);
        expect(report.captured).toBe(true);
        expect(report.solve?.status).toBe("solved");
        // 6 枚警察都还没上场，求解结果应当把它们全部放下
        expect(report.solve?.solution).toHaveLength(6);
        expect(report.blockers).toEqual([]);
    });
});
