import { _decorator, assetManager, Component, instantiate, Prefab, Vec3 } from 'cc';
import { EXAMPLE_LEVEL, EXAMPLE_SHAPES } from '../level/LevelExamples';
import { solveLevel } from '../level/LevelSolver';
import { GameSession } from '../service/GameSession';
import { BoardGridView } from '../view/BoardGridView';
import { StructureDraggable } from '../view/StructureDraggable';
import { PrefabsCfg } from '../../auto/PrefabCfg';
import { type Coord, type Rotation } from '../domain/GameTypes';
import { EViewLayer } from '../../core/ui/EViewLayer';
const { ccclass, property } = _decorator;

const STRUCTURE_DEFS: { key: keyof typeof PrefabsCfg; shapeId: string }[] = [
    { key: 'Structure1UI', shapeId: 'building_001' },
    { key: 'Structure2UI', shapeId: 'building_002' },
    { key: 'Structure3UI', shapeId: 'building_003' },
    { key: 'Structure4UI', shapeId: 'building_004' },
];

@ccclass('GameController')
export class GameController extends Component {
    static readonly viewLayer = EViewLayer.Scene;

    private session: GameSession = null!;
    private boardGridView: BoardGridView = null!;
    private structures: StructureDraggable[] = [];

    protected onLoad(): void {
        this.session = new GameSession(EXAMPLE_SHAPES, EXAMPLE_LEVEL);
        gCtrl.platform.reportEvent?.('game_session_created', { levelId: EXAMPLE_LEVEL.id });
    }

    protected async start(): Promise<void> {
        await this.createBoardGrid();
        this.initStructures();
    }

    private async createBoardGrid(): Promise<void> {
        const bUrl = PrefabsCfg.BoardGridView;
        const prefab = await gCtrl.res.loadAssetAsync(bUrl, Prefab);
        if (!prefab) {
            console.error('[GameController] Failed to load BoardGrid prefab');
            return;
        }

        const node = instantiate(prefab);
        node.parent = gCtrl.ui.getLayer(EViewLayer.Scene);
        this.boardGridView = node.getComponent(BoardGridView)!;
        this.boardGridView.renderGrid(this.session);
    }

    private async initStructures(): Promise<void> {
        const bundle = assetManager.getBundle('GameBN');
        if (!bundle) {
            console.error('[GameController] GameBN bundle not loaded');
            return;
        }

        const board = this.session.getLevel().board;
        const cs = this.boardGridView.cellSize;
        const grid = this.boardGridView;

        const trayX = -(board.width * cs) / 2 - cs * 2;
        const spacing = cs * 2;
        const totalHeight = (STRUCTURE_DEFS.length - 1) * spacing;
        const startY = totalHeight / 2;

        for (let i = 0; i < STRUCTURE_DEFS.length; i++) {
            const def = STRUCTURE_DEFS[i];
            const bUrl = PrefabsCfg[def.key];
            // const prefab = await this.loadPrefab(bUrl.bundlePath);
            const prefab = await gCtrl.res.loadAssetAsync(bUrl, Prefab);
            if (!prefab) continue;

            const node = instantiate(prefab);
            node.parent = this.node;
            const homePos = new Vec3(trayX, startY - i * spacing, 0);
            node.setPosition(homePos);

            const draggable = node.addComponent(StructureDraggable);
            draggable.setHomePosition(homePos);
            draggable.structureId = `structure_${i + 1}`;
            draggable.shapeId = def.shapeId;
            draggable.boardNode = this.boardGridView.node;
            draggable.boardGridView = grid;
            draggable.board = board;
            draggable.session = this.session;
            draggable.shapes = EXAMPLE_SHAPES;
            draggable.onPlaced = (structureId: string, shapeId: string, origin: Coord, rotation: Rotation) => {
                const result = this.session.placeStructure({ id: structureId, shapeId, origin, rotation });
                if (result.ok) {
                    console.log(`[GameController] 结构 ${shapeId} 已放置在 (${origin.x}, ${origin.y})，旋转 ${rotation}°`);
                    gCtrl.platform.reportEvent?.('structure_placed', { shapeId, x: origin.x, y: origin.y, rotation });
                }
            };

            this.structures.push(draggable);
        }
    }



    placePoliceAtCenter(): void {
        const result = this.session.placePolice({
            shapeId: 'police_1x1',
            origin: { x: 1, y: 2 },
            rotation: 0,
        });
        if (!result.ok) {
            console.warn(`放置警察失败: ${result.reason}`);
            return;
        }
        const win = this.session.checkWin();
        this.boardGridView.renderGrid(this.session);
        gCtrl.platform.reportEvent?.('police_placed', { won: win.won });
    }

    debugSolveExampleLevel(): void {
        const result = solveLevel(EXAMPLE_SHAPES, EXAMPLE_LEVEL, {
            maxDepth: 4,
            rotations: [0],
        });

        console.log('[GameController] 求解结果:', result);

        if (!result.solved) {
            console.warn('[GameController] 当前示例关卡无解');
            return;
        }

        for (const placement of result.placements) {
            const move = this.session.placePolice(placement);
            console.log('[GameController] 放置警察:', placement, move);
        }

        const win = this.session.checkWin();
        this.boardGridView.renderGrid(this.session);
        console.log('[GameController] 最终胜负:', win);
    }

    getSession(): GameSession {
        return this.session;
    }
}
