import { _decorator, instantiate, Node, Prefab, Vec3 } from 'cc';
import { cellKey, isInsideBoard, PieceType, type Coord, type Rotation } from '../domain/GameTypes';
import { buildOccupancy } from '../domain/BoardOccupancy';
import { BoardGridView } from './BoardGridView';
import { GameSession } from '../service/GameSession';
import { PrefabsCfg } from '../../auto/PrefabCfg';
import { DraggablePieceViewBase } from './DraggablePieceViewBase';
const { ccclass, property } = _decorator;

export type OnPlacedCallback = (structureId: string, shapeId: string, origin: Coord, rotation: Rotation) => void;

export interface StructureCreateOptions {
    session: GameSession;
    boardGridView: BoardGridView;
    parentNode: Node;
    trayX: number;
    spacing: number;
}

@ccclass('StructureView')
export class StructureView extends DraggablePieceViewBase {
    private readonly STRUCTURE_PREFAB_KEYS: (keyof typeof PrefabsCfg)[] = [
        'Structure1UI',
        'Structure2UI',
        'Structure3UI',
        'Structure4UI',
    ];

    @property(String) public shapeId: string = '';

    public onPlaced: OnPlacedCallback | null = null;
    public structureId: string = '';

    public start(): void { }

    public update(deltaTime: number): void { }

    protected get pieceType(): PieceType {
        return PieceType.Building;
    }

    protected get pieceId(): string {
        return this.structureId;
    }

    protected unplacePiece(): void {
        this.session?.removeStructure(this.structureId);
        this.isPlaced = false;
    }

    protected notifyPlaced(origin: Coord, rotation: Rotation): void {
        this.onPlaced?.(this.structureId, this.shapeId, origin, rotation);
    }

    protected isValidPlacement(origin: Coord): boolean {
        if (!this.session) return false;

        const level = this.session.getLevel();
        const candidateCells = this.candidateCells(origin);
        for (const cell of candidateCells) {
            if (!isInsideBoard(this.board, cell)) return false;
            if (cell.x === level.thief.x && cell.y === level.thief.y) return false;
        }

        const occupancy = buildOccupancy(this.shapes, [
            ...level.buildings,
            ...this.session.getPlacedStructures().filter(piece => piece.id !== this.structureId),
            ...this.session.getPlacedPolice(),
        ]);
        for (const cell of candidateCells) {
            if (occupancy.blocked.has(cellKey(cell))) return false;
        }

        return true;
    }

    public async createStructures(
        options: StructureCreateOptions,
        onPlaced?: OnPlacedCallback
    ): Promise<StructureView[]> {
        const { session, boardGridView, parentNode, trayX, spacing } = options;

        const structures: StructureView[] = [];
        const positions = [
            new Vec3(-520, 200, 0),
            new Vec3(-320, 200, 0),
            new Vec3(-500, -90, 0),
            new Vec3(-300, -90, 0),
        ];

        for (let i = 0; i < this.STRUCTURE_PREFAB_KEYS.length; i++) {
            const prefabKey = this.STRUCTURE_PREFAB_KEYS[i];
            const shapeId = `building_00${i + 1}`;

            const draggable = await this.createSingleStructure({
                structureId: `structure_${i + 1}`,
                prefabKey,
                shapeId,
                session,
                boardGridView,
                parentNode,
                homePos: positions[i] ?? new Vec3(trayX, 0, 0),
            });

            if (draggable) {
                draggable.onPlaced = onPlaced ?? null;
                structures.push(draggable);
            }
        }

        return structures;
    }

    public async createSingleStructure(params: {
        structureId: string;
        prefabKey: keyof typeof PrefabsCfg;
        shapeId: string;
        session: GameSession;
        boardGridView: BoardGridView;
        parentNode: Node;
        homePos: Vec3;
    }): Promise<StructureView | null> {
        const {
            structureId,
            prefabKey,
            shapeId,
            session,
            boardGridView,
            parentNode,
            homePos,
        } = params;

        const bUrl = PrefabsCfg[prefabKey];
        const prefab = await gCtrl.res.loadAssetAsync(bUrl, Prefab);
        if (!prefab) {
            console.error(`[StructureView] Failed to load prefab: ${prefabKey}`);
            return null;
        }

        const node = instantiate(prefab);
        this.applyColorToChildren(node, this.COLOR_BUILDING);
        const draggable = node.addComponent(StructureView);

        draggable.structureId = structureId;
        draggable.shapeId = shapeId;
        draggable.boardNode = boardGridView.node;
        draggable.boardGridView = boardGridView;
        draggable.board = session.getLevel().board;
        draggable.session = session;
        draggable.shapes = session.getShapes();

        node.parent = parentNode;
        node.setPosition(homePos);
        draggable.setHomePosition(homePos);

        return draggable;
    }

    public getStructurePrefabsCount(): number {
        return this.STRUCTURE_PREFAB_KEYS.length;
    }
}
