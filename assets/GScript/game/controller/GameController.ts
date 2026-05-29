import { _decorator, Component } from 'cc';
import { EXAMPLE_LEVEL, EXAMPLE_SHAPES } from '../level/LevelExamples';
import { solveLevel } from '../level/LevelSolver';
import { GameSession } from '../service/GameSession';
import { DebugBoardRenderer } from '../view/DebugBoardRenderer';
const { ccclass } = _decorator;

@ccclass('GameController')
export class GameController extends Component {
    private session: GameSession = null!;
    private renderer: DebugBoardRenderer = null!;

    protected onLoad(): void {
        this.session = new GameSession(EXAMPLE_SHAPES, EXAMPLE_LEVEL);
        this.renderer = this.getComponent(DebugBoardRenderer) || this.addComponent(DebugBoardRenderer);
        gCtrl.platform.reportEvent?.('game_session_created', { levelId: EXAMPLE_LEVEL.id });
    }

    protected async start(): Promise<void> {
        this.renderer.render(this.session, EXAMPLE_SHAPES);
        this.debugSolveExampleLevel();
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
        this.renderer.refreshRender(this.session, EXAMPLE_SHAPES);
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
        this.renderer.refreshRender(this.session, EXAMPLE_SHAPES);
        console.log('[GameController] 最终胜负:', win);
    }

    getSession(): GameSession {
        return this.session;
    }
}