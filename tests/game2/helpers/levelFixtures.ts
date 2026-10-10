import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Coord, LevelData, Rotation } from "../../../assets/GScript/game/common/GameTypes";
import { parseLevel } from "../../../assets/GScript/game/level/LevelParser";
import { BoardPieces } from "../../../assets/GScript/game/piece/pieces";

/** assets/Game/levels 在磁盘上的绝对路径 */
const LEVELS_DIR = fileURLToPath(new URL("../../../assets/Game/levels/", import.meta.url));

/** 读关卡 JSON 并解析为内部 LevelData（坐标已从左上原点列/行换算） */
export function loadLevelFile(levelId: string): LevelData {
    return parseLevel(JSON.parse(readFileSync(join(LEVELS_DIR, `${levelId}.json`), "utf8")), BoardPieces);
}

/**
 * level_01 的参考解：用满全部 6 个警察棋子围住小偷。
 * 坐标是内部网格坐标（原点在棋盘几何中心、y 向上），描述求解落点而非关卡 JSON。
 */
export const LEVEL_01_SOLUTION: ReadonlyArray<{ pieceId: string; anchor: Coord; rotation: Rotation }> = [
    { pieceId: "PoliceUI-002", anchor: { x: 2, y: 2 }, rotation: 180 },
    { pieceId: "PoliceUI-001", anchor: { x: 0, y: 0 }, rotation: 0 },
    { pieceId: "PoliceUI-005", anchor: { x: -3, y: -3 }, rotation: 0 },
    { pieceId: "PoliceUI-006", anchor: { x: 2, y: -3 }, rotation: 0 },
    { pieceId: "PoliceUI-003", anchor: { x: -2, y: 1 }, rotation: 0 },
    { pieceId: "PoliceUI-004", anchor: { x: -2, y: -1 }, rotation: 0 },
];
