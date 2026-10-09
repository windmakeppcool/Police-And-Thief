import {
    PieceType,
    type BuildingPlacement,
    type Coord,
    type LevelData,
    type Piece,
    type PieceCatalog,
    type Rotation,
} from "../common/GameTypes";
import { pieceCells, toAbsoluteCells } from "../rules/PieceGeometry";
import { coordKey } from "../rules/BoardOccupancy";
import { isInBoard } from "../rules/PlacementValidator";

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
    return (
        isPlainObject(value) &&
        Object.keys(value).every(key => key === "x" || key === "y") &&
        isInt(value.x) &&
        isInt(value.y)
    );
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

/** 每条建筑通过阶段一校验后的结果，供阶段二棋盘范围与几何校验使用 */
type Phase1Entry = Readonly<{
    index: number;
    pieceId?: string;
    piece?: Piece;
    anchor?: JsonCoord;
    rotation?: Rotation;
}>;

/**
 * 解析并校验关卡 JSON，输出 GameTypes.LevelData。
 * 坐标在这一层从「左上原点列/行」换算为内部网格坐标，调用方拿到的都是内部坐标。
 *
 * 校验失败抛 LevelParseError，errors 一次性列出全部问题（不 fail-fast）：
 * 阶段一做纯形状/枚举校验（无论顶层是否合法都收集），阶段二做依赖合法
 * gridSize 与坐标换算的棋盘范围/几何校验，最后合并两阶段错误一次性抛出。
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

    // ── 阶段一：纯形状/枚举校验，与 gridSize、坐标换算无关 ──
    // 无论顶层字段是否合法都跑完并全部收集，让配关的人一次看全所有独立错误
    const phase1: Phase1Entry[] = [];

    if (buildingsOk) {
        (raw.buildings as unknown[]).forEach((entry, index) => {
            const at = `buildings[${index}]`;
            if (!isPlainObject(entry)) {
                errors.push(`${at}: 必须是对象`);
                return;
            }
            collectUnknownKeys(entry, BUILDING_KEYS, at, errors);

            let pieceId: string | undefined;
            let piece: Piece | undefined;
            if (typeof entry.pieceId !== "string") {
                errors.push(`${at}.pieceId: 必须是字符串，实际是 ${formatValue(entry.pieceId)}`);
            } else {
                pieceId = entry.pieceId;
                const found = catalog[pieceId];
                if (!found) {
                    errors.push(`${at}.pieceId: 棋子目录中不存在 "${pieceId}"`);
                } else if (found.type !== PieceType.Building) {
                    errors.push(`${at}.pieceId: "${pieceId}" 不是建筑棋子`);
                } else {
                    piece = found;
                }
            }

            // anchor / rotation 的校验不依赖 pieceId，pieceId 非法时也要收集
            let anchor: JsonCoord | undefined;
            if (!isCoordShape(entry.anchor)) {
                errors.push(`${at}.anchor: 必须是 { x: 整数, y: 整数 }，实际是 ${formatValue(entry.anchor)}`);
            } else {
                anchor = entry.anchor;
            }

            let rotation: Rotation | undefined;
            if (!ROTATIONS.includes(entry.rotation)) {
                errors.push(`${at}.rotation: 必须是 0/90/180/270，实际是 ${formatValue(entry.rotation)}`);
            } else {
                rotation = entry.rotation as Rotation;
            }

            phase1.push({ index, pieceId, piece, anchor, rotation });
        });
    }

    // ── 阶段二：依赖合法 gridSize / 坐标换算的检查（棋盘范围与几何校验） ──
    // toGridCoord 需要合法 gridSize，这类检查不能放进阶段一
    const usable: Array<{
        index: number;
        pieceId: string;
        anchor: JsonCoord;
        rotation: Rotation;
        cells: Coord[];
    }> = [];

    if (gridSizeOk) {
        const gridSize = raw.gridSize as number;
        const inJsonBoard = (c: JsonCoord): boolean =>
            c.x >= 0 && c.x < gridSize && c.y >= 0 && c.y < gridSize;

        if (thiefOk) {
            const thiefJson = raw.thief as JsonCoord;
            if (!inJsonBoard(thiefJson)) {
                errors.push(`thief: ${formatCoord(thiefJson)} 超出棋盘范围 0..${gridSize - 1}`);
            }
        }

        // anchor 棋盘范围只依赖 anchor 形状与 gridSize，与 pieceId 是否合法无关
        for (const e of phase1) {
            if (e.anchor !== undefined && !inJsonBoard(e.anchor)) {
                errors.push(`buildings[${e.index}].anchor: ${formatCoord(e.anchor)} 超出棋盘范围 0..${gridSize - 1}`);
            }
        }

        // 结构完全合法且在棋盘内的建筑，记下 cells 供几何校验使用
        for (const e of phase1) {
            if (e.piece === undefined || e.pieceId === undefined || e.anchor === undefined || e.rotation === undefined) {
                continue;
            }
            if (!inJsonBoard(e.anchor)) continue;
            usable.push({
                index: e.index,
                pieceId: e.pieceId,
                anchor: e.anchor,
                rotation: e.rotation,
                cells: toAbsoluteCells(pieceCells(e.piece, e.rotation), toGridCoord(e.anchor, gridSize)),
            });
        }

        // ── 几何校验：越界 / 压小偷 / 互相重叠 ──
        // thief 形状非法时阶段一已报错，此时跳过「压小偷」这一项比对
        const thief = thiefOk ? toGridCoord(raw.thief as JsonCoord, gridSize) : undefined;
        /** 格子键 -> 先占用它的建筑下标 */
        const occupied = new Map<string, number>();

        for (const item of usable) {
            const at = `buildings[${item.index}]`;
            for (const cell of item.cells) {
                const jsonCell = toJsonCoord(cell, gridSize);
                if (!isInBoard(gridSize, cell)) {
                    errors.push(`${at}: 格子 ${formatCoord(jsonCell)} 超出棋盘范围 0..${gridSize - 1}`);
                    continue;
                }
                if (thief !== undefined && cell.x === thief.x && cell.y === thief.y) {
                    errors.push(`${at}: 格子 ${formatCoord(jsonCell)} 压住了小偷`);
                    continue;
                }
                const key = coordKey(cell);
                const owner = occupied.get(key);
                if (owner !== undefined) {
                    errors.push(`${at}: 与 buildings[${owner}] 重叠于格子 ${formatCoord(jsonCell)}`);
                    continue;
                }
                occupied.set(key, item.index);
            }
        }
    }

    if (errors.length > 0) throw new LevelParseError(errors);

    // 能走到这里说明阶段一全部通过（否则上面已抛出），字段断言安全
    const id = raw.id as string;
    const gridSize = raw.gridSize as number;
    return {
        id,
        gridSize,
        thief: toGridCoord(raw.thief as JsonCoord, gridSize),
        buildings: usable.map(
            (b): BuildingPlacement => ({
                pieceId: b.pieceId,
                anchor: toGridCoord(b.anchor, gridSize),
                rotation: b.rotation,
            }),
        ),
    };
}

/**
 * 解析关卡目录（levels.json）：返回按可选关顺序排列的关卡 id。
 * 校验失败抛 LevelParseError。
 */
export function parseLevelIndex(raw: unknown): string[] {
    if (!Array.isArray(raw)) {
        throw new LevelParseError(["关卡目录必须是字符串数组"]);
    }
    const errors: string[] = [];
    const ids: string[] = [];
    raw.forEach((entry, index) => {
        if (typeof entry !== "string" || entry.length === 0) {
            errors.push(`[${index}]: 必须是非空字符串，实际是 ${formatValue(entry)}`);
            return;
        }
        if (ids.includes(entry)) {
            errors.push(`[${index}]: 关卡 id "${entry}" 重复`);
            return;
        }
        ids.push(entry);
    });
    if (ids.length === 0) {
        errors.push("关卡目录不能是空数组");
    }
    if (errors.length > 0) throw new LevelParseError(errors);
    return ids;
}
