import { _decorator } from 'cc';
import { DraggablePiece } from './DraggablePiece';
const { ccclass } = _decorator;

/** 警察棋子：可拖拽上场、可点击转向 */
@ccclass('PolicePieces')
export class PolicePieces extends DraggablePiece {
}
