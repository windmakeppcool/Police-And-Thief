import { describe, expect, it } from "vitest";
import { PieceType } from "../../assets/GScript/game2/common/GameTypes";
import { nextRotation, pieceCells, rotateCell, rotateCells, stepsOf, toAbsoluteCells } from "../../assets/GScript/game2/rules/PieceGeometry";

const ORIGIN = { x: 0, y: 0 };

describe("PieceGeometry", () => {
    it("rotates a cell around the origin", () => {
        expect(rotateCell({ x: 1, y: 0 }, ORIGIN)).toEqual({ x: 0, y: 1 });
        expect(rotateCell({ x: 0, y: 1 }, ORIGIN)).toEqual({ x: -1, y: 0 });
        expect(rotateCell({ x: 1, y: 0 }, ORIGIN, 2)).toEqual({ x: -1, y: 0 });
        expect(rotateCell({ x: 1, y: 0 }, ORIGIN, 4)).toEqual({ x: 1, y: 0 });
    });

    it("keeps the origin cell fixed", () => {
        const origin = { x: 2, y: -1 };
        expect(rotateCell(origin, origin, 3)).toEqual(origin);
    });

    it("supports negative steps", () => {
        expect(rotateCell({ x: 1, y: 0 }, ORIGIN, -1)).toEqual({ x: 0, y: -1 });
        expect(rotateCells([{ x: 1, y: 0 }], ORIGIN, -1)).toEqual([{ x: 0, y: -1 }]);
    });

    it("maps rotation degrees to steps", () => {
        expect(stepsOf(0)).toBe(0);
        expect(stepsOf(90)).toBe(1);
        expect(stepsOf(180)).toBe(2);
        expect(stepsOf(270)).toBe(3);
    });

    it("advances rotation clockwise", () => {
        expect(nextRotation(0)).toBe(90);
        expect(nextRotation(90)).toBe(180);
        expect(nextRotation(180)).toBe(270);
        expect(nextRotation(270)).toBe(0);
    });

    it("computes rotated piece cells and absolute positions", () => {
        const piece = {
            id: "T",
            type: PieceType.Police,
            cells: [
                { name: "white-00", coord: { x: 0, y: 1 } },
                { name: "white-01", coord: { x: 0, y: 0 } },
                { name: "white-02", coord: { x: -1, y: 0 } },
                { name: "white-03", coord: { x: 1, y: 0 } },
            ],
            origin: 1,
            rotation: 0 as const,
        };

        expect(pieceCells(piece, 90)).toEqual([
            { x: -1, y: 0 },
            { x: 0, y: 0 },
            { x: 0, y: -1 },
            { x: 0, y: 1 },
        ]);

        expect(toAbsoluteCells(pieceCells(piece, 90), { x: 2, y: 1 })).toEqual([
            { x: 1, y: 1 },
            { x: 2, y: 1 },
            { x: 2, y: 0 },
            { x: 2, y: 2 },
        ]);
    });
});
