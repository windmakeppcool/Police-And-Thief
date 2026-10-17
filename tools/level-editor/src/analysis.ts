import { PieceType, type Coord, type LevelData } from "../../../assets/GScript/game/common/GameTypes";
import { BoardPieces } from "../../../assets/GScript/game/piece/pieces";
import { buildOccupancy, coordKey } from "../../../assets/GScript/game/rules/BoardOccupancy";
import { pieceCells, toAbsoluteCells } from "../../../assets/GScript/game/rules/PieceGeometry";
import { isThiefCaptured } from "../../../assets/GScript/game/rules/WinCondition";
import { LevelParseError, parseLevel } from "../../../assets/GScript/game/level/LevelParser";
import {
    SOLVER_NODE_BUDGET,
    enumeratePlacements,
    findFullSquadSolutionDetailed,
    type PlacedPiece,
} from "../../../tests/game2/helpers/levelSolver";
import { ID_PATTERN, listOf, placementCells, toRawLevel, type Doc, type PlacementKind } from "./doc";

/** 只用警察棋子求解：建筑和预置警察都是固定路障，不能算作玩家可落的子 */
function deployablePoliceCatalog(level: LevelData) {
    const preset = new Set(level.police.map(p => p.pieceId));
    return Object.fromEntries(
        Object.entries(BoardPieces).filter(
            ([id, piece]) => piece.type === PieceType.Police && !preset.has(id),
        ),
    );
}

export type SolveReport = {
    status: "solved" | "unsat" | "unknown";
    nodes: number;
    solution: readonly PlacedPiece[] | null;
};

export type Report = {
    errors: string[];
    level: LevelData | null;
    /** 开局小偷是否已被建筑/预置警察围死 */
    captured: boolean;
    solve: SolveReport | null;
    /** 阻止保存的原因，空数组表示可以保存 */
    blockers: string[];
};

/**
 * 用游戏自己的校验器 + 求解器体检当前关卡。
 * 判定口径与 tests/game2/LevelJson.test.ts 一致，所以「能保存」就等于「能过测试」。
 */
export function analyze(doc: Doc): Report {
    const errors: string[] = [];
    let level: LevelData | null = null;

    if (!ID_PATTERN.test(doc.id)) {
        errors.push(`id: 关卡 id 只能包含字母、数字、下划线、连字符，实际是 "${doc.id}"`);
    }

    try {
        level = parseLevel(toRawLevel(doc), BoardPieces);
    } catch (e) {
        if (e instanceof LevelParseError) errors.push(...e.errors);
        else errors.push(String(e));
    }

    if (level === null) {
        return { errors, level: null, captured: false, solve: null, blockers: ["关卡结构校验未通过"] };
    }

    // 固定路障：建筑 + 预置警察（预置的开局就在棋盘上，玩家不能移动）
    const blocked = [
        ...level.buildings.map(p => ({ pieceId: p.pieceId, anchor: p.anchor, rotation: p.rotation })),
        ...level.police.map(p => ({ pieceId: p.pieceId, anchor: p.anchor, rotation: p.rotation })),
    ].flatMap(p => toAbsoluteCells(pieceCells(BoardPieces[p.pieceId], p.rotation), p.anchor));

    const captured = isThiefCaptured(level.gridSize, level.thief, buildOccupancy([
        { owner: "blocked", cells: blocked },
    ]));

    const solve: SolveReport = captured
        ? { status: "unsat", nodes: 0, solution: null }
        : (() => {
              const pieces = enumeratePlacements(deployablePoliceCatalog(level), level.gridSize, level.thief);
              const result = findFullSquadSolutionDetailed(pieces, level.gridSize, level.thief, blocked);
              return { status: result.status, nodes: result.nodes, solution: result.solution };
          })();

    const blockers: string[] = [];
    if (errors.length > 0) blockers.push(`关卡结构校验未通过（${errors.length} 处）`);
    if (captured) blockers.push("开局小偷就已被建筑或预置警察围死，游戏一进去就结束了");
    else if (solve.status === "unsat") {
        blockers.push("无解：预置棋子就位后，其余警察全部上场也围不住小偷");
    } else if (solve.status === "unknown") {
        blockers.push(`求解预算不足（访问 ${solve.nodes} 个节点），无法判定是否可解`);
    } else if (solve.nodes > SOLVER_NODE_BUDGET * 0.5) {
        blockers.push(`求解访问 ${solve.nodes} 个节点，超过预算 ${SOLVER_NODE_BUDGET} 的一半，关卡过重（测试会判失败）`);
    }

    return { errors, level, captured, solve, blockers };
}

/** 参考解在棋盘上的占格，供叠加显示（只含玩家要补放的棋子，预置的已在棋盘上） */
export type SolutionPiece = {
    pieceId: string;
    cells: Coord[];
    /** 警察站位格（无则取 origin cell） */
    police: Coord;
};

export function solutionOverlay(solution: readonly PlacedPiece[]): SolutionPiece[] {
    return solution.map(step => {
        const piece = BoardPieces[step.pieceId];
        const cells = toAbsoluteCells(pieceCells(piece, step.rotation), step.anchor);
        const policeIndex = piece.policeAt ?? piece.origin;
        return { pieceId: step.pieceId, cells, police: cells[policeIndex] ?? cells[0] };
    });
}

/** 棋盘占用索引：内部格子键 -> 它属于哪条预置物（建筑/预置警察） */
export type CellOwner = { kind: PlacementKind; index: number };

export function placementIndex(doc: Doc): Map<string, CellOwner> {
    const index = new Map<string, CellOwner>();
    (["buildings", "police"] as const).forEach(kind => {
        listOf(doc, kind).forEach((placement, i) => {
            for (const cell of placementCells(placement, doc.gridSize)) {
                index.set(coordKey(cell), { kind, index: i });
            }
        });
    });
    return index;
}
