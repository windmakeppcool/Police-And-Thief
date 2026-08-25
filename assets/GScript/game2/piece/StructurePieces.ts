import { _decorator, Component, EventTouch, Input, input, Sprite, SpriteFrame } from 'cc';
import { PieceColors } from '../common/GameTypes';
import { DraggablePiece } from './DraggablePiece';
const { ccclass, property } = _decorator;

@ccclass('StructurePieces')
export class StructurePieces extends DraggablePiece {
    protected onLoad(): void {
        // this.applyColorToChild(PieceColors.COLOR_BUILDING);
        super.onLoad();
    }

    onDestroy(): void {
        super.onDestroy();
    }

}


