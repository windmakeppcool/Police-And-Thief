import { _decorator, Color, instantiate, Node, Prefab, Sprite, Vec3 } from 'cc';
import { cellKey, isInsideBoard, PieceType, type Coord, type PieceShape, type Rotation } from '../domain/GameTypes';
import { buildOccupancy } from '../domain/BoardOccupancy';
import { BoardGridView } from './BoardGridView';
import { GameSession } from '../service/GameSession';
import { PrefabsCfg } from '../../auto/PrefabCfg';
import { DraggablePieceViewBase } from './DraggablePieceViewBase';
const { ccclass, property } = _decorator;

export type OnPolicePlacedCallback = (policeId: string, shapeId: string, origin: Coord, rotation: Rotation) => void;

export interface PoliceCreateOptions {
    session: GameSession;
    boardGridView: BoardGridView;
    parentNode: Node;
    trayX: number;
    spacing: number;
}

@ccclass('PoliceView')
export class PoliceView extends DraggablePieceViewBase {
    private readonly POLICE_PREFAB_KEYS: (keyof typeof PrefabsCfg)[] = [
        'Police1UI',
        'Police2UI',
        'Police3UI',
        'Police4UI',
        'Police5UI',
        'Police6UI',
    ];

    private readonly SHAPE_IDS: string[] = [
        'police_001',
        'police_002',
        'police_003',
        'police_004',
        'police_005',
        'police_006',
    ];

    private readonly COLOR_POLICE_AT = new Color(250, 204, 21, 255);
    public cellPixelSize: number = 64;

    @property(String) public shapeId: string = '';

    public onPlaced: OnPolicePlacedCallback | null = null;
    public policeId: string = '';

    private _policeAtMarker: Node | null = null;

    public start(): void { }

    public update(deltaTime: number): void { }

    protected get pieceType(): PieceType {
        return PieceType.Police;
    }

    protected get pieceId(): string {
        return this.policeId;
    }

    protected unplacePiece(): void {
        this.session?.removePolice(this.policeId);
        this.isPlaced = false;
    }

    protected notifyPlaced(origin: Coord, rotation: Rotation): void {
        this.onPlaced?.(this.policeId, this.shapeId, origin, rotation);
    }

    protected onRotationChanged(): void {
        this.updatePoliceAtMarkerRotation();
    }

    protected isValidPlacement(origin: Coord): boolean {
        if (!this.session) return false;

        const level = this.session.getLevel();
        const candidateCells = this.candidateCells(origin);
        for (const cell of candidateCells) {
            if (!isInsideBoard(this.board, cell)) return false;
            if (cell.x === level.thief.x && cell.y === level.thief.y) return false;
        }

        const allPieces = [
            ...level.buildings,
            ...this.session.getPlacedStructures(),
            ...this.session.getPlacedPolice().filter(p => p.id !== this.policeId),
        ];
        const occupancy = buildOccupancy(this.shapes, allPieces);
        for (const cell of candidateCells) {
            if (occupancy.blocked.has(cellKey(cell))) return false;
        }

        const inventoryItem = level.policeInventory.find(item => item.shapeId === this.shapeId);
        if (inventoryItem) {
            const usedCount = this.session.getPlacedPolice()
                .filter(p => p.shapeId === this.shapeId && p.id !== this.policeId).length;
            if (usedCount >= inventoryItem.count) return false;
        }

        return true;
    }

    public async createPolicePieces(
        options: PoliceCreateOptions,
        onPlaced?: OnPolicePlacedCallback
    ): Promise<PoliceView[]> {
        const { session, boardGridView, parentNode, trayX, spacing } = options;

        const policePieces: PoliceView[] = [];
        const positions = [
            new Vec3(320, 200, 0),
            new Vec3(520, 200, 0),
            new Vec3(320, -90, 0),
            new Vec3(520, -90, 0),
            new Vec3(420, 380, 0),
            new Vec3(420, -280, 0),
        ];

        for (let i = 0; i < this.POLICE_PREFAB_KEYS.length; i++) {
            const prefabKey = this.POLICE_PREFAB_KEYS[i];
            const shapeId = this.SHAPE_IDS[i];

            const draggable = await this.createSinglePolice({
                policeId: `police_${i + 1}`,
                prefabKey,
                shapeId,
                session,
                boardGridView,
                parentNode,
                homePos: positions[i] ?? new Vec3(trayX, 0, 0),
            });

            if (draggable) {
                draggable.onPlaced = onPlaced ?? null;
                policePieces.push(draggable);
            }
        }

        return policePieces;
    }

    public async createSinglePolice(params: {
        policeId: string;
        prefabKey: keyof typeof PrefabsCfg;
        shapeId: string;
        session: GameSession;
        boardGridView: BoardGridView;
        parentNode: Node;
        homePos: Vec3;
    }): Promise<PoliceView | null> {
        const {
            policeId,
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
            console.error(`[PoliceView] 加载预制体失败: ${prefabKey}`);
            return null;
        }

        const node = instantiate(prefab);
        const draggable = node.addComponent(PoliceView);

        draggable.policeId = policeId;
        draggable.shapeId = shapeId;
        draggable.boardNode = boardGridView.node;
        draggable.boardGridView = boardGridView;
        draggable.board = session.getLevel().board;
        draggable.session = session;
        draggable.shapes = session.getShapes();

        node.parent = parentNode;
        node.setPosition(homePos);
        draggable.setHomePosition(homePos);

        this.applyColorToChildrenV2(node, draggable.shapes[draggable.shapeId].policeAt);
        return draggable;
    }

    public getPolicePrefabsCount(): number {
        return this.POLICE_PREFAB_KEYS.length;
    }

    applyColorToChildrenV2(node: Node, policeAt: number): void {
        let index = 0;
        for (const child of node.children) {
            const sprite = child.getComponent(Sprite);
            if (!sprite) continue;
            if (index === policeAt) {
                sprite.color = this.COLOR_POLICE_AT;
            } else {
                sprite.color = this.COLOR_POLICE;
            }
            index++;
        }
    }

    private updatePoliceAtMarkerRotation(): void {
        if (!this._policeAtMarker) return;
        if (!this.shapeId || !this.shapes[this.shapeId]) return;

        const shape: PieceShape = this.shapes[this.shapeId];
        if (shape.policeAt === undefined) return;

        const coordArray = shape.prefabChildren ?? shape.cells;
        if (!coordArray || shape.policeAt >= coordArray.length) return;

        const coordItem = coordArray[shape.policeAt];
        let rx = 'coord' in coordItem ? coordItem.coord.x : coordItem.x;
        let ry = 'coord' in coordItem ? coordItem.coord.y : coordItem.y;
        for (let r = 0; r < this.rotation; r += 90) {
            const nx = -ry;
            const ny = rx;
            rx = nx;
            ry = ny;
        }

        this._policeAtMarker.setPosition(rx * this.cellPixelSize, -ry * this.cellPixelSize, 1);
    }
}
