import { _decorator, Component, Node, Sprite, SpriteFrame, tween, Vec3 } from 'cc';
import { EViewLayer } from '../../core/ui/EViewLayer';
import { GameSession } from '../common/GameSession';
import { Coord } from '../common/GameTypes';
import type { DesignFrames } from '../ui/DesignAssets';
import { addSprite, createNode } from '../ui/UIFactory';
const { ccclass, property } = _decorator;

@ccclass('BoardGrid')
export class BoardGrid extends Component {
    static readonly viewLayer = EViewLayer.Scene;

    @property(SpriteFrame) public boardSpriteFrame: SpriteFrame = null!;
    @property(SpriteFrame) public thiefSpriteFrame: SpriteFrame = null!;

    private _cellSize = 64;
    private _gridSize = 6;
    private frames: DesignFrames | null = null;
    private cellNodes: Node[] = [];
    private ghostNodes: Node[] = [];
    private thiefNode: Node | null = null;
    private thiefFrames: SpriteFrame[] = [];
    private peekStep = 0;
    private thiefCaught = false;

    public get cellSize(): number { return this._cellSize; }
    public get gridSize(): number { return this._gridSize; }

    /** 注入设计稿拆分出的精灵素材（棋盘角格、小偷动画帧等） */
    public configure(frames: DesignFrames): void {
        this.frames = frames;
    }

    /** 判断网格坐标是否在棋盘有效范围内 */
    public isValidCoord(coord: Coord): boolean {
        const half = this._gridSize / 2;
        return coord.x >= -half && coord.x < half && coord.y >= -half && coord.y < half;
    }

    /** 网格坐标 -> 节点本地坐标（格中心） */
    public cellToLocal(coord: Coord): Vec3 {
        return new Vec3(
            coord.x * this._cellSize + this._cellSize / 2,
            coord.y * this._cellSize + this._cellSize / 2,
            0,
        );
    }

    /** 节点本地坐标 -> 最近的网格坐标 */
    public localToCell(localPos: Vec3): Coord {
        return {
            x: Math.round((localPos.x - this._cellSize / 2) / this._cellSize),
            y: Math.round((localPos.y - this._cellSize / 2) / this._cellSize),
        };
    }

    /** 渲染棋盘格与小偷 */
    renderGrid(session: GameSession): void {
        this._gridSize = session.gridSize;
        this.clearCellNodes();
        const level = session.getLevel();
        this.thiefCaught = false;

        const half = this._gridSize / 2;
        for (let x = -half; x < half; x++) {
            for (let y = -half; y < half; y++) {
                const coord = { x, y };
                if (coord.x === level.thief.x && coord.y === level.thief.y) continue;
                this.renderSingleCell(coord, this.cellFrame(coord));
            }
        }

        this.thiefFrames = [
            this.frames?.thiefNormal ?? this.thiefSpriteFrame,
            this.frames?.thiefPeekLeft ?? null,
            this.frames?.thiefNormal ?? this.thiefSpriteFrame,
            this.frames?.thiefPeekRight ?? null,
        ].filter((f): f is SpriteFrame => !!f);
        if (this.thiefFrames.length === 0) {
            console.error('[BoardGrid] 小偷素材加载失败，棋盘上的小偷将不可见');
        }
        this.thiefNode = createNode('Thief', this.node, { width: 56, height: 56 }, this.cellToLocal(level.thief));
        addSprite(this.thiefNode, this.thiefFrames[0] ?? null, { size: { width: 56, height: 56 } });
    }

    /** 四角格子使用带路口斑马线纹理的素材 */
    private cellFrame(coord: Coord): SpriteFrame | null {
        const half = this._gridSize / 2;
        const isCorner = (coord.x === -half || coord.x === half - 1) && (coord.y === -half || coord.y === half - 1);
        if (isCorner && this.frames?.cellCorner) return this.frames.cellCorner;
        return this.frames?.cellNormal ?? this.boardSpriteFrame;
    }

    private renderSingleCell(coord: Coord, frame: SpriteFrame | null): void {
        const node = createNode(`Cell_${coord.x}_${coord.y}`, this.node,
            { width: this._cellSize, height: this._cellSize }, this.cellToLocal(coord));
        addSprite(node, frame, { size: { width: this._cellSize, height: this._cellSize } });
        this.cellNodes.push(node);
    }

    /** 落点预览：合法/非法使用不同贴图 */
    showGhost(cells: readonly Coord[], valid: boolean): void {
        this.clearGhost();
        const frame = (valid ? this.frames?.ghostValid : this.frames?.ghostInvalid) ?? null;
        for (const coord of cells) {
            if (!this.isValidCoord(coord)) continue;
            const node = createNode(`Ghost_${coord.x}_${coord.y}`, this.node,
                { width: this._cellSize, height: this._cellSize }, this.cellToLocal(coord));
            addSprite(node, frame, { size: { width: this._cellSize, height: this._cellSize } });
            this.ghostNodes.push(node);
        }
    }

    clearGhost(): void {
        for (const node of this.ghostNodes) {
            if (node.isValid) node.destroy();
        }
        this.ghostNodes = [];
    }

    /** 小偷东张西望：循环播放警惕帧 */
    stepThiefPeek(): void {
        if (!this.thiefNode?.isValid || this.thiefCaught || this.thiefFrames.length < 3) return;
        const sprite = this.thiefNode.getComponent(Sprite);
        if (!sprite) return;
        this.peekStep = (this.peekStep + 1) % this.thiefFrames.length;
        sprite.spriteFrame = this.thiefFrames[this.peekStep];
    }

    /** 重开：解除“已抓住”状态，让小偷重新东张西望 */
    resetThiefState(): void {
        this.thiefCaught = false;
        this.peekStep = 0;
        if (!this.thiefNode?.isValid) return;
        const sprite = this.thiefNode.getComponent(Sprite);
        if (sprite) sprite.spriteFrame = this.thiefFrames[0] ?? sprite.spriteFrame;
    }

    /** 被抓：定格 + 弹一下 */
    markThiefCaught(): void {
        this.thiefCaught = true;
        if (!this.thiefNode?.isValid) return;
        const sprite = this.thiefNode.getComponent(Sprite);
        if (sprite) sprite.spriteFrame = this.thiefFrames[0] ?? sprite.spriteFrame;
        tween(this.thiefNode)
            .to(0.16, { scale: new Vec3(1.25, 1.25, 1) })
            .to(0.24, { scale: new Vec3(1, 1, 1) })
            .start();
    }

    private clearCellNodes(): void {
        for (const node of this.cellNodes) {
            if (node.isValid) node.destroy();
        }
        this.cellNodes = [];
        this.clearGhost();
        if (this.thiefNode?.isValid) this.thiefNode.destroy();
        this.thiefNode = null;
    }

    protected onDestroy(): void {
        this.clearCellNodes();
    }
}
