import { _decorator, Component, instantiate, Prefab, UITransform } from 'cc';
import { EXAMPLE_LEVEL, EXAMPLE_SHAPES } from '../level/LevelExamples';
import { solveLevel } from '../level/LevelSolver';
import { GameSession } from '../service/GameSession';
import { BoardGridView } from '../view/BoardGridView';
import { StructureView } from '../view/StructureView';
import { PrefabsCfg } from '../../auto/PrefabCfg';
import { type Coord, type Rotation } from '../domain/GameTypes';
import { EViewLayer } from '../../core/ui/EViewLayer';
const { ccclass, property } = _decorator;

@ccclass('GameController')
export class GameController extends Component {
    static readonly viewLayer = EViewLayer.Anim;

    private session: GameSession = null!;
    private boardGridView: BoardGridView = null!;
    private structures: StructureView[] = [];

    protected onLoad(): void {
        this.node.addComponent(UITransform);
        this.session = new GameSession(EXAMPLE_SHAPES, EXAMPLE_LEVEL);
        gCtrl.platform.reportEvent?.('game_session_created', { levelId: EXAMPLE_LEVEL.id });
    }

    protected async start(): Promise<void> {
        await this.createBoardGrid();
        await this.initStructures();
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
        const board = this.session.getLevel().board;
        const cs = this.boardGridView.cellSize;
        const trayX = -(board.width * cs) / 2 - cs * 2;
        const spacing = cs * 2;

        const onPlaced = (structureId: string, shapeId: string, origin: Coord, rotation: Rotation): void => {
            const result = this.session.placeStructure({ id: structureId, shapeId, origin, rotation });
            if (result.ok) {
                console.log(`[GameController] 结构 ${shapeId} 已放置在 (${origin.x}, ${origin.y})，旋转 ${rotation}°`);
                gCtrl.platform.reportEvent?.('structure_placed', { shapeId, x: origin.x, y: origin.y, rotation });
            }
        };

        this.structures = await StructureView.createStructures({
            session: this.session,
            boardGridView: this.boardGridView,
            parentNode: this.node,
            trayX,
            spacing,
        }, onPlaced);
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
