import { _decorator, assetManager, Component, instantiate, Prefab, Node, UITransform } from 'cc';
import { EXAMPLE_LEVEL, EXAMPLE_SHAPES } from '../level/LevelExamples';
import { solveLevel } from '../level/LevelSolver';
import { GameSession } from '../service/GameSession';
import { BoardGridView } from '../view/BoardGridView';
import { StructureDraggable } from '../view/StructureDraggable';
import { PrefabsCfg } from '../../auto/PrefabCfg';
import { type Coord } from '../domain/GameTypes';
const { ccclass } = _decorator;

/** Structure prefab key → shapeId mapping */
const STRUCTURE_DEFS: { key: keyof typeof PrefabsCfg; shapeId: string }[] = [
    { key: 'Structure1UI', shapeId: 'building_001' },
    { key: 'Structure2UI', shapeId: 'building_002' },
    { key: 'Structure3UI', shapeId: 'building_003' },
    { key: 'Structure4UI', shapeId: 'building_004' },
];

@ccclass('GameController')
export class GameController extends Component {
    private session: GameSession = null!;
    private renderer: BoardGridView = null!;
    private structures: StructureDraggable[] = [];

    protected onLoad(): void {
        this.session = new GameSession(EXAMPLE_SHAPES, EXAMPLE_LEVEL);
        this.renderer = this.getComponent(BoardGridView) || this.addComponent(BoardGridView);
        gCtrl.platform.reportEvent?.('game_session_created', { levelId: EXAMPLE_LEVEL.id });
    }

    protected start(): void {
        this.renderer.renderGrid(this.session);
        this.initStructures();
        this.debugSolveExampleLevel();
    }

    private initStructures(): void {
        const bundle = assetManager.getBundle('GameBN');
        if (!bundle) {
            console.error('[GameController] GameBN bundle not loaded');
            return;
        }

        const board = this.session.getLevel().board;
        const cs = this.renderer.cellSize;
        const grid = this.renderer;

        // Tray: centered below the board with margin
        const trayY = -(board.height * cs) / 2 - cs;
        const spacing = cs * 2;
        const totalWidth = (STRUCTURE_DEFS.length - 1) * spacing;
        const startX = -totalWidth / 2;

        for (let i = 0; i < STRUCTURE_DEFS.length; i++) {
            const def = STRUCTURE_DEFS[i];
            const bUrl = PrefabsCfg[def.key];
            const prefab = bundle.get(bUrl.bundlePath, Prefab);
            if (!prefab) {
                console.error(`[GameController] prefab not found: ${bUrl.bundlePath}`);
                continue;
            }

            const node = instantiate(prefab);
            node.parent = this.node;  // GameController node is on Scene layer
            node.setPosition(startX + i * spacing, trayY, 0);

            const draggable = node.addComponent(StructureDraggable);
            draggable.shapeId = def.shapeId;
            draggable.boardNode = this.renderer.node;
            draggable.boardGridView = grid;
            draggable.board = board;
            draggable.session = this.session;
            draggable.shapes = EXAMPLE_SHAPES;
            draggable.onPlaced = (shapeId: string, origin: Coord) => {
                const result = this.session.placeStructure({ shapeId, origin, rotation: 0 });
                if (result.ok) {
                    console.log(`[GameController] 结构 ${shapeId} 已放置在 (${origin.x}, ${origin.y})`);
                    gCtrl.platform.reportEvent?.('structure_placed', { shapeId, x: origin.x, y: origin.y });
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
        this.renderer.renderGrid(this.session);
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
        this.renderer.renderGrid(this.session);
        console.log('[GameController] 最终胜负:', win);
    }

    getSession(): GameSession {
        return this.session;
    }
}
