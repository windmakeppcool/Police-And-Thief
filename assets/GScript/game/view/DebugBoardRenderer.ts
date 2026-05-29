import { _decorator, Color, Component, Layers, Node, Size, Sprite, SpriteFrame, UITransform, assetManager } from 'cc';
import { getAbsoluteCells } from '../domain/PieceGeometry';
import { type Coord, type ShapeCatalog } from '../domain/GameTypes';
import { GameSession } from '../service/GameSession';
import { BoardGridView } from './BoardGridView';
const { ccclass, property } = _decorator;

const COLOR_EMPTY = new Color(230, 233, 240, 255);  // 浅灰蓝
const COLOR_BUILDING = new Color(148, 163, 184, 255);  // 暖灰
const COLOR_THIEF = new Color(239, 68, 68, 255);    // 红
const COLOR_POLICE = new Color(59, 130, 246, 255);   // 蓝
const COLOR_STROKE = new Color(203, 213, 225, 255);  // 淡边框

@ccclass('DebugBoardRenderer')
export class DebugBoardRenderer extends Component {
    @property(Number) public cellPadding = 2;

    private cellNodes: Node[] = [];
    private _whiteFrame: SpriteFrame | null = null;

    /** 加载白色纹理后开始渲染 */
    async initAndRender(session: GameSession, shapes: ShapeCatalog): Promise<void> {
        if (!this._whiteFrame) {
            try {
                this._whiteFrame = await this.loadWhiteFrame();
            } catch (e) {
                console.error('[DebugBoardRenderer] failed to init:', e);
                return;
            }
        }
        this.renderSession(session, shapes);
    }

    /** 重新渲染（需要先 initAndRender） */
    refreshRender(session: GameSession, shapes: ShapeCatalog): void {
        if (!this._whiteFrame) {
            console.error('[DebugBoardRenderer] not initialized, call initAndRender first');
            return;
        }
        this.renderSession(session, shapes);
    }

    private renderSession(session: GameSession, shapes: ShapeCatalog): void {
        const level = session.getLevel();
        const gridView = this.getOrAdd(BoardGridView);
        gridView.cellSize = 64;
        gridView.resizeBoard(level.board);

        // 清理旧格子
        for (const n of this.cellNodes) {
            if (n.isValid) n.destroy();
        }
        this.cellNodes = [];

        const sf = this._whiteFrame;
        if (!sf) {
            console.error('[DebugBoardRenderer] white frame not loaded');
            return;
        }

        // 先画全部空格
        for (let y = 0; y < level.board.height; y++) {
            for (let x = 0; x < level.board.width; x++) {
                this.addCellNode(gridView, level.board, { x, y }, sf, COLOR_EMPTY, COLOR_STROKE);
            }
        }

        // 建筑
        for (const building of level.buildings) {
            for (const cell of getAbsoluteCells(shapes, building)) {
                this.addCellNode(gridView, level.board, cell, sf, COLOR_BUILDING, COLOR_STROKE);
            }
        }

        // 已放置警察
        for (const police of session.getPlacedPolice()) {
            for (const cell of getAbsoluteCells(shapes, police)) {
                this.addCellNode(gridView, level.board, cell, sf, COLOR_POLICE, COLOR_STROKE);
            }
        }

        // 小偷（最后画，覆盖在上面）
        this.addCellNode(gridView, level.board, level.thief, sf, COLOR_THIEF, COLOR_STROKE);
    }

    private addCellNode(
        gridView: BoardGridView,
        board: { width: number; height: number },
        coord: Coord,
        sf: SpriteFrame,
        fillColor: Color,
        borderColor: Color
    ): void {
        const center = gridView.boardToLocal(coord, board);
        const borderSize = 64;
        const innerSize = Math.max(0, borderSize - this.cellPadding * 2);

        // 外层 = 边框色
        const borderNode = new Node(`cell_${coord.x}_${coord.y}_border`);
        borderNode.layer = Layers.Enum.UI_2D;
        borderNode.parent = this.node;
        const borderSprite = borderNode.addComponent(Sprite);
        borderSprite.sizeMode = Sprite.SizeMode.CUSTOM;
        borderSprite.trim = false;
        borderSprite.spriteFrame = sf;
        borderSprite.color = borderColor;
        const borderTrans = borderNode.getComponent(UITransform) || borderNode.addComponent(UITransform);
        borderTrans.setContentSize(new Size(64, 64));
        borderNode.setPosition(center.x, center.y, 0);

        // 内层 = 填充色
        const innerNode = new Node(`cell_${coord.x}_${coord.y}_fill`);
        innerNode.layer = Layers.Enum.UI_2D;
        innerNode.parent = borderNode;
        const innerSprite = innerNode.addComponent(Sprite);
        innerSprite.sizeMode = Sprite.SizeMode.CUSTOM;
        innerSprite.trim = false;
        innerSprite.spriteFrame = sf;
        innerSprite.color = fillColor;
        const innerTrans = innerNode.getComponent(UITransform) || innerNode.addComponent(UITransform);
        innerTrans.setContentSize(new Size(innerSize, innerSize));

        this.cellNodes.push(borderNode);
    }

    private async loadWhiteFrame(): Promise<SpriteFrame> {
        const bundle = await this.getOrLoadBundle('GameBN');
        if (!bundle) {
            throw new Error('[DebugBoardRenderer] GameBN bundle not loaded');
        }

        const candidates = ['Image/white/spriteFrame', 'Image/white'];
        for (const path of candidates) {
            const frame = await this.loadFromBundle(bundle, path, SpriteFrame);
            if (frame) return frame;
        }

        throw new Error(`[DebugBoardRenderer] failed to load white texture, tried: ${candidates.join(', ')}`);
    }

    private getOrLoadBundle(bundleName: string): Promise<ReturnType<typeof assetManager.getBundle>> {
        const existed = assetManager.getBundle(bundleName);
        if (existed) return Promise.resolve(existed);
        return new Promise((resolve) => {
            assetManager.loadBundle(bundleName, (err, bundle) => {
                if (err || !bundle) {
                    console.error(`[DebugBoardRenderer] failed to load bundle ${bundleName}:`, err);
                    resolve(null);
                    return;
                }
                resolve(bundle);
            });
        });
    }

    private loadFromBundle<T>(bundle: NonNullable<ReturnType<typeof assetManager.getBundle>>, path: string, type: new () => T): Promise<T | null> {
        return new Promise((resolve) => {
            bundle.load(path, type as any, (err, asset) => {
                if (err || !asset) {
                    resolve(null);
                    return;
                }
                resolve(asset as T);
            });
        });
    }

    private getOrAdd<T extends Component>(Ctor: new () => T): T {
        const existed = this.getComponent(Ctor);
        if (existed) return existed;
        return this.addComponent(Ctor);
    }
}
