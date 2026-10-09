import {
    PieceType,
    type BuildingPlacement,
    type Coord,
    type LevelData,
    type PieceCatalog,
    type Rotation,
} from "../common/GameTypes";
import { pieceCells, toAbsoluteCells } from "../rules/PieceGeometry";
// 几何校验用的 coordKey / isInBoard 在 Task 2 补入

/** JSON 里的列/行坐标：左上角 (0,0)，x 向右、y 向下，范围 0..gridSize-1 */
export type JsonCoord = Readonly<{ x: number; y: number }>;

/**
 * 解析/校验失败。errors 里是全部问题，坐标一律按 JSON 列/行书写。
 */
export class LevelParseError extends Error {
    constructor(readonly errors: readonly string[]) {
        super(`[LevelParser] 关卡数据校验失败（${errors.length} 处）：\n  - ${errors.join("\n  - ")}`);
        this.name = "LevelParseError";
    }
}

/** JSON 列/行 -> 内部网格坐标（原点在棋盘几何中心，y 向上） */
export function toGridCoord(json: JsonCoord, gridSize: number): Coord {
    return { x: json.x - gridSize / 2, y: gridSize / 2 - 1 - json.y };
}

/** 内部网格坐标 -> JSON 列/行，用于错误消息 */
export function toJsonCoord(coord: Coord, gridSize: number): JsonCoord {
    return { x: coord.x + gridSize / 2, y: gridSize / 2 - 1 - coord.y };
}

const LEVEL_KEYS = new Set(["id", "gridSize", "thief", "buildings"]);
const BUILDING_KEYS = new Set(["pieceId", "anchor", "rotation"]);
const ROTATIONS: readonly unknown[] = [0, 90, 180, 270];

function isPlainObject(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isInt(value: unknown): value is number {
    return typeof value === "number" && Number.isInteger(value);
}

function isCoordShape(value: unknown): value is JsonCoord {
    return isPlainObject(value) && isInt(value.x) && isInt(value.y);
}

function formatCoord(c: JsonCoord): string {
    return `(${c.x}, ${c.y})`;
}

function formatValue(value: unknown): string {
    return JSON.stringify(value) ?? String(value);
}

function collectUnknownKeys(
    obj: Record<string, unknown>,
    allowed: ReadonlySet<string>,
    prefix: string,
    errors: string[],
): void {
    for (const key of Object.keys(obj)) {
        if (!allowed.has(key)) errors.push(`${prefix}存在未知字段 "${key}"`);
    }
}

/**
 * 解析并校验关卡 JSON，输出 GameTypes.LevelData。
 * 坐标在这一层从「左上原点列/行」换算为内部网格坐标，调用方拿到的都是内部坐标。
 *
 * 校验失败抛 LevelParseError，errors 一次性列出全部问题。
 */
export function parseLevel(raw: unknown, catalog: PieceCatalog): LevelData {
    if (!isPlainObject(raw)) {
        throw new LevelParseError(["关卡数据必须是 JSON 对象"]);
    }
    const errors: string[] = [];
    collectUnknownKeys(raw, LEVEL_KEYS, "顶层", errors);

    const idOk = typeof raw.id === "string" && raw.id.length > 0;
    if (!idOk) errors.push(`id: 必须是非空字符串，实际是 ${formatValue(raw.id)}`);

    const gridSizeOk = isInt(raw.gridSize) && raw.gridSize >= 2 && raw.gridSize % 2 === 0;
    if (!gridSizeOk) errors.push(`gridSize: 必须是不小于 2 的偶数，实际是 ${formatValue(raw.gridSize)}`);

    const thiefOk = isCoordShape(raw.thief);
    if (!thiefOk) errors.push(`thief: 必须是 { x: 整数, y: 整数 }，实际是 ${formatValue(raw.thief)}`);

    const buildingsOk = Array.isArray(raw.buildings);
    if (!buildingsOk) errors.push(`buildings: 必须是数组，实际是 ${formatValue(raw.buildings)}`);

    // gridSize / thief 不合法时无法继续做棋盘范围判断，先把这些结构问题抛出去
    if (!idOk || !gridSizeOk || !thiefOk || !buildingsOk) {
        throw new LevelParseError(errors);
    }

    const id = raw.id as string;
    const gridSize = raw.gridSize as number;
    const thiefJson = raw.thief as JsonCoord;
    const buildingsRaw = raw.buildings as unknown[];

    // ── 棋盘范围（按 JSON 列/行判断） ──
    const inJsonBoard = (c: JsonCoord): boolean =>
        c.x >= 0 && c.x < gridSize && c.y >= 0 && c.y < gridSize;

    if (!inJsonBoard(thiefJson)) {
        errors.push(`thief: ${formatCoord(thiefJson)} 超出棋盘范围 0..${gridSize - 1}`);
    }

    // ── 逐个建筑做结构校验，记下通过的项供几何校验使用 ──
    type UsableBuilding = Readonly<{
        index: number;
        pieceId: string;
        anchor: JsonCoord;
        rotation: Rotation;
        cells: Coord[];
    }>;
    const usable: UsableBuilding[] = [];

    buildingsRaw.forEach((entry, index) => {
        const at = `buildings[${index}]`;
        if (!isPlainObject(entry)) {
            errors.push(`${at}: 必须是对象`);
            return;
        }
        collectUnknownKeys(entry, BUILDING_KEYS, at, errors);

        if (typeof entry.pieceId !== "string") {
            errors.push(`${at}.pieceId: 必须是字符串，实际是 ${formatValue(entry.pieceId)}`);
            return;
        }
        const pieceId = entry.pieceId as string;
        const piece = catalog[pieceId];
        if (!piece) {
            errors.push(`${at}.pieceId: 棋子目录中不存在 "${pieceId}"`);
            return;
        }
        if (piece.type !== PieceType.Building) {
            errors.push(`${at}.pieceId: "${pieceId}" 不是建筑棋子`);
            return;
        }

        if (!isCoordShape(entry.anchor)) {
            errors.push(`${at}.anchor: 必须是 { x: 整数, y: 整数 }，实际是 ${formatValue(entry.anchor)}`);
            return;
        }
        const anchor = entry.anchor as JsonCoord;
        if (!inJsonBoard(anchor)) {
            errors.push(`${at}.anchor: ${formatCoord(anchor)} 超出棋盘范围 0..${gridSize - 1}`);
            return;
        }

        if (!ROTATIONS.includes(entry.rotation)) {
            errors.push(`${at}.rotation: 必须是 0/90/180/270，实际是 ${formatValue(entry.rotation)}`);
            return;
        }
        const rotation = entry.rotation as Rotation;

        usable.push({
            index,
            pieceId,
            anchor,
            rotation,
            cells: toAbsoluteCells(pieceCells(piece, rotation), toGridCoord(anchor, gridSize)),
        });
    });

    // ── 几何校验（Task 2 补全） ──

    if (errors.length > 0) throw new LevelParseError(errors);

    return {
        id,
        gridSize,
        thief: toGridCoord(thiefJson, gridSize),
        buildings: usable.map(
            (b): BuildingPlacement => ({
                pieceId: b.pieceId,
                anchor: toGridCoord(b.anchor, gridSize),
                rotation: b.rotation,
            }),
        ),
    };
}
