import {
    type EscapePathResult,
    type LevelData,
    type MoveResult,
    type PlacePoliceInput,
    type PlacedPiece,
    PieceType,
    type ShapeCatalog
} from "../domain/GameTypes";
import { canThiefEscape } from "../rules/EscapePathFinder";
import { validatePolicePlacement } from "../rules/PlacementValidator";
import { isWin } from "../rules/WinCondition";

export type WinCheckResult = Readonly<{
    won: boolean;
    path: EscapePathResult;
}>;

export class GameSession {
    private placedPolice: PlacedPiece[] = [];
    private placedStructures: PlacedPiece[] = [];
    private nextPoliceId = 1;
    private nextStructureId = 1;

    constructor(
        private readonly shapes: ShapeCatalog,
        private readonly level: LevelData
    ) { }

    getShapes(): ShapeCatalog {
        return this.shapes;
    }

    getLevel(): LevelData {
        return this.level;
    }

    getPlacedPolice(): readonly PlacedPiece[] {
        return this.placedPolice;
    }

    getPlacedStructures(): readonly PlacedPiece[] {
        return this.placedStructures;
    }

    getAllPlacedPieces(): readonly PlacedPiece[] {
        return [...this.level.buildings, ...this.placedStructures, ...this.placedPolice];
    }

    placeStructure(input: PlacePoliceInput & { id?: string }): MoveResult {
        const shape = this.shapes[input.shapeId];
        if (!shape) {
            return { ok: false, reason: "unknown_shape" };
        }
        if (shape.type !== PieceType.Building) {
            return { ok: false, reason: "not_building_shape" };
        }

        const id = input.id ?? `structure_${this.nextStructureId++}`;
        const existed = this.placedStructures.findIndex(piece => piece.id === id);
        const placed: PlacedPiece = {
            id,
            shapeId: input.shapeId,
            type: PieceType.Building,
            origin: input.origin,
            rotation: input.rotation
        };

        if (existed >= 0) {
            this.placedStructures[existed] = placed;
        } else {
            this.placedStructures.push(placed);
        }

        return { ok: true, reason: "ok" };
    }

    removeStructure(id: string): void {
        const idx = this.placedStructures.findIndex(p => p.id === id);
        if (idx >= 0) {
            this.placedStructures.splice(idx, 1);
        }
    }

    placePolice(input: PlacePoliceInput): MoveResult {
        const validation = validatePolicePlacement(this.shapes, this.level, this.placedPolice, input);
        if (!validation.ok) {
            return validation;
        }

        this.placedPolice.push({
            id: `police_${this.nextPoliceId++}`,
            shapeId: input.shapeId,
            type: PieceType.Police,
            origin: input.origin,
            rotation: input.rotation
        });

        return { ok: true, reason: "ok" };
    }

    removePolice(id: string): void {
        const idx = this.placedPolice.findIndex(p => p.id === id);
        if (idx >= 0) {
            this.placedPolice.splice(idx, 1);
        }
    }

    placePoliceWithId(input: PlacePoliceInput & { id: string }): MoveResult {
        const existed = this.placedPolice.findIndex(piece => piece.id === input.id);
        const temp = existed >= 0
            ? [...this.placedPolice.slice(0, existed), ...this.placedPolice.slice(existed + 1)]
            : this.placedPolice;
        const validation = validatePolicePlacement(this.shapes, this.level, temp, input);
        if (!validation.ok) return validation;

        const placed: PlacedPiece = {
            id: input.id,
            shapeId: input.shapeId,
            type: PieceType.Police,
            origin: input.origin,
            rotation: input.rotation,
        };
        if (existed >= 0) {
            this.placedPolice[existed] = placed;
        } else {
            this.placedPolice.push(placed);
        }
        return { ok: true, reason: "ok" };
    }

    undo(): MoveResult {
        if (this.placedPolice.length === 0) {
            return { ok: false, reason: "nothing_to_undo" };
        }

        this.placedPolice.pop();
        return { ok: true, reason: "ok" };
    }

    checkWin(): WinCheckResult {
        const path = canThiefEscape(this.shapes, this.level, this.placedPolice);
        return {
            won: isWin(path),
            path
        };
    }
}
