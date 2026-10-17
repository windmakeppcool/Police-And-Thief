import { type Coord, type Rotation } from "../../../assets/GScript/game/common/GameTypes";
import { BoardPieces } from "../../../assets/GScript/game/piece/pieces";
import { buildOccupancy } from "../../../assets/GScript/game/rules/BoardOccupancy";
import { pieceCells, toAbsoluteCells } from "../../../assets/GScript/game/rules/PieceGeometry";
import { canPlace, isInBoard } from "../../../assets/GScript/game/rules/PlacementValidator";
import { toGridCoord, toJsonCoord, type JsonCoord } from "../../../assets/GScript/game/level/LevelParser";

/** 关卡 id 同时是保存的文件名，白名单与 server/levelsApi.ts 一致 */
export const ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

/** 关卡里的两类预置物：buildings=建筑路障，police=开局锁定的预置警察 */
export type PlacementKind = "buildings" | "police";

export type Placement = { pieceId: string; anchor: JsonCoord; rotation: Rotation };

/**
 * 编辑器里唯一的一份关卡状态。
 * 坐标全程是 JSON 的左上原点列/行（与磁盘上的文件同构），导出即所见。
 */
export type Doc = {
    id: string;
    gridSize: number;
    thief: JsonCoord | null;
    buildings: Placement[];
    police: Placement[];
};

export type PlacementRef = { kind: PlacementKind; index: number };

/** 失踪小偷时的占位坐标：放在棋盘外，让它永远不会和任何格子冲突 */
const NO_THIEF: JsonCoord = { x: -999, y: -999 };

export function emptyDoc(id: string, gridSize = 6): Doc {
    return { id, gridSize, thief: null, buildings: [], police: [] };
}

export const listOf = (doc: Doc, kind: PlacementKind): Placement[] =>
    kind === "buildings" ? doc.buildings : doc.police;

/** 预置物占用的内部网格坐标（走游戏自己的旋转/平移实现） */
export function placementCells(placement: Placement, gridSize: number): Coord[] {
    const piece = BoardPieces[placement.pieceId];
    return toAbsoluteCells(pieceCells(piece, placement.rotation), toGridCoord(placement.anchor, gridSize));
}

/** 预置物占用的 JSON 列/行坐标 */
export function placementJsonCells(placement: Placement, gridSize: number): JsonCoord[] {
    return placementCells(placement, gridSize).map(cell => toJsonCoord(cell, gridSize));
}

const ownerKey = (kind: PlacementKind, index: number): string => `${kind[0]}${index}`;

/**
 * 棋盘占用表：格子键 -> 占用者。
 * ignore 指定的那条预置物不参与冲突判断（用于移动/旋转它自己）。
 */
export function occupancyOf(doc: Doc, ignore?: PlacementRef): ReadonlyMap<string, string> {
    const entries: { owner: string; cells: Coord[] }[] = [];
    (["buildings", "police"] as const).forEach(kind => {
        listOf(doc, kind).forEach((placement, index) => {
            if (ignore && ignore.kind === kind && ignore.index === index) return;
            entries.push({ owner: ownerKey(kind, index), cells: placementCells(placement, doc.gridSize) });
        });
    });
    return buildOccupancy(entries);
}

export type CanPlaceOptions = { doc: Doc; kind: PlacementKind; pieceId: string; anchor: JsonCoord; rotation: Rotation; ignore?: PlacementRef };

/** 某条预置物能否放在 anchor：判定复用游戏的 canPlace */
export function canPlaceAt(options: CanPlaceOptions): boolean {
    const { doc, kind, pieceId, anchor, rotation, ignore } = options;
    return canPlace({
        gridSize: doc.gridSize,
        thief: toGridCoord(doc.thief ?? NO_THIEF, doc.gridSize),
        occupancy: occupancyOf(doc, ignore),
        cells: placementCells({ pieceId, anchor, rotation }, doc.gridSize),
    });
}

/** canPlace 为 false 时给一句人话原因；判定仍以 canPlace 为准，这里只负责解释 */
export function describeFailure(options: CanPlaceOptions): string {
    const { doc, kind, pieceId, anchor, rotation, ignore } = options;
    const cells = placementCells({ pieceId, anchor, rotation }, doc.gridSize);
    const thief = doc.thief === null ? null : toGridCoord(doc.thief, doc.gridSize);
    const occupied = occupancyOf(doc, ignore);
    const seen = new Set<string>();
    for (const cell of cells) {
        const at = toJsonCoord(cell, doc.gridSize);
        const where = `(${at.x}, ${at.y})`;
        if (!isInBoard(doc.gridSize, cell)) return `格子 ${where} 超出棋盘范围`;
        if (thief !== null && cell.x === thief.x && cell.y === thief.y) return `格子 ${where} 压住了小偷`;
        const key = `${cell.x},${cell.y}`;
        if (seen.has(key)) return `棋子自身重复占用格子 ${where}`;
        seen.add(key);
        const owner = occupied.get(key);
        if (owner !== undefined) {
            const label = kind === "police" ? "预置警察" : "建筑";
            return `格子 ${where} 已被${label} ${ownerLabel(owner)} 占用`;
        }
    }
    return "落点不合法";
}

/** 占用者在棋盘上的显示名：b0 -> A，p2 -> P3（1 起，便于和警察棋子编号对上） */
export function ownerLabel(owner: string): string {
    if (owner.startsWith("b")) return String.fromCharCode(65 + Number(owner.slice(1)));
    if (owner.startsWith("p")) return `P${Number(owner.slice(1)) + 1}`;
    return owner;
}

/** 建筑在棋盘上的字母标签（A、B、C……） */
export function buildingLabel(index: number): string {
    return index < 26 ? String.fromCharCode(65 + index) : `#${index + 1}`;
}

export type EditResult = { ok: true; doc: Doc } | { ok: false; reason: string };

export function withThief(doc: Doc, thief: JsonCoord): Doc {
    return { ...doc, thief: { x: thief.x, y: thief.y } };
}

export function withGridSize(doc: Doc, gridSize: number): Doc {
    // 换棋盘尺寸后原有关卡内容一律作废，避免留下越界坐标
    return { ...emptyDoc(doc.id, gridSize) };
}

/** 某类预置物里是否已使用指定棋子（每枚棋子只能放置一次） */
export function findPlacementIndex(doc: Doc, kind: PlacementKind, pieceId: string): number {
    return listOf(doc, kind).findIndex(p => p.pieceId === pieceId);
}

function withList(doc: Doc, kind: PlacementKind, list: Placement[]): Doc {
    return kind === "buildings" ? { ...doc, buildings: list } : { ...doc, police: list };
}

export function withPlacementAdded(
    doc: Doc,
    kind: PlacementKind,
    pieceId: string,
    anchor: JsonCoord,
    rotation: Rotation,
): EditResult {
    if (findPlacementIndex(doc, kind, pieceId) >= 0) {
        const label = kind === "police" ? "预置警察" : "建筑";
        return { ok: false, reason: `${label} ${pieceId} 已经放置过，每枚棋子只能使用一次` };
    }
    const options = { doc, kind, pieceId, anchor, rotation };
    if (!canPlaceAt(options)) return { ok: false, reason: describeFailure(options) };
    return { ok: true, doc: withList(doc, kind, [...listOf(doc, kind), { pieceId, anchor, rotation }]) };
}

export function withPlacementMoved(doc: Doc, kind: PlacementKind, index: number, anchor: JsonCoord): EditResult {
    const list = listOf(doc, kind);
    const placement = list[index];
    if (!placement) return { ok: false, reason: "没有选中的棋子" };
    const options = { doc, kind, pieceId: placement.pieceId, anchor, rotation: placement.rotation, ignore: { kind, index } };
    if (!canPlaceAt(options)) return { ok: false, reason: describeFailure(options) };
    const next = list.slice();
    next[index] = { ...placement, anchor };
    return { ok: true, doc: withList(doc, kind, next) };
}

export function withPlacementRotated(doc: Doc, kind: PlacementKind, index: number, rotation: Rotation): EditResult {
    const list = listOf(doc, kind);
    const placement = list[index];
    if (!placement) return { ok: false, reason: "没有选中的棋子" };
    const options = { doc, kind, pieceId: placement.pieceId, anchor: placement.anchor, rotation, ignore: { kind, index } };
    if (!canPlaceAt(options)) {
        return { ok: false, reason: `旋转到 ${rotation}° 后 ${describeFailure(options)}` };
    }
    const next = list.slice();
    next[index] = { ...placement, rotation };
    return { ok: true, doc: withList(doc, kind, next) };
}

export function withPlacementRemoved(doc: Doc, kind: PlacementKind, index: number): Doc {
    return withList(doc, kind, listOf(doc, kind).filter((_, i) => i !== index));
}

/** 导出用的原始对象；小偷未放置时该字段缺失，交给 LevelParser 报错；police 为空时省略该字段 */
export function toRawLevel(doc: Doc): Record<string, unknown> {
    const raw: Record<string, unknown> = {
        id: doc.id,
        gridSize: doc.gridSize,
        thief: doc.thief === null ? undefined : { x: doc.thief.x, y: doc.thief.y },
        buildings: doc.buildings.map(p => ({
            pieceId: p.pieceId,
            anchor: { x: p.anchor.x, y: p.anchor.y },
            rotation: p.rotation,
        })),
    };
    if (doc.police.length > 0) {
        raw.police = doc.police.map(p => ({
            pieceId: p.pieceId,
            anchor: { x: p.anchor.x, y: p.anchor.y },
            rotation: p.rotation,
        }));
    }
    return raw;
}

/** 把多行展开的坐标对象压成一行，与仓库里 level_XX.json 的既有风格保持一致 */
const COMPACT_COORD = /\{\s*"x":\s*(-?\d+),\s*"y":\s*(-?\d+)\s*\}/g;
/** 把建筑/预置警察条目压成一行（在坐标压缩之后执行） */
const COMPACT_PLACEMENT =
    /\{\s*"pieceId":\s*("[^"]*"),\s*"anchor":\s*(\{ "x": -?\d+, "y": -?\d+ \}),\s*"rotation":\s*(\d+)\s*\}/g;

/** 与磁盘上的关卡文件同格式：4 空格缩进、坐标与棋子条目各占一行、结尾换行 */
export function serializeLevel(doc: Doc): string {
    const text = JSON.stringify(toRawLevel(doc), null, 4)
        .replace(COMPACT_COORD, (_match, x: string, y: string) => `{ "x": ${x}, "y": ${y} }`)
        .replace(COMPACT_PLACEMENT, (_match, id: string, anchor: string, rotation: string) =>
            `{ "pieceId": ${id}, "anchor": ${anchor}, "rotation": ${rotation} }`);
    return `${text}\n`;
}

const isJsonCoord = (value: unknown): value is JsonCoord => {
    const c = value as JsonCoord;
    return typeof c === "object" && c !== null && Number.isInteger(c.x) && Number.isInteger(c.y);
};

const isRotation = (value: unknown): value is Rotation => value === 0 || value === 90 || value === 180 || value === 270;

function readList(raw: Record<string, unknown>, key: PlacementKind): Placement[] {
    if (!Array.isArray(raw[key])) return [];
    const result: Placement[] = [];
    for (const entry of raw[key]) {
        const item = entry as Partial<Placement>;
        if (typeof item.pieceId !== "string") continue;
        if (!isJsonCoord(item.anchor)) continue;
        result.push({
            pieceId: item.pieceId,
            anchor: { x: item.anchor.x, y: item.anchor.y },
            rotation: isRotation(item.rotation) ? item.rotation : 0,
        });
    }
    return result;
}

/** 读已有关卡文件为编辑器状态；结构不对返回 null，交给校验面板报告 */
export function fromRawLevel(raw: unknown, fallbackId: string): Doc | null {
    if (typeof raw !== "object" || raw === null) return null;
    const source = raw as Record<string, unknown>;
    const gridSize = Number.isInteger(source.gridSize) ? (source.gridSize as number) : 6;
    return {
        id: typeof source.id === "string" ? source.id : fallbackId,
        gridSize,
        thief: isJsonCoord(source.thief) ? { x: source.thief.x, y: source.thief.y } : null,
        buildings: readList(source, "buildings"),
        police: readList(source, "police"),
    };
}
