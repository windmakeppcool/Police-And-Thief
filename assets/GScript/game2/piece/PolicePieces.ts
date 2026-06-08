import { _decorator } from 'cc';
import { PieceColors } from '../common/GameTypes';
import { DraggablePiece } from './DraggablePiece';
const { ccclass } = _decorator;

@ccclass('PolicePieces')
export class PolicePieces extends DraggablePiece {
    protected onLoad(): void {
        this.applyColorToChild(PieceColors.COLOR_POLICE);
        super.onLoad();
    }

    onDestroy(): void {
        super.onDestroy();
    }
}
