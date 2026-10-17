import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { PieceType, type Coord, type LevelData, type PieceCatalog, type Rotation } from "../../../assets/GScript/game/common/GameTypes";
import { parseLevel } from "../../../assets/GScript/game/level/LevelParser";
import { pieceCells, toAbsoluteCells } from "../../../assets/GScript/game/rules/PieceGeometry";
import { BoardPieces } from "../../../assets/GScript/game/piece/pieces";

/**
 * 只用警察棋子的目录：建筑是固定路障，不能算作玩家可落的子，
 * 否则「可解」会被建筑棋子的落点误判为成立。
 */
export const POLICE_ONLY_PIECES: PieceCatalog = Object.fromEntries(
    Object.entries(BoardPieces).filter(([, piece]) => piece.type === PieceType.Police),
);

/** assets/Game/levels 在磁盘上的绝对路径 */
const LEVELS_DIR = fileURLToPath(new URL("../../../assets/Game/levels/", import.meta.url));

/** 读关卡 JSON 并解析为内部 LevelData（坐标已从左上原点列/行换算） */
export function loadLevelFile(levelId: string): LevelData {
    return parseLevel(JSON.parse(readFileSync(join(LEVELS_DIR, `${levelId}.json`), "utf8")), BoardPieces);
}

/** 关卡里开局就固定占住格子的东西：建筑障碍 + 预置锁定的警察棋子 */
export function fixedBlockedCells(level: LevelData): Coord[] {
    return [
        ...level.buildings.flatMap(b =>
            toAbsoluteCells(pieceCells(BoardPieces[b.pieceId], b.rotation), b.anchor)),
        ...level.police.flatMap(p =>
            toAbsoluteCells(pieceCells(BoardPieces[p.pieceId], p.rotation), p.anchor)),
    ];
}

/** 玩家可以部署的警察棋子目录：去掉关卡预置锁定的那些（它们开局就在棋盘上） */
export function deployablePoliceCatalog(level: LevelData): PieceCatalog {
    const preset = new Set(level.police.map(p => p.pieceId));
    return Object.fromEntries(Object.entries(POLICE_ONLY_PIECES).filter(([id]) => !preset.has(id)));
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
