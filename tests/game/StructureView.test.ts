import { describe, expect, it } from "vitest";
import { getAbsoluteCells, rotateCell } from "../../assets/GScript/game/domain/PieceGeometry";
import { PieceType, type Coord, type Rotation, type ShapeCatalog } from "../../assets/GScript/game/domain/GameTypes";

const CELL_SIZE = 64;

const EXAMPLE_SHAPES: ShapeCatalog = {
    building_001: {
        id: "building_001",
        type: PieceType.Building,
        cells: [{ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 0, y: 2 }, { x: 1, y: 0 }]
    }
};

interface Vec3 {
    x: number;
    y: number;
    z: number;
}

function vec3(x: number, y: number, z = 0): Vec3 {
    return { x, y, z };
}

function boardToLocal(coord: Coord, boardWidth: number, boardHeight: number, cellSize: number): Vec3 {
    const left = -((boardWidth - 1) * cellSize) / 2;
    const bottom = -((boardHeight - 1) * cellSize) / 2;
    return vec3(left + coord.x * cellSize, bottom + coord.y * cellSize, 0);
}

function boardLocalToCoord(pos: Vec3, boardWidth: number, boardHeight: number, cellSize: number): Coord {
    const left = -((boardWidth - 1) * cellSize) / 2;
    const bottom = -((boardHeight - 1) * cellSize) / 2;
    return {
        x: Math.round((pos.x - left) / cellSize),
        y: Math.round((pos.y - bottom) / cellSize)
    };
}

interface StructureTestState {
    rotation: Rotation;
    rootToOriginOffset: Vec3;
}

function getRotatedRootToOriginOffset(offset: Vec3, rotation: Rotation): Vec3 {
    const x = offset.x;
    const y = -offset.y;
    switch (rotation) {
        case 0:
            return vec3(x, -y, 0);
        case 90:
            return vec3(-y, -x, 0);
        case 180:
            return vec3(-x, y, 0);
        case 270:
            return vec3(y, x, 0);
    }
}

describe("Structure1UI Snap吸附测试 - Building_001 L形结构", () => {
    const BOARD_WIDTH = 6;
    const BOARD_HEIGHT = 6;

    describe("Shape定义验证", () => {
        it("building_001 是L形结构：包含4个格子", () => {
            const shape = EXAMPLE_SHAPES["building_001"];
            expect(shape.cells.length).toBe(4);
        });

        it("building_001 在rotation=0时的绝对坐标以origin为基准", () => {
            const origin: Coord = { x: 2, y: 2 };
            const piece = {
                id: "test",
                shapeId: "building_001",
                type: PieceType.Building,
                origin,
                rotation: 0 as Rotation
            };

            const cells = getAbsoluteCells(EXAMPLE_SHAPES, piece);

            expect(cells).toEqual([
                { x: 2, y: 2 },
                { x: 2, y: 3 },
                { x: 2, y: 4 },
                { x: 3, y: 2 }
            ]);
        });
    });

    describe("rootToOriginOffset计算 (基于Cocos坐标系)", () => {
        it("StructureUI-001的实际prefab结构确定rootToOriginOffset", () => {
            const prefabChildren = [
                { name: "white-00", pos: vec3(0, 0, 0), size: CELL_SIZE },
                { name: "white-01", pos: vec3(0, -64, 0), size: CELL_SIZE },
                { name: "white-02", pos: vec3(0, -128, 0), size: CELL_SIZE },
                { name: "white-03", pos: vec3(64, -128, 0), size: CELL_SIZE }
            ];

            let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;

            for (const child of prefabChildren) {
                const halfSize = child.size / 2;
                minX = Math.min(minX, child.pos.x - halfSize);
                maxX = Math.max(maxX, child.pos.x + halfSize);
                minY = Math.min(minY, child.pos.y - halfSize);
                maxY = Math.max(maxY, child.pos.y + halfSize);
            }

            console.log(`Bounding box: minX=${minX}, maxX=${maxX}, minY=${minY}, maxY=${maxY}`);
            expect(maxX - minX).toBe(CELL_SIZE * 2);
            expect(maxY - minY).toBe(CELL_SIZE * 3);

            const rootToOriginOffset = vec3(
                minX + CELL_SIZE / 2,
                minY + CELL_SIZE / 2,
                0
            );

            console.log("Calculated rootToOriginOffset:", rootToOriginOffset);
            expect(rootToOriginOffset).toEqual({ x: -32 + 32, y: -160 + 32, z: 0 });
            expect(rootToOriginOffset).toEqual({ x: 0, y: -128, z: 0 });
        });
    });

    describe("旋转后的吸附行为测试", () => {
        const origin: Coord = { x: 2, y: 2 };
        const rootToOriginOffset = vec3(0, -128, 0);

        function testSnapAtRotation(rotation: Rotation, description: string) {
            it(description, () => {
                const rotatedOffset = getRotatedRootToOriginOffset(rootToOriginOffset, rotation);
                const snapBoardPos = boardToLocal(origin, BOARD_WIDTH, BOARD_HEIGHT, CELL_SIZE);
                const finalSnapPos = {
                    x: snapBoardPos.x - rotatedOffset.x,
                    y: snapBoardPos.y - rotatedOffset.y,
                    z: 0
                };

                const shape = EXAMPLE_SHAPES["building_001"];
                const rotatedCells = shape.cells.map(cell => {
                    const rotated = rotateCell(cell, rotation);
                    return { x: origin.x + rotated.x, y: origin.y + rotated.y };
                });

                console.log(`\n=== Rotation ${rotation}° ===`);
                console.log("rotatedOffset:", rotatedOffset);
                console.log("snapBoardPos (origin in board local):", snapBoardPos);
                console.log("finalSnapPos (node position):", finalSnapPos);
                console.log("Expected shape cells after rotation:", rotatedCells);

                expect(rotatedCells.length).toBe(4);
                rotatedCells.forEach((cell, i) => {
                    expect(cell.x).toBeGreaterThanOrEqual(0);
                    expect(cell.x).toBeLessThan(BOARD_WIDTH);
                    expect(cell.y).toBeGreaterThanOrEqual(0);
                    expect(cell.y).toBeLessThan(BOARD_HEIGHT);
                });
            });
        }

        testSnapAtRotation(0, "rotation=0°: 原位放置，L形垂直向上");
        testSnapAtRotation(90, "rotation=90°: L形应水平展开");
        testSnapAtRotation(180, "rotation=180°: L形倒置");
        testSnapAtRotation(270, "rotation=270°: L形反向水平");
    });

    describe("Prefab 结构与 Shape 定义对应关系分析", () => {
        const PREFAB_CELLS = [
            { local: vec3(0, 0, 0), name: "white-00" },
            { local: vec3(0, -64, 0), name: "white-01" },
            { local: vec3(0, -128, 0), name: "white-02" },
            { local: vec3(64, -128, 0), name: "white-03" }
        ];

        it("理解坐标系统差异：Shape用Y+向上，Prefab用Y-向下", () => {
            console.log("\n=== Prefab子节点位置 (Cocos Y轴向下) ===");
            PREFAB_CELLS.forEach(c => {
                console.log(`${c.name}: local(${c.local.x}, ${c.local.y})`);
            });

            console.log("\n=== Shape定义 cells (数学Y轴向上) ===");
            console.log("building_001: [{x:0,y:0}, {x:0,y:1}, {x:0,y:2}, {x:1,y:0}]");

            console.log("\n=== 关键发现 ===");
            console.log("Shape中 cell(0,0)->cell(0,1): Y增加（向上）");
            console.log("Prefab中 white-00->white-01: Y减少（向下）");
            console.log("→ 这两个结构是镜像对称的！需要适配。");
        });

        it("计算正确的rootToOriginOffset：如果white-00对应当前origin", () => {
            const CELL_SIZE = 64;

            let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
            for (const child of PREFAB_CELLS) {
                const halfSize = CELL_SIZE / 2;
                minX = Math.min(minX, child.local.x - halfSize);
                maxX = Math.max(maxX, child.local.x + halfSize);
                minY = Math.min(minY, child.local.y - halfSize);
                maxY = Math.max(maxY, child.local.y + halfSize);
            }

            console.log(`Bounding box: [${minX}, ${maxX}] x [${minY}, ${maxY}]`);

            const rootToOriginOffset = vec3(
                minX + CELL_SIZE / 2,
                minY + CELL_SIZE / 2,
                0
            );

            console.log(`_rootToOriginOffset 计算值: (${rootToOriginOffset.x}, ${rootToOriginOffset.y})`);
            console.log(`此值基于实际代码: _rootToOriginOffset.set(minX + 32, minY + 32)`);

            expect(rootToOriginOffset).toEqual({ x: 0, y: -128, z: 0 });
        });
    });

    describe("吸附逻辑验证：模拟不同旋转角度的放置", () => {
        const BOARD_WIDTH = 6;
        const BOARD_HEIGHT = 6;
        const CELL_SIZE = 64;

        function simulatePlacement(targetOrigin: Coord, rotation: Rotation) {
            const _rootToOriginOffset = vec3(0, -128, 0);

            const rotated = getRotatedRootToOriginOffset(_rootToOriginOffset, rotation);

            const snapBoardPos = boardToLocal(targetOrigin, BOARD_WIDTH, BOARD_HEIGHT, CELL_SIZE);
            const finalNodePos = vec3(
                snapBoardPos.x - rotated.x,
                snapBoardPos.y - rotated.y,
                0
            );

            const piece = {
                id: "test",
                shapeId: "building_001",
                type: PieceType.Building,
                origin: targetOrigin,
                rotation
            };
            const expectedCells = getAbsoluteCells(EXAMPLE_SHAPES, piece);

            return {
                targetOrigin,
                rotation,
                rotatedOffset: rotated,
                snapBoardPos,
                finalNodePos,
                expectedCells,
                allInBounds: expectedCells.every(cell =>
                    cell.x >= 0 && cell.x < BOARD_WIDTH &&
                    cell.y >= 0 && cell.y < BOARD_HEIGHT
                )
            };
        }

        it("rotation=0° 应能正常吸附到中心区域", () => {
            const result = simulatePlacement({ x: 2, y: 2 }, 0);

            console.log(`\n=== rotation=0°, target origin=(2,2) ===`);
            console.log("rotatedOffset:", result.rotatedOffset);
            console.log("expectedCells:", result.expectedCells);
            console.log("allInBounds:", result.allInBounds);

            expect(result.allInBounds).toBe(true);
        });

        it("rotation=90° 应能正常吸附到中心区域", () => {
            const result = simulatePlacement({ x: 2, y: 2 }, 90);

            console.log(`\n=== rotation=90°, target origin=(2,2) ===`);
            console.log("rotatedOffset:", result.rotatedOffset);
            console.log("expectedCells:", result.expectedCells);
            console.log("allInBounds:", result.allInBounds);

            expect(result.allInBounds).toBe(true);
        });

        it("rotation=180° 应能正常吸附到中心区域", () => {
            const result = simulatePlacement({ x: 2, y: 2 }, 180);

            console.log(`\n=== rotation=180°, target origin=(2,2) ===`);
            console.log("rotatedOffset:", result.rotatedOffset);
            console.log("expectedCells:", result.expectedCells);
            console.log("allInBounds:", result.allInBounds);

            expect(result.allInBounds).toBe(true);
        });

        it("rotation=270° 应能正常吸附到中心区域", () => {
            const result = simulatePlacement({ x: 2, y: 2 }, 270);

            console.log(`\n=== rotation=270°, target origin=(2,2) ===`);
            console.log("rotatedOffset:", result.rotatedOffset);
            console.log("expectedCells:", result.expectedCells);
            console.log("allInBounds:", result.allInBounds);

            expect(result.allInBounds).toBe(true);
        });
    });

    describe("边界情况：旋转后边界检测", () => {
        const rootToOriginOffset = vec3(0, -128, 0);

        it("rotation=90时从(0,0)开始，部分shape会超出边界", () => {
            const piece = {
                id: "test",
                shapeId: "building_001",
                type: PieceType.Building,
                origin: { x: 0, y: 0 },
                rotation: 90 as Rotation
            };
            const cells = getAbsoluteCells(EXAMPLE_SHAPES, piece);

            console.log("\n=== Test: Origin (0,0), rotation=90° ===");
            console.log("cells:", cells);

            let hasOutOfBounds = false;
            for (const cell of cells) {
                if (cell.x < 0 || cell.x >= BOARD_WIDTH || cell.y < 0 || cell.y >= BOARD_HEIGHT) {
                    hasOutOfBounds = true;
                }
            }
            expect(hasOutOfBounds).toBe(true);
        });

        it("rotation=0时从(0,0)开始，shape在边界内", () => {
            const piece = {
                id: "test",
                shapeId: "building_001",
                type: PieceType.Building,
                origin: { x: 0, y: 0 },
                rotation: 0 as Rotation
            };
            const cells = getAbsoluteCells(EXAMPLE_SHAPES, piece);

            for (const cell of cells) {
                expect(
                    cell.x >= 0 && cell.x < BOARD_WIDTH &&
                    cell.y >= 0 && cell.y < BOARD_HEIGHT
                ).toBe(true);
            }
        });

        it("rotation=270时从(5,5)开始，部分shape可能超出", () => {
            const piece = {
                id: "test",
                shapeId: "building_001",
                type: PieceType.Building,
                origin: { x: 5, y: 5 },
                rotation: 270 as Rotation
            };
            const cells = getAbsoluteCells(EXAMPLE_SHAPES, piece);

            console.log("\n=== Test: Origin (5,5), rotation=270° ===");
            console.log("cells:", cells);

            let outOfBoundsCount = 0;
            for (const cell of cells) {
                if (cell.x < 0 || cell.x >= BOARD_WIDTH || cell.y < 0 || cell.y >= BOARD_HEIGHT) {
                    outOfBoundsCount++;
                }
            }
            expect(outOfBoundsCount).toBeGreaterThan(0);
        });
    });
});
