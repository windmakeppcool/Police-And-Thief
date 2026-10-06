import { describe, expect, it } from "vitest";
import { buildOccupancy } from "../../assets/GScript/game2/rules/BoardOccupancy";
import { canPlace, isInBoard } from "../../assets/GScript/game2/rules/PlacementValidator";
import { isThiefCaptured, starRating, thiefExits } from "../../assets/GScript/game2/rules/WinCondition";
import type { Coord } from "../../assets/GScript/game2/common/GameTypes";

const THIEF: Coord = { x: 1, y: 1 };
const GRID = 6;

describe("PlacementValidator", () => {
    it("checks board bounds", () => {
        expect(isInBoard(GRID, { x: -3, y: 2 })).toBe(true);
        expect(isInBoard(GRID, { x: 3, y: 0 })).toBe(false);
        expect(isInBoard(GRID, { x: 0, y: 3 })).toBe(false);
    });

    it("accepts a free placement", () => {
        expect(canPlace({
            gridSize: GRID,
            thief: THIEF,
            occupancy: new Map(),
            cells: [{ x: -1, y: -1 }, { x: 0, y: -1 }],
        })).toBe(true);
    });

    it("rejects out-of-board, thief cell and occupied cells", () => {
        const occupancy = buildOccupancy([{ owner: 'other', cells: [{ x: 0, y: 0 }] }]);

        expect(canPlace({ gridSize: GRID, thief: THIEF, occupancy: new Map(), cells: [{ x: 3, y: 0 }] })).toBe(false);
        expect(canPlace({ gridSize: GRID, thief: THIEF, occupancy: new Map(), cells: [THIEF] })).toBe(false);
        expect(canPlace({ gridSize: GRID, thief: THIEF, occupancy, cells: [{ x: 0, y: 0 }] })).toBe(false);
    });

    it("rejects self-overlapping shapes", () => {
        expect(canPlace({
            gridSize: GRID,
            thief: THIEF,
            occupancy: new Map(),
            cells: [{ x: 0, y: 0 }, { x: 0, y: 0 }],
        })).toBe(false);
    });

    it("ignores the moving piece's own occupancy", () => {
        const occupancy = buildOccupancy([{ owner: 'Police-1', cells: [{ x: 0, y: 0 }] }]);
        expect(canPlace({
            gridSize: GRID,
            thief: THIEF,
            occupancy,
            cells: [{ x: 0, y: 0 }],
            ignoreOwner: 'Police-1',
        })).toBe(true);
    });
});

describe("WinCondition", () => {
    it("lists the thief exits inside the board", () => {
        expect(thiefExits(GRID, THIEF)).toEqual([
            { x: 2, y: 1 },
            { x: 0, y: 1 },
            { x: 1, y: 2 },
            { x: 1, y: 0 },
        ]);
    });

    it("drops exits outside the board", () => {
        expect(thiefExits(GRID, { x: -3, y: 2 })).toEqual([
            { x: -2, y: 2 },
            { x: -3, y: 1 },
        ]);
    });

    it("captures only when every exit is occupied", () => {
        const partial = buildOccupancy([{ owner: 'a', cells: [{ x: 2, y: 1 }, { x: 0, y: 1 }, { x: 1, y: 2 }] }]);
        const full = buildOccupancy([{ owner: 'a', cells: [{ x: 2, y: 1 }, { x: 0, y: 1 }, { x: 1, y: 2 }, { x: 1, y: 0 }] }]);
        expect(isThiefCaptured(GRID, THIEF, partial)).toBe(false);
        expect(isThiefCaptured(GRID, THIEF, full)).toBe(true);
    });

    it("rates stars by used squads", () => {
        expect(starRating(3)).toBe(3);
        expect(starRating(4)).toBe(3);
        expect(starRating(5)).toBe(2);
        expect(starRating(6)).toBe(1);
    });
});
