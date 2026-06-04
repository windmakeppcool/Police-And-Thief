import { _decorator, Component, instantiate, Prefab, UITransform } from 'cc';
import { EXAMPLE_LEVEL, EXAMPLE_SHAPES } from '../level/LevelExamples';
import { solveLevel } from '../level/LevelSolver';
import { GameSession } from '../service/GameSession';
import { BoardGridView } from '../view/BoardGridView';
import { StructureView } from '../view/StructureView';
import { PoliceView } from '../view/PoliceView';
import { PieceInputRouter } from '../view/PieceInputRouter';
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
    private policePieces: PoliceView[] = [];
    private pieceInputRouter: PieceInputRouter = null!;

    protected onLoad(): void {
        this.node.addComponent(UITransform);
        this.session = new GameSession(EXAMPLE_SHAPES, EXAMPLE_LEVEL);
        gCtrl.platform.reportEvent?.('game_session_created', { levelId: EXAMPLE_LEVEL.id });
    }

    protected async start(): Promise<void> {
        await this.createBoardGrid();
        await this.initStructures();
        await this.initPolicePieces();
        this.initPieceInputRouter();
    }

    private async createBoardGrid(): Promise<void> {
        const bUrl = PrefabsCfg.BoardGridView;
        const prefab = await gCtrl.res.loadAssetAsync(bUrl, Prefab);
        if (!prefab) {
            console.error('[GameController] 加载棋盘预制体失败');
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
        const trayX = -(board.width * cs) / 2 - cs * 3.5;
        const spacing = cs * 2.5;

        const onPlaced = (structureId: string, shapeId: string, origin: Coord, rotation: Rotation): void => {
            const result = this.session.placeStructure({ id: structureId, shapeId, origin, rotation });
            if (result.ok) {
                console.log(`[GameController] 结构 ${shapeId} 已放置在 (${origin.x}, ${origin.y})，旋转 ${rotation}°`);
                gCtrl.platform.reportEvent?.('structure_placed', { shapeId, x: origin.x, y: origin.y, rotation });
            }
        };

        const structureView = this.node.addComponent(StructureView);
        this.structures = await structureView.createStructures({
            session: this.session,
            boardGridView: this.boardGridView,
            parentNode: this.node,
            trayX,
            spacing,
        }, onPlaced);
    }

    private async initPolicePieces(): Promise<void> {
        const board = this.session.getLevel().board;
        const cs = this.boardGridView.cellSize;
        const trayX = (board.width * cs) / 2 + cs * 3.5;
        const spacing = cs * 2.5;

        const onPlaced = (policeId: string, shapeId: string, origin: Coord, rotation: Rotation): void => {
            const result = this.session.placePoliceWithId({ id: policeId, shapeId, origin, rotation });
            if (result.ok) {
                console.log(`[GameController] 警察 ${shapeId} 已放置在 (${origin.x}, ${origin.y})，旋转 ${rotation}°`);
                const win = this.session.checkWin();
                this.boardGridView.renderGrid(this.session);
                gCtrl.platform.reportEvent?.('police_placed', { shapeId, x: origin.x, y: origin.y, rotation, won: win.won });
            } else {
                console.warn(`[GameController] 放置警察失败: ${result.reason}`);
            }
        };

        const policeView = this.node.addComponent(PoliceView);
        this.policePieces = await policeView.createPolicePieces({
            session: this.session,
            boardGridView: this.boardGridView,
            parentNode: this.node,
            trayX,
            spacing,
        }, onPlaced);
    }

    private initPieceInputRouter(): void {
        this.pieceInputRouter = this.node.getComponent(PieceInputRouter) ?? this.node.addComponent(PieceInputRouter);
        this.pieceInputRouter.setPieces([...this.structures, ...this.policePieces]);
    }

    getSession(): GameSession {
        return this.session;
    }
}
