import { _decorator, Component } from 'cc';
import { EXAMPLE_LEVEL, EXAMPLE_SHAPES } from '../level/LevelExamples';
import { GameSession } from '../service/GameSession';
const { ccclass } = _decorator;

@ccclass('GameController')
export class GameController extends Component {
    private session: GameSession = null!;

    protected onLoad(): void {
        this.session = new GameSession(EXAMPLE_SHAPES, EXAMPLE_LEVEL);
        gCtrl.platform.reportEvent?.('game_session_created', { levelId: EXAMPLE_LEVEL.id });
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
        gCtrl.platform.reportEvent?.('police_placed', { won: win.won });
    }

    getSession(): GameSession {
        return this.session;
    }
}
