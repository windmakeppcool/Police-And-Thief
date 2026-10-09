# 关卡 JSON 配置器 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把关卡数据从 TypeScript 硬编码搬到 JSON 文件，支持多关卡配置（建筑摆放位置/旋转角度 + 小偷位置），运行时加载并静态校验，选关 UI 打通到具体关卡。

**Architecture:** 纯解析层 `game/level/LevelParser.ts` 负责「JSON 列/行坐标 → 内部网格坐标」的换算与全部校验，输出就是 `GameTypes.LevelData`，因此 `GameSession` / `PlacementValidator` / `WinCondition` 一行不改。Cocos 侧只有一层薄薄的 `game/LevelRepository.ts` 从 `GameBN` 读 `JsonAsset` 再交给解析器。关卡 id 由纯模块 `game/level/LevelSelection.ts` 在菜单与对局之间传递。

**Tech Stack:** Cocos Creator 3.8.8、TypeScript 5.9、Vitest 1.6（Node 环境）、Cocos Asset Bundle（`GameBN`）。

**Spec:** 本次需求在规划阶段已与用户逐段确认，未另存独立 spec 文档；设计契约完整写在下方「Global Constraints」与「File Structure」中，执行时以本计划为准。

## Global Constraints

- **语言**：代码注释、错误消息、文档一律中文；标识符用英文。
- **纯逻辑目录不得 `import 'cc'`**：`assets/GScript/game/common/**`、`game/rules/**`、`game/level/**` 都在 `tsconfig.spec.json` 的 include 内，导入 `cc` 会让 `npm run typecheck:logic` 失败。需要 Cocos 能力的代码放 `game/` 根目录（如 `LevelRepository.ts`）。
- **坐标系**：JSON 里用列/行（左上角 `(0,0)`，x 向右、y 向下，范围 `0 .. gridSize-1`）；内部计算用现有网格坐标（原点在棋盘几何中心，y 向上，范围 `-gridSize/2 .. gridSize/2-1`）。**换算只在 `LevelParser` 做一次**，其余代码读到的都是内部坐标。
- **换算公式**：`internalX = jsonX - gridSize/2`，`internalY = gridSize/2 - 1 - jsonY`；逆变换 `jsonX = internalX + gridSize/2`，`jsonY = gridSize/2 - 1 - internalY`。
- **`rotation` 不做换算**：JSON 里的 `90` 就是逻辑里的 `90`（0/90/180/270 四选一）。
- **严格模式**：顶层与 `buildings[]` 里出现未定义字段一律校验失败，用于拦截 `rotationn` 之类的拼写错误。
- **错误一次性收集**：`parseLevel` 收齐全部问题后抛 `LevelParseError`，不 fail-fast。
- **错误消息用 JSON 坐标**（列/行），不用内部坐标，配关的人不必心算换算。
- **运行时拒入**：单关解析失败则 `console.error` 全部错误并拒绝进入该关，不回退、不跳过非法建筑。
- **索引回退例外**：`levels.json` 加载/解析失败时回退为 `['level_01']`，保证游戏不至于完全打不开（这是构建/打包层面的故障，与关卡内容错误不同）。
- **可解性靠测试**：运行时不做「开局是否被围死」「是否可解」检查，由 `tests/game2/LevelJson.test.ts` 扫盘断言。
- **每次提交**结尾附：`Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>`

## File Structure

| 文件 | 动作 | 职责 |
|---|---|---|
| `assets/GScript/game/level/LevelParser.ts` | 新建 | JSON → `LevelData` 解析、坐标换算、结构+几何校验、`parseLevelIndex`。纯函数，无 `cc`。 |
| `assets/GScript/game/level/LevelSelection.ts` | 新建 | 模块级「当前关卡 id」状态，菜单写、对局读。纯函数，无 `cc`。 |
| `assets/GScript/game/LevelRepository.ts` | 新建 | 从 `GameBN` 加载 `levels/levels` 与 `levels/<id>` 的 `JsonAsset`，调用解析器。可 `import 'cc'`。 |
| `assets/Game/levels/levels.json` | 新建 | 关卡目录：`["level_01","level_02","level_03"]`。 |
| `assets/Game/levels/level_01.json` | 新建 | 现有 `EXAMPLE_LEVEL` 的 JSON 化（行为必须完全一致）。 |
| `assets/Game/levels/level_02.json` | 新建 | 新关卡。 |
| `assets/Game/levels/level_03.json` | 新建 | 新关卡。 |
| `assets/GScript/game/GameController.ts` | 修改 | `onLoad` 不再建 session；`start()` 异步加载关卡，失败则销毁自身返回菜单。 |
| `assets/GScript/game/ui/MenuController.ts` | 修改 | 加载关卡目录、把选中关卡 id 传给对局、`unlocked` 由目录长度驱动。 |
| `assets/GScript/game/level/LevelData.ts` | 删除 | 内容被 JSON 与测试取代（含 `LevelData.ts.meta`）。 |
| `tests/game2/LevelParser.test.ts` | 新建 | 解析器单测。 |
| `tests/game2/LevelJson.test.ts` | 新建 | 扫盘测试：索引一致性 + 每关可解性。 |
| `tests/game2/LevelData.test.ts` | 修改 | 迁移为读 `level_01.json`，保留「最少三步」回归断言。 |
| `CLAUDE.md` | 修改 | 关卡数据位置与新增模块说明。 |

依赖方向：`LevelParser` ← `LevelRepository` ← `GameController` / `MenuController`；`LevelSelection` ← `MenuController` / `GameController`。`game/level` 不依赖任何 Cocos 模块。

---

### Task 1: LevelParser —— 坐标换算与结构校验

**Files:**
- Create: `assets/GScript/game/level/LevelParser.ts`
- Test: `tests/game2/LevelParser.test.ts`

**Interfaces:**
- Consumes: `GameTypes` 的 `Coord` / `LevelData` / `PieceCatalog` / `PieceType` / `Rotation` / `BuildingPlacement`
- Produces（后续任务依赖的确切签名）:
  - `class LevelParseError extends Error { readonly errors: readonly string[] }`
  - `function toGridCoord(json: JsonCoord, gridSize: number): Coord`
  - `function toJsonCoord(coord: Coord, gridSize: number): JsonCoord`
  - `function parseLevel(raw: unknown, catalog: PieceCatalog): LevelData`
  - `type JsonCoord = Readonly<{ x: number; y: number }>`

- [ ] **Step 1: 写失败测试**

创建 `tests/game2/LevelParser.test.ts`：

```ts
import { describe, expect, it } from "vitest";
import { PieceType, type PieceCatalog } from "../../assets/GScript/game/common/GameTypes";
import {
    LevelParseError,
    parseLevel,
    toGridCoord,
    toJsonCoord,
} from "../../assets/GScript/game/level/LevelParser";

/** 只放一个 L 形建筑和一个警察，够跑结构/几何用例 */
const CATALOG: PieceCatalog = {
    "Structure-001": {
        id: "Structure-001",
        type: PieceType.Building,
        cells: [
            { name: "white-00", coord: { x: 0, y: 2 } },
            { name: "white-01", coord: { x: 0, y: 1 } },
            { name: "white-02", coord: { x: 0, y: 0 } },
            { name: "white-03", coord: { x: 1, y: 0 } },
        ],
        origin: 2,
        rotation: 0,
    },
    "PoliceUI-002": {
        id: "PoliceUI-002",
        type: PieceType.Police,
        cells: [
            { name: "white-00", coord: { x: 0, y: 1 } },
            { name: "white-01", coord: { x: 0, y: 0 } },
            { name: "white-02", coord: { x: 1, y: 0 } },
        ],
        origin: 1,
        rotation: 0,
        policeAt: 1,
    },
};

const baseLevel = () => ({
    id: "level_test",
    gridSize: 6,
    thief: { x: 4, y: 1 },
    buildings: [] as unknown[],
});

/** 断言解析失败并返回收集到的错误列表 */
function parseErrors(raw: unknown): string[] {
    try {
        parseLevel(raw, CATALOG);
    } catch (e) {
        if (e instanceof LevelParseError) return [...e.errors];
        throw e;
    }
    throw new Error("期望抛出 LevelParseError，但解析成功了");
}

describe("坐标换算", () => {
    it("左上原点列/行换算为内部网格坐标", () => {
        // gridSize=6：JSON (0,0) 左上 -> 内部 (-3, 2)；(5,5) 右下 -> 内部 (2, -3)
        expect(toGridCoord({ x: 0, y: 0 }, 6)).toEqual({ x: -3, y: 2 });
        expect(toGridCoord({ x: 5, y: 5 }, 6)).toEqual({ x: 2, y: -3 });
        expect(toGridCoord({ x: 4, y: 1 }, 6)).toEqual({ x: 1, y: 1 });
    });

    it("逆变换回到 JSON 坐标", () => {
        for (const json of [{ x: 0, y: 0 }, { x: 2, y: 5 }, { x: 4, y: 1 }, { x: 3, y: 3 }]) {
            expect(toJsonCoord(toGridCoord(json, 6), 6)).toEqual(json);
        }
    });
});

describe("结构校验", () => {
    it("合法关卡解析为 LevelData，坐标已换算", () => {
        const level = parseLevel(baseLevel(), CATALOG);
        expect(level).toEqual({
            id: "level_test",
            gridSize: 6,
            thief: { x: 1, y: 1 },
            buildings: [],
        });
    });

    it("建筑 anchor 换算为内部坐标且保留 rotation", () => {
        const level = parseLevel(
            { ...baseLevel(), buildings: [{ pieceId: "Structure-001", anchor: { x: 1, y: 1 }, rotation: 180 }] },
            CATALOG,
        );
        expect(level.buildings).toEqual([
            { pieceId: "Structure-001", anchor: { x: -2, y: 1 }, rotation: 180 },
        ]);
    });

    it("顶层未知字段报错", () => {
        const errors = parseErrors({ ...baseLevel(), gridSizee: 6 });
        expect(errors.some(e => e.includes('"gridSizee"'))).toBe(true);
    });

    it("buildings 内未知字段报错", () => {
        const errors = parseErrors({
            ...baseLevel(),
            buildings: [{ pieceId: "Structure-001", anchor: { x: 1, y: 1 }, rotation: 0, note: "x" }],
        });
        expect(errors.some(e => e.includes('buildings[0]') && e.includes('"note"'))).toBe(true);
    });

    it("id 必须是非空字符串", () => {
        expect(parseErrors({ ...baseLevel(), id: "" }).length).toBeGreaterThan(0);
        expect(parseErrors({ ...baseLevel(), id: 42 }).length).toBeGreaterThan(0);
    });

    it("gridSize 必须是不小于 2 的偶数", () => {
        expect(parseErrors({ ...baseLevel(), gridSize: 5 }).length).toBeGreaterThan(0);
        expect(parseErrors({ ...baseLevel(), gridSize: 0 }).length).toBeGreaterThan(0);
        expect(parseErrors({ ...baseLevel(), gridSize: 6.5 }).length).toBeGreaterThan(0);
    });

    it("thief 必须是整数坐标对象", () => {
        expect(parseErrors({ ...baseLevel(), thief: { x: 1.5, y: 1 } }).length).toBeGreaterThan(0);
        expect(parseErrors({ ...baseLevel(), thief: null }).length).toBeGreaterThan(0);
    });

    it("buildings 必须是数组", () => {
        expect(parseErrors({ ...baseLevel(), buildings: {} }).length).toBeGreaterThan(0);
    });

    it("pieceId 必须存在于目录且是建筑棋子", () => {
        const missing = parseErrors({
            ...baseLevel(),
            buildings: [{ pieceId: "Structure-999", anchor: { x: 1, y: 1 }, rotation: 0 }],
        });
        expect(missing.some(e => e.includes("buildings[0].pieceId"))).toBe(true);

        const notBuilding = parseErrors({
            ...baseLevel(),
            buildings: [{ pieceId: "PoliceUI-002", anchor: { x: 1, y: 1 }, rotation: 0 }],
        });
        expect(notBuilding.some(e => e.includes("不是建筑棋子"))).toBe(true);
    });

    it("rotation 只接受 0/90/180/270", () => {
        const errors = parseErrors({
            ...baseLevel(),
            buildings: [{ pieceId: "Structure-001", anchor: { x: 1, y: 1 }, rotation: 45 }],
        });
        expect(errors.some(e => e.includes("buildings[0].rotation") && e.includes("45"))).toBe(true);
    });

    it("anchor 必须是棋盘内的整数坐标", () => {
        const errors = parseErrors({
            ...baseLevel(),
            buildings: [{ pieceId: "Structure-001", anchor: { x: 9, y: 1 }, rotation: 0 }],
        });
        expect(errors.some(e => e.includes("buildings[0].anchor") && e.includes("(9, 1)"))).toBe(true);
    });

    it("一次收集全部错误，不 fail-fast", () => {
        const errors = parseErrors({
            ...baseLevel(),
            buildings: [
                { pieceId: "Structure-999", anchor: { x: 1, y: 1 }, rotation: 0 },
                { pieceId: "Structure-001", anchor: { x: 1, y: 1 }, rotation: 45 },
            ],
        });
        expect(errors.length).toBeGreaterThanOrEqual(2);
    });

    it("错误消息里的坐标是 JSON 列/行，不是内部坐标", () => {
        const errors = parseErrors({
            ...baseLevel(),
            buildings: [{ pieceId: "Structure-001", anchor: { x: 9, y: 1 }, rotation: 0 }],
        });
        expect(errors.some(e => e.includes("(9, 1)"))).toBe(true);
        expect(errors.some(e => e.includes("(6, 0)"))).toBe(false);
    });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run tests/game2/LevelParser.test.ts`
Expected: FAIL，模块 `../../assets/GScript/game/level/LevelParser` 不存在（Cannot find module）。

- [ ] **Step 3: 写 `LevelParser.ts` 结构校验部分**

创建 `assets/GScript/game/level/LevelParser.ts`：

```ts
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
```

- [ ] **Step 4: 跑测试确认通过**

Run: `npx vitest run tests/game2/LevelParser.test.ts`
Expected: PASS（全部用例）

- [ ] **Step 5: 类型检查**

Run: `npm run typecheck:logic`
Expected: 无错误输出。若报 `cc` 相关错误，说明误把 Cocos 依赖带进了 `game/level`。

- [ ] **Step 6: 提交**

```bash
git add assets/GScript/game/level/LevelParser.ts tests/game2/LevelParser.test.ts
git commit -m "feat(level): 新增关卡 JSON 解析器的坐标换算与结构校验

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: LevelParser —— 几何校验与关卡目录解析

**Files:**
- Modify: `assets/GScript/game/level/LevelParser.ts`（补全几何校验段 + 新增 `parseLevelIndex`）
- Test: `tests/game2/LevelParser.test.ts`（追加用例）

**Interfaces:**
- Consumes: Task 1 的 `parseLevel` / `LevelParseError` / `JsonCoord`
- Produces:
  - `function parseLevel(raw: unknown, catalog: PieceCatalog): LevelData`（本任务后几何校验生效）
  - `function parseLevelIndex(raw: unknown): string[]`

- [ ] **Step 1: 追加失败测试**

在 `tests/game2/LevelParser.test.ts` 末尾追加（顶部的 import 同时补上 `parseLevelIndex`，见下方说明）：

```ts
describe("几何校验", () => {
    /** Structure-001 在 rotation=0 时占 (0,2)(0,1)(0,0)(1,0)，origin 是 (0,0) */
    it("建筑展开后的格子越界报错", () => {
        // anchor JSON (5,0) -> 内部 (2,2)：L 形向上两格会越出 y=2
        const errors = parseErrors({
            ...baseLevel(),
            buildings: [{ pieceId: "Structure-001", anchor: { x: 5, y: 0 }, rotation: 0 }],
        });
        expect(errors.some(e => e.includes("buildings[0]") && e.includes("超出棋盘范围"))).toBe(true);
    });

    it("建筑压住小偷报错", () => {
        // 小偷 JSON (4,1) -> 内部 (1,1)；anchor JSON (4,1) -> 内部 (1,1) 与小偷同格
        const errors = parseErrors({
            ...baseLevel(),
            buildings: [{ pieceId: "Structure-001", anchor: { x: 4, y: 1 }, rotation: 0 }],
        });
        expect(errors.some(e => e.includes("buildings[0]") && e.includes("小偷"))).toBe(true);
    });

    it("建筑互相重叠报错，并指出与哪一个重叠", () => {
        const errors = parseErrors({
            ...baseLevel(),
            buildings: [
                { pieceId: "Structure-001", anchor: { x: 1, y: 1 }, rotation: 0 },
                { pieceId: "Structure-001", anchor: { x: 1, y: 1 }, rotation: 90 },
            ],
        });
        expect(errors.some(e => e.includes("buildings[1]") && e.includes("buildings[0]"))).toBe(true);
    });

    it("两个同形建筑拼在一起时逐格比对出重叠", () => {
        const errors = parseErrors({
            ...baseLevel(),
            buildings: [
                { pieceId: "Structure-001", anchor: { x: 1, y: 1 }, rotation: 0 },
                { pieceId: "Structure-001", anchor: { x: 2, y: 1 }, rotation: 0 },
            ],
        });
        expect(errors.some(e => e.includes("重叠"))).toBe(true);
    });

    it("完全合法的建筑摆放通过校验", () => {
        // anchor (1,2) -> 内部 (-2,0)：L 形占 (-2,2)(-2,1)(-2,0)(-1,0)
        // anchor (4,3) -> 内部 (1,-1)：L 形转 180° 占 (1,-3)(1,-2)(1,-1)(0,-1)
        const level = parseLevel({
            ...baseLevel(),
            buildings: [
                { pieceId: "Structure-001", anchor: { x: 1, y: 2 }, rotation: 0 },
                { pieceId: "Structure-001", anchor: { x: 4, y: 3 }, rotation: 180 },
            ],
        }, CATALOG);
        expect(level.buildings).toHaveLength(2);
    });
});

describe("关卡目录解析", () => {
    it("返回 id 数组", () => {
        expect(parseLevelIndex(["level_01", "level_02"])).toEqual(["level_01", "level_02"]);
    });

    it("不是数组时报错", () => {
        expect(() => parseLevelIndex({})).toThrow(LevelParseError);
    });

    it("非字符串或空字符串报错", () => {
        try {
            parseLevelIndex(["level_01", "", 3]);
            throw new Error("期望抛出 LevelParseError");
        } catch (e) {
            expect(e).toBeInstanceOf(LevelParseError);
            expect((e as LevelParseError).errors.length).toBeGreaterThanOrEqual(2);
        }
    });

    it("重复 id 报错", () => {
        try {
            parseLevelIndex(["level_01", "level_01"]);
            throw new Error("期望抛出 LevelParseError");
        } catch (e) {
            expect((e as LevelParseError).errors.some(msg => msg.includes("重复"))).toBe(true);
        }
    });
});
```

同时把文件顶部的 `LevelParseError` import 补上 `parseLevelIndex`：

```ts
import {
    LevelParseError,
    parseLevel,
    parseLevelIndex,
    toGridCoord,
    toJsonCoord,
} from "../../assets/GScript/game/level/LevelParser";
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run tests/game2/LevelParser.test.ts`
Expected: FAIL，几何校验用例与 `parseLevelIndex` 相关用例失败（`parseLevelIndex` 未导出 / 解析对非法摆放返回成功）。

- [ ] **Step 3: 补全几何校验并新增 `parseLevelIndex`**

先在 `LevelParser.ts` 顶部补两个 import（Task 1 刻意没引，那时还没有用到）：

```ts
import { coordKey } from "../rules/BoardOccupancy";
import { isInBoard } from "../rules/PlacementValidator";
```

然后把 `// ── 几何校验（Task 2 补全） ──` 注释替换为：

```ts
    // ── 几何校验：越界 / 压小偷 / 互相重叠 ──
    const thief = toGridCoord(thiefJson, gridSize);
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
            if (cell.x === thief.x && cell.y === thief.y) {
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
```

在文件末尾追加：

```ts
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
    if (errors.length > 0) throw new LevelParseError(errors);
    return ids;
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `npx vitest run tests/game2/LevelParser.test.ts`
Expected: PASS

- [ ] **Step 5: 全量测试与类型检查**

Run: `npm test && npm run typecheck:logic`
Expected: 全绿，无类型错误

- [ ] **Step 6: 提交**

```bash
git add assets/GScript/game/level/LevelParser.ts tests/game2/LevelParser.test.ts
git commit -m "feat(level): 关卡解析器补齐几何校验与关卡目录解析

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: LevelSelection —— 关卡 id 的传递状态

**Files:**
- Create: `assets/GScript/game/level/LevelSelection.ts`
- Test: `tests/game2/LevelSelection.test.ts`

**Interfaces:**
- Consumes: 无
- Produces:
  - `const DEFAULT_LEVEL_ID: string`（值为 `"level_01"`）
  - `function selectLevel(levelId: string): void`
  - `function currentLevelId(): string`
  - `function resetLevelSelection(): void`

- [ ] **Step 1: 写失败测试**

创建 `tests/game2/LevelSelection.test.ts`：

```ts
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
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run tests/game2/LevelSelection.test.ts`
Expected: FAIL，`LevelSelection` 模块不存在（Cannot find module）

- [ ] **Step 3: 实现 `LevelSelection.ts`**

创建 `assets/GScript/game/level/LevelSelection.ts`：

```ts
/** 默认关卡：菜单没选过时从这里开始 */
export const DEFAULT_LEVEL_ID = "level_01";

let selectedLevelId: string = DEFAULT_LEVEL_ID;

/**
 * 菜单选关后调用；GameController 启动时读取。
 * 用模块级状态是因为 UIManager.open 只接受组件类、无法传参，
 * 而组件的 onLoad 在 open 返回前就已执行。
 */
export function selectLevel(levelId: string): void {
    if (typeof levelId !== "string" || levelId.length === 0) {
        throw new Error("[LevelSelection] levelId 必须是非空字符串");
    }
    selectedLevelId = levelId;
}

/** 当前选中的关卡 id */
export function currentLevelId(): string {
    return selectedLevelId;
}

/** 仅测试用：恢复默认关卡 */
export function resetLevelSelection(): void {
    selectedLevelId = DEFAULT_LEVEL_ID;
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `npx vitest run tests/game2/LevelSelection.test.ts`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add assets/GScript/game/level/LevelSelection.ts tests/game2/LevelSelection.test.ts
git commit -m "feat(level): 新增关卡选择状态模块

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: 关卡 JSON 资料与扫盘测试

**Files:**
- Create: `assets/Game/levels/levels.json`
- Create: `assets/Game/levels/level_01.json`
- Create: `assets/Game/levels/level_02.json`
- Create: `assets/Game/levels/level_03.json`
- Test: `tests/game2/LevelJson.test.ts`

**Interfaces:**
- Consumes: `parseLevel` / `parseLevelIndex`（Task 1、2）、`minMovesToCapture` / `enumeratePlacements`（`tests/game2/helpers/levelSolver.ts` 已存在）
- Produces: `assets/Game/levels/` 下的关卡资料；`LevelJson.test.ts` 作为关卡资料的常驻回归

- [ ] **Step 1: 写扫盘测试**

创建 `tests/game2/LevelJson.test.ts`：

```ts
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { PieceType, type PieceCatalog } from "../../assets/GScript/game/common/GameTypes";
import { coordKey } from "../../assets/GScript/game/rules/BoardOccupancy";
import { pieceCells, toAbsoluteCells } from "../../assets/GScript/game/rules/PieceGeometry";
import { isThiefCaptured } from "../../assets/GScript/game/rules/WinCondition";
import { BoardPieces } from "../../assets/GScript/game/piece/pieces";
import { parseLevel, parseLevelIndex } from "../../assets/GScript/game/level/LevelParser";
import { enumeratePlacements, minMovesToCapture } from "./helpers/levelSolver";

const LEVELS_DIR = fileURLToPath(new URL("../../assets/Game/levels/", import.meta.url));

const readJson = (name: string): unknown =>
    JSON.parse(readFileSync(join(LEVELS_DIR, name), "utf8"));

/**
 * 只用警察棋子求解：建筑是固定路障，不能算作玩家可落的子，
 * 否则「可解」会被建筑棋子的落点误判为成立。
 */
const POLICE_ONLY: PieceCatalog = Object.fromEntries(
    Object.entries(BoardPieces).filter(([, piece]) => piece.type === PieceType.Police),
);

/** 三星线：步数 ≤4 即三星，关卡至少要在这条线内可解 */
const SOLVE_LIMIT = 4;

describe("关卡 JSON 资料", () => {
    const levelFiles = readdirSync(LEVELS_DIR)
        .filter(name => /^level_.*\.json$/.test(name))
        .sort();

    it("levels.json 与磁盘上的关卡文件一一对应", () => {
        const index = parseLevelIndex(readJson("levels.json"));
        expect(index.map(id => `${id}.json`).sort()).toEqual(levelFiles);
    });

    it("每关都能通过结构与几何校验，且文件名与内部 id 一致", () => {
        const index = parseLevelIndex(readJson("levels.json"));
        expect(index.length).toBeGreaterThan(0);
        for (const levelId of index) {
            const level = parseLevel(readJson(`${levelId}.json`), BoardPieces);
            expect(level.id).toBe(levelId);
        }
    });

    it("每关开局小偷尚未被围死，且在三星线内可解", () => {
        const index = parseLevelIndex(readJson("levels.json"));
        for (const levelId of index) {
            const level = parseLevel(readJson(`${levelId}.json`), BoardPieces);
            const blocked = level.buildings.flatMap(b =>
                toAbsoluteCells(pieceCells(BoardPieces[b.pieceId], b.rotation), b.anchor),
            );

            const occupancy = new Map<string, string>();
            blocked.forEach(cell => occupancy.set(coordKey(cell), "building"));
            expect(isThiefCaptured(level.gridSize, level.thief, occupancy)).toBe(false);

            const solverPieces = enumeratePlacements(POLICE_ONLY, level.gridSize, level.thief);
            const min = minMovesToCapture(solverPieces, level.gridSize, level.thief, blocked, SOLVE_LIMIT);
            expect(min, `${levelId} 在 ${SOLVE_LIMIT} 步内应可解`).not.toBeNull();
            expect(min as number).toBeGreaterThanOrEqual(1);
        }
    });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run tests/game2/LevelJson.test.ts`
Expected: FAIL，`assets/Game/levels/` 目录不存在（ENOENT）

- [ ] **Step 3: 写关卡资料**

创建 `assets/Game/levels/levels.json`：

```json
[
    "level_01",
    "level_02",
    "level_03"
]
```

创建 `assets/Game/levels/level_01.json`（内容必须与现有 `EXAMPLE_LEVEL` 解析结果完全一致）：

```json
{
    "id": "level_01",
    "gridSize": 6,
    "thief": { "x": 4, "y": 1 },
    "buildings": [
        { "pieceId": "Structure-001", "anchor": { "x": 1, "y": 1 }, "rotation": 180 },
        { "pieceId": "Structure-002", "anchor": { "x": 3, "y": 4 }, "rotation": 0 },
        { "pieceId": "Structure-003", "anchor": { "x": 2, "y": 0 }, "rotation": 90 },
        { "pieceId": "Structure-004", "anchor": { "x": 2, "y": 5 }, "rotation": 0 }
    ]
}
```

创建 `assets/Game/levels/level_02.json`：

```json
{
    "id": "level_02",
    "gridSize": 6,
    "thief": { "x": 2, "y": 2 },
    "buildings": [
        { "pieceId": "Structure-004", "anchor": { "x": 3, "y": 2 }, "rotation": 0 },
        { "pieceId": "Structure-003", "anchor": { "x": 1, "y": 2 }, "rotation": 0 }
    ]
}
```

创建 `assets/Game/levels/level_03.json`：

```json
{
    "id": "level_03",
    "gridSize": 6,
    "thief": { "x": 3, "y": 3 },
    "buildings": [
        { "pieceId": "Structure-003", "anchor": { "x": 4, "y": 3 }, "rotation": 0 },
        { "pieceId": "Structure-004", "anchor": { "x": 1, "y": 3 }, "rotation": 0 },
        { "pieceId": "Structure-001", "anchor": { "x": 5, "y": 1 }, "rotation": 180 },
        { "pieceId": "Structure-002", "anchor": { "x": 2, "y": 0 }, "rotation": 180 }
    ]
}
```

这三关的已知属性（供排查时对照，测试只断言「可解」不断言具体步数）：

| 关卡 | 小偷内部坐标 | 空闲去路 | 最少步数（警察求解） |
|---|---|---|---|
| level_01 | `(1, 1)` | 4 | 3 |
| level_02 | `(-1, 0)` | 2 | 2 |
| level_03 | `(0, -1)` | 2 | 2 |

- [ ] **Step 4: 跑测试确认通过**

Run: `npx vitest run tests/game2/LevelJson.test.ts`
Expected: PASS

- [ ] **Step 5: 让 Cocos Creator 生成 `.meta`**

用 Cocos Creator 3.8.8 打开项目根目录，等资源导入完成。期望 `assets/Game/levels/` 下每个文件旁出现同名 `.meta`（如 `level_01.json.meta`）。

若本机没有 Cocos Creator：跳过本步。`npm test` 与 `npm run typecheck:logic` 都不依赖 `.meta`（测试用 `node:fs` 直接读磁盘），但**运行时必须有 `.meta` 才能被 Cocos 导入为 `JsonAsset`**，请在提交说明里注明待补。

- [ ] **Step 6: 提交**

```bash
git add assets/Game/levels tests/game2/LevelJson.test.ts
git commit -m "feat(level): 新增关卡 JSON 资料与扫盘校验测试

level_01 与原 EXAMPLE_LEVEL 解析结果一致；level_02/03 为新关卡。
测试断言索引与文件一一对应、每关开局未围死小偷且四步内可解。

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: LevelRepository —— Cocos 侧关卡加载

**Files:**
- Create: `assets/GScript/game/LevelRepository.ts`

**Interfaces:**
- Consumes: `parseLevel` / `parseLevelIndex` / `LevelParseError`（Task 1、2）、`ResConst.BL`、`ResManager.loadAssetAsync`、`BoardPieces`
- Produces:
  - `function loadLevelIndex(): Promise<string[]>`
  - `function loadLevel(levelId: string): Promise<LevelData | null>`

本任务没有单元测试：`LevelRepository` 依赖 Cocos 的 `JsonAsset` 与全局 `gCtrl`，`typecheck:logic` 的 include 不覆盖它（这是有意的）。它的正确性由 Task 4 的解析器测试 + Task 6/7 的接入覆盖；本任务的验收是类型检查通过且接口签名与 Task 6/7 一致。

- [ ] **Step 1: 实现 `LevelRepository.ts`**

创建 `assets/GScript/game/LevelRepository.ts`：

```ts
import { JsonAsset } from 'cc';
import { BL } from '../core/res/ResConst';
import type { LevelData } from './common/GameTypes';
import { LevelParseError, parseLevel, parseLevelIndex } from './level/LevelParser';
import { BoardPieces } from './piece/pieces';

/** 关卡目录在 GameBN 里的地址：assets/Game/levels/levels.json */
const LEVEL_INDEX_URL = BL('levels/levels', 'GameBN');

/** 单关 JSON 的地址：assets/Game/levels/<levelId>.json */
const levelUrl = (levelId: string) => BL(`levels/${levelId}`, 'GameBN');

function report(e: unknown, fallback: string): void {
    if (e instanceof LevelParseError) console.error(e.message);
    else console.error(`${fallback}: ${e}`);
}

/**
 * 读关卡目录（levels.json），返回按可选关顺序排列的关卡 id。
 * 加载或解析失败时回退为 ['level_01']：索引缺失属于打包故障，
 * 回退比让游戏完全打不开更合适（单关内容错误仍然是拒入）。
 */
export async function loadLevelIndex(): Promise<string[]> {
    const asset = await gCtrl.res.loadAssetAsync(LEVEL_INDEX_URL, JsonAsset);
    if (!asset) {
        console.error('[LevelRepository] 加载 levels.json 失败，回退为单关 level_01');
        return ['level_01'];
    }
    try {
        return parseLevelIndex(asset.json);
    } catch (e) {
        report(e, '[LevelRepository] 关卡目录解析异常');
        return ['level_01'];
    }
}

/**
 * 读单关关卡数据。解析失败返回 null，由调用方拒绝进入该关。
 */
export async function loadLevel(levelId: string): Promise<LevelData | null> {
    const asset = await gCtrl.res.loadAssetAsync(levelUrl(levelId), JsonAsset);
    if (!asset) {
        console.error(`[LevelRepository] 加载关卡 ${levelId} 失败`);
        return null;
    }
    try {
        return parseLevel(asset.json, BoardPieces);
    } catch (e) {
        report(e, `[LevelRepository] 关卡 ${levelId} 解析异常`);
        return null;
    }
}
```

- [ ] **Step 2: 类型检查**

Run: `npm run typecheck:logic`
Expected: 无错误（`LevelRepository.ts` 不在该配置的 include 内，不应报错）

Run: `npm run typecheck:cocos`
Expected: 无错误。若报 `Cannot find module 'temp/tsconfig.cocos.json'`，说明需要先用 Cocos Creator 打开项目生成该文件；先完成 Task 4 Step 5 再重试。

- [ ] **Step 3: 全量测试**

Run: `npm test`
Expected: 全绿（本任务不改行为）

- [ ] **Step 4: 提交**

```bash
git add assets/GScript/game/LevelRepository.ts
git commit -m "feat(level): 新增 GameBN 关卡资源加载器

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: GameController 接入关卡加载

**Files:**
- Modify: `assets/GScript/game/GameController.ts:7`（import 行）
- Modify: `assets/GScript/game/GameController.ts:52-56`（`onLoad` / `start` 开头）

**Interfaces:**
- Consumes: `loadLevel`（Task 5）、`currentLevelId`（Task 3）
- Produces: `GameController` 启动时按 `currentLevelId()` 装载关卡；`session` 的构造从 `onLoad` 移到 `start()`

- [ ] **Step 1: 改 import**

把 `assets/GScript/game/GameController.ts` 顶部的：

```ts
import { EXAMPLE_LEVEL } from './level/LevelData';
```

替换为：

```ts
import { currentLevelId } from './level/LevelSelection';
import { loadLevel } from './LevelRepository';
```

- [ ] **Step 2: 改 `onLoad` 与 `start` 开头**

把：

```ts
    protected onLoad(): void {
        const transform = this.node.getComponent(UITransform) ?? this.node.addComponent(UITransform);
        transform.setContentSize(G_VIEW_SIZE.width, G_VIEW_SIZE.height);
        this.session = new GameSession(EXAMPLE_LEVEL, BoardPieces);
    }

    protected async start(): Promise<void> {
        this.layout = computeLayout();
```

替换为：

```ts
    protected onLoad(): void {
        const transform = this.node.getComponent(UITransform) ?? this.node.addComponent(UITransform);
        transform.setContentSize(G_VIEW_SIZE.width, G_VIEW_SIZE.height);
    }

    protected async start(): Promise<void> {
        // 关卡是 JSON 资源，必须异步加载；onLoad 里还拿不到
        const levelId = currentLevelId();
        const level = await loadLevel(levelId);
        if (!level) {
            console.error(`[GameController] 关卡 ${levelId} 校验失败，拒绝进入该关`);
            // 菜单层仍在下方，销毁对局节点即可回到关卡选择
            this.node.destroy();
            return;
        }
        this.session = new GameSession(level, BoardPieces);

        this.layout = computeLayout();
```

`buildStructures`、`buildPolice`、拖拽与胜负流程**不要动**——`session` 的接口没变。

- [ ] **Step 3: 类型检查与全量测试**

Run: `npm run typecheck:logic && npm test`
Expected: 全绿。`GameController.ts` 不在 `typecheck:logic` 的 include 内，但它 import 的 `LevelSelection` / `LevelRepository` 都要能解析。

Run: `npm run typecheck:cocos`
Expected: 无错误（需要 `temp/tsconfig.cocos.json` 存在）

- [ ] **Step 4: 自查 `EXAMPLE_LEVEL` 是否还有引用**

Run: `rg -n "EXAMPLE_LEVEL" --type ts assets tests`
Expected: 只剩 `tests/game2/LevelData.test.ts` 一处（Task 8 会收编）

- [ ] **Step 5: 提交**

```bash
git add assets/GScript/game/GameController.ts
git commit -m "feat(game): GameController 改为从 JSON 关卡加载并拒入非法关卡

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: MenuController 选关接入

**Files:**
- Modify: `assets/GScript/game/ui/MenuController.ts:4-11`（import）
- Modify: `assets/GScript/game/ui/MenuController.ts:28-32`（字段）
- Modify: `assets/GScript/game/ui/MenuController.ts:46-63`（`start`）
- Modify: `assets/GScript/game/ui/MenuController.ts:77-96`（`showHome` / `openMenu`）
- Modify: `assets/GScript/game/ui/MenuController.ts:101-113`（`openLevels`）
- Modify: `assets/GScript/game/ui/MenuController.ts:128-150`（`openProfile`）

**Interfaces:**
- Consumes: `loadLevelIndex`（Task 5）、`selectLevel` / `currentLevelId`（Task 3）
- Produces: `LevelsView.onPick(level: number)` 把第 N 格映射到 `levels.json[N-1]`；`unlocked` 由目录长度驱动

- [ ] **Step 1: 改 import 与字段**

在 `assets/GScript/game/ui/MenuController.ts` 顶部 import 区追加：

```ts
import { currentLevelId, selectLevel } from '../level/LevelSelection';
import { loadLevelIndex } from '../LevelRepository';
```

把字段区的：

```ts
    private bootElapsed = 0;
```

前面插入：

```ts
    /** 关卡目录（levels.json），顺序即关卡选择页的第几格 */
    private levelIds: string[] = [];
```

- [ ] **Step 2: `start()` 里加载关卡目录**

在 `this.frames = await loadDesignFrames();` 之后插入：

```ts
        this.levelIds = await loadLevelIndex();
```

- [ ] **Step 3: 新增 `openLevel` 辅助方法**

在 `openLevels()` 方法之前插入：

```ts
    /** 打开指定关卡的对局；没有可用关卡时只报错，不跳转 */
    private openLevel(levelId: string | undefined): void {
        if (!levelId) {
            console.error('[MenuController] 没有可用关卡');
            return;
        }
        selectLevel(levelId);
        void gCtrl.ui.open(GameController);
    }
```

- [ ] **Step 4: 改各处跳转与 `unlocked`**

`showHome()` 里：

```ts
        this.home = new MenuHomeView(this.stage, this.m, this.frames, 128, this.levelIds.length, {
            onStart: () => this.openLevel(this.levelIds[0]),
            onLevels: () => this.openLevels(),
            onNavMenu: () => this.openMenu(),
            onNavSettings: () => this.openSettings(),
            onNavProfile: () => this.openProfile(),
        });
```

`openMenu()` 里同样把 `new MenuHomeView(this.stage, this.m, this.frames, 128, 8, {` 改为 `...(128, this.levelIds.length, {`，`onStart` 改为 `() => this.openLevel(this.levelIds[0])`。

`openLevels()` 里：

```ts
        this.levels = new LevelsView(this.stage, this.m, this.frames, 128, this.levelIds.length, {
            onBack: () => this.openMenu(),
            // 「继续巡逻」沿用当前选中的关卡，不改选择
            onContinue: () => { void gCtrl.ui.open(GameController); },
            onPick: (level: number) => this.openLevel(this.levelIds[level - 1]),
        });
```

`openProfile()` 里的 `onPlay: () => { void gCtrl.ui.open(GameController); }` **保持不变**——「再来一局」重玩 `currentLevelId()`，本来就不该改选择。

- [ ] **Step 5: 类型检查与全量测试**

Run: `npm run typecheck:logic && npm test`
Expected: 全绿

Run: `npm run typecheck:cocos`
Expected: 无错误

- [ ] **Step 6: 提交**

```bash
git add assets/GScript/game/ui/MenuController.ts
git commit -m "feat(menu): 关卡选择打通到具体关卡 JSON

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 8: 清理旧关卡数据、收编测试、更新文档

**Files:**
- Delete: `assets/GScript/game/level/LevelData.ts`
- Delete: `assets/GScript/game/level/LevelData.ts.meta`
- Modify: `tests/game2/LevelData.test.ts`
- Modify: `CLAUDE.md`

**Interfaces:**
- Consumes: `parseLevel`（Task 1）、`assets/Game/levels/level_01.json`（Task 4）
- Produces: 仓库内不再有硬编码关卡数据；`LevelData.test.ts` 变成 level_01 的难度回归

- [ ] **Step 1: 改写 `LevelData.test.ts` 读 JSON**

把 `tests/game2/LevelData.test.ts` 整体替换为：

```ts
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { type Coord, type Rotation } from "../../assets/GScript/game/common/GameTypes";
import { GameSession } from "../../assets/GScript/game/common/GameSession";
import { coordKey } from "../../assets/GScript/game/rules/BoardOccupancy";
import { pieceCells, toAbsoluteCells } from "../../assets/GScript/game/rules/PieceGeometry";
import { thiefExits } from "../../assets/GScript/game/rules/WinCondition";
import { BoardPieces } from "../../assets/GScript/game/piece/pieces";
import { parseLevel } from "../../assets/GScript/game/level/LevelParser";
import { enumeratePlacements, minMovesToCapture } from "./helpers/levelSolver";

const LEVEL_PATH = fileURLToPath(
    new URL("../../assets/Game/levels/level_01.json", import.meta.url),
);

/** 参考解：3 步围住小偷（三星）。坐标是内部网格坐标，描述的是求解落点而非关卡 JSON */
const LEVEL_01_SOLUTION: ReadonlyArray<{ pieceId: string; anchor: Coord; rotation: Rotation }> = [
    { pieceId: "PoliceUI-002", anchor: { x: 1, y: -1 }, rotation: 0 },
    { pieceId: "PoliceUI-004", anchor: { x: 2, y: 2 }, rotation: 180 },
    { pieceId: "PoliceUI-006", anchor: { x: -1, y: 1 }, rotation: 180 },
];

const level = parseLevel(JSON.parse(readFileSync(LEVEL_PATH, "utf8")), BoardPieces);

describe("关卡数据 level_01", () => {
    const { gridSize, thief, buildings } = level;

    it("基础配置为 6×6 棋盘，小偷在 (1,1)", () => {
        expect(gridSize).toBe(6);
        expect(thief).toEqual({ x: 1, y: 1 });
    });

    it("建筑都在棋盘内、互不重叠且不压住小偷", () => {
        const seen = new Set<string>();
        for (const building of buildings) {
            const piece = BoardPieces[building.pieceId];
            expect(piece).toBeDefined();
            const cells = toAbsoluteCells(pieceCells(piece, building.rotation), building.anchor);
            for (const cell of cells) {
                expect(cell.x).toBeGreaterThanOrEqual(-gridSize / 2);
                expect(cell.x).toBeLessThan(gridSize / 2);
                expect(cell.y).toBeGreaterThanOrEqual(-gridSize / 2);
                expect(cell.y).toBeLessThan(gridSize / 2);
                expect(cell).not.toEqual(thief);
                expect(seen.has(coordKey(cell))).toBe(false);
                seen.add(coordKey(cell));
            }
        }
    });

    it("开局时小偷四周仍然可通行（不能一上来就赢）", () => {
        const blocked = new Set<string>();
        for (const building of buildings) {
            const piece = BoardPieces[building.pieceId];
            toAbsoluteCells(pieceCells(piece, building.rotation), building.anchor)
                .forEach(cell => blocked.add(coordKey(cell)));
        }
        expect(thiefExits(gridSize, thief).every(exit => !blocked.has(coordKey(exit)))).toBe(true);
    });

    it("最少三步才能围住小偷（三星需要最优解）", () => {
        const blocked = buildings.flatMap(building => {
            const piece = BoardPieces[building.pieceId];
            return toAbsoluteCells(pieceCells(piece, building.rotation), building.anchor);
        });
        const solverPieces = enumeratePlacements(BoardPieces, gridSize, thief);

        expect(minMovesToCapture(solverPieces, gridSize, thief, blocked, 2)).toBeNull();
        expect(minMovesToCapture(solverPieces, gridSize, thief, blocked, 3)).toBe(3);
    });

    it("参考解三步落子后真的围住小偷", () => {
        const session = new GameSession(level, BoardPieces);
        for (const step of LEVEL_01_SOLUTION) {
            expect(
                session.place(step.pieceId, step.anchor, step.rotation),
                `${step.pieceId} 落在 (${step.anchor.x}, ${step.anchor.y}) 应当合法`,
            ).toBe(true);
        }
        expect(session.moveCount).toBe(3);
        expect(session.captured).toBe(true);
    });
});
```

`LEVEL_01_SOLUTION` 的坐标是**内部网格坐标**（与原 `EXAMPLE_SOLUTION` 相同），因为它描述的是求解落点而不是关卡 JSON。

- [ ] **Step 2: 跑测试确认通过**

Run: `npx vitest run tests/game2/LevelData.test.ts`
Expected: PASS（「最少三步」的断言必须仍然成立，这是 level_01 迁移无损的证据）

- [ ] **Step 3: 删除 `LevelData.ts`**

先确认没有别处引用：

Run: `rg -n "from ['\"].*level/LevelData|EXAMPLE_LEVEL|EXAMPLE_SOLUTION" --type ts assets tests`
Expected: 无输出

然后删除：

```bash
git rm assets/GScript/game/level/LevelData.ts assets/GScript/game/level/LevelData.ts.meta
```

- [ ] **Step 4: 全量验证**

Run: `npm test && npm run typecheck:logic`
Expected: 全绿

Run: `npm run typecheck:cocos`
Expected: 无错误

- [ ] **Step 5: 更新 `CLAUDE.md`**

在「Cocos Asset Bundle 划分」里把 `assets/Game` 那条：

```
- `assets/Game`：bundle 名为 `GameBN`，包含游戏预制体与拆分后的设计稿图片素材（关卡数据在代码中的 `game/level/LevelData.ts`）。
```

替换为：

```
- `assets/Game`：bundle 名为 `GameBN`，包含游戏预制体、拆分后的设计稿图片素材，以及关卡 JSON 资料（`levels/`：`levels.json` 索引 + 每关一个 `level_XX.json`）。
```

在「game 架构」的纯逻辑层列表里，把：

```
- `game/level/LevelData.ts`：示例关卡（`EXAMPLE_LEVEL`）与参考解（`EXAMPLE_SOLUTION`）。关卡中的 `buildings` 会在开局自动摆放为路障。
```

替换为：

```
- `game/level/LevelParser.ts`：关卡 JSON 解析与校验。JSON 用左上原点列/行坐标（0..gridSize-1），在这里一次换算为内部网格坐标；严格模式拦截未知字段，校验错误一次性收集并按 JSON 坐标报告。
- `game/level/LevelSelection.ts`：菜单与对局之间传递「当前关卡 id」的模块级状态（`UIManager.open` 不支持传参）。
```

在「game 架构」的表现层列表里，`game/GameController.ts` 条目后追加一行：

```
- `game/LevelRepository.ts`：从 `GameBN` 加载 `levels/levels` 与 `levels/<id>` 的 `JsonAsset` 并交给 `LevelParser`。放在 `game/` 根目录而非 `game/level/`，因为后者被 `tsconfig.spec.json` 覆盖、不能 `import 'cc'`。
```

在「玩法规则」第一条：

```
- 6×6 棋盘，坐标范围 -3..2，小偷固定在关卡配置的格子；建筑由关卡数据自动摆放，玩家不能移动。
```

后面追加一条：

```
- 关卡从 `assets/Game/levels/level_XX.json` 读取：可配置小偷位置与建筑摆放（`anchor` + `rotation`）。JSON 坐标是左上原点列/行（x 向右、y 向下），运行时换算为内部坐标；加载时只做静态校验，非法关卡拒入并打印全部错误。可解性由 `tests/game2/LevelJson.test.ts` 扫盘断言。
```

在「编辑注意事项」里把：

```
- 调整关卡时同步检查 `tests/game2/LevelData.test.ts`：它会校验建筑合法性、开局不会被一步围死，并用求解器断言“最少三步”。
```

替换为：

```
- 调整关卡 JSON 后跑 `npm test`：`tests/game2/LevelJson.test.ts` 会扫盘校验 `levels.json` 与关卡文件一一对应、每关结构合法、开局不会被围死且四步内可解；`tests/game2/LevelData.test.ts` 另外断言 level_01 最少三步。
```

- [ ] **Step 6: 提交**

```bash
git add -A
git commit -m "refactor(level): 关卡数据改由 JSON 配置，移除硬编码 LevelData

EXAMPLE_LEVEL 迁入 assets/Game/levels/level_01.json，参考解移入测试。
更新 CLAUDE.md 说明新的关卡配置方式与坐标约定。

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## 完成判据

- [ ] `npm test` 全绿，其中 `LevelJson.test.ts` 覆盖 3 关的结构与可解性
- [ ] `npm run typecheck:logic` 无错误
- [ ] `npm run typecheck:cocos` 无错误（需 `temp/tsconfig.cocos.json`）
- [ ] `rg -n "EXAMPLE_LEVEL|EXAMPLE_SOLUTION" --type ts assets tests` 无输出
- [ ] `rg -n "from 'cc'" assets/GScript/game/level` 无输出（纯逻辑层未被污染）
- [ ] 选关页点第 1/2/3 格，进入的分别是 level_01/02/03（需在 Cocos Creator 里跑一遍确认 `.meta` 已生成）

## 已知留白（不在本次范围）

- 关卡进度/解锁持久化：`unlocked` 现在等于 `levels.json` 长度，没有存档。
- 参考步数字段（如 `expectedMinMoves`）：YAGNI，需要时再加。
- 24 格选关 UI 的第 4~24 格：`levels.json` 只有 3 关，超出的格子点不动（`unlocked` 已限制）。
