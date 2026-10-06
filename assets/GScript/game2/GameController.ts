import { _decorator, Component, instantiate, Node, Prefab, UITransform, Vec3 } from 'cc';
import { PrefabsCfg } from '../auto/PrefabCfg';
import { EViewLayer } from '../core/ui/EViewLayer';
import { G_VIEW_SIZE } from '../core/ui/UIManager';
import { GameSession } from './common/GameSession';
import type { Coord } from './common/GameTypes';
import { EXAMPLE_LEVEL } from './level/LevelData';
import { BoardGrid } from './piece/BoardGrid';
import type { PieceCallbacks } from './piece/DraggablePiece';
import { pieceBounds } from './piece/pieceLayout';
import { PIECE_PREFAB_KEYS } from './piece/PiecePrefabs';
import { BoardPieces } from './piece/pieces';
import { PolicePieces } from './piece/PolicePieces';
import { StructurePieces } from './piece/StructurePieces';
import { DesignFrames, loadDesignFrames, Palette } from './ui/DesignAssets';
import { GameHudView } from './ui/GameHudView';
import { GameOverlayView, GameSceneView } from './ui/GameOverlayView';
import { GameTrayView } from './ui/GameTrayView';
import { computeLayout, type GameLayout, Metrics } from './ui/Layout';
import { addSprite, createNode } from './ui/UIFactory';
const { ccclass } = _decorator;

/**
 * 游戏入口：装配设计稿 UI、棋盘、关卡自动摆放的建筑与可拖拽的警察棋子，
 * 并把交互请求交给 GameSession 判定。
 */
@ccclass('GameController')
export class GameController extends Component {
    static readonly viewLayer = EViewLayer.Anim;

    private session!: GameSession;
    private frames!: DesignFrames;
    private layout!: GameLayout;
    private boardGrid!: BoardGrid;
    private hud!: GameHudView;
    private tray!: GameTrayView;
    private overlays!: GameOverlayView;
    private sceneView!: GameSceneView;
    private pieceLayer!: Node;

    private readonly pieces = new Map<string, PolicePieces>();
    private started = false;
    private over = false;
    private coachShown = false;

    private readonly callbacks: PieceCallbacks = {
        place: (pieceId, anchor) => this.placePiece(pieceId, anchor),
        rotate: (pieceId) => this.rotatePiece(pieceId),
    };

    protected onLoad(): void {
        const transform = this.node.getComponent(UITransform) ?? this.node.addComponent(UITransform);
        transform.setContentSize(G_VIEW_SIZE.width, G_VIEW_SIZE.height);
        this.session = new GameSession(EXAMPLE_LEVEL, BoardPieces);
    }

    protected async start(): Promise<void> {
        this.layout = computeLayout();
        this.frames = await loadDesignFrames();
        this.buildViews();
        await this.buildBoard();
        await this.buildStructures();
        await this.buildPolice();

        this.overlays.bindStart(() => this.onStart());
        this.overlays.bindAgain(() => this.onRestart());
        this.overlays.showStart();
        this.setPiecesInteractable(false);
        this.updateHud();
        this.startTimers();
    }

    // ---------------------------------------------------------------- 视图装配

    private buildViews(): void {
        this.sceneView = new GameSceneView(this.node, this.frames, this.layout);

        const boardSize = { width: Metrics.boardOuter, height: Metrics.boardOuter };
        const panel = createNode('BoardPanel', this.node, boardSize, new Vec3(0, this.layout.boardY, 0));
        addSprite(panel, this.frames.cardBg, { size: boardSize, sliced: true, color: Palette.ink });

        this.hud = new GameHudView(this.node, this.frames, this.layout, {
            onUndo: () => this.onUndo(),
            onRestart: () => this.onRestart(),
        });
        this.tray = new GameTrayView(this.node, this.frames, this.layout, this.session.getPoliceIds().length);
        // 拖拽层必须盖在托盘之上，弹层再盖住拖拽层
        this.pieceLayer = createNode('PieceLayer', this.node, { width: this.layout.width, height: this.layout.height });
        this.overlays = new GameOverlayView(this.node, this.frames, this.layout);
    }

    private async buildBoard(): Promise<void> {
        const prefab = await gCtrl.res.loadAssetAsync(PrefabsCfg.BoardGridView, Prefab);
        if (!prefab) {
            console.error('[GameController] 加载棋盘预制体失败');
            return;
        }
        const node = instantiate(prefab);
        node.parent = this.node;
        node.setPosition(0, this.layout.boardY, 0);
        const panel = this.node.getChildByName('BoardPanel');
        if (panel) node.setSiblingIndex(panel.getSiblingIndex() + 1);
        this.boardGrid = node.getComponent(BoardGrid) ?? node.addComponent(BoardGrid);
        this.boardGrid.configure(this.frames);
        this.boardGrid.renderGrid(this.session);
    }

    /** 关卡数据里的建筑自动摆放为不可交互的路障 */
    private async buildStructures(): Promise<void> {
        if (!this.boardGrid) return;
        for (const placement of this.session.getLevel().buildings) {
            const piece = BoardPieces[placement.pieceId];
            const key = PIECE_PREFAB_KEYS[placement.pieceId];
            if (!piece || !key) {
                console.error(`[GameController] 关卡引用了未知建筑棋子: ${placement.pieceId}`);
                continue;
            }
            const prefab = await gCtrl.res.loadAssetAsync(PrefabsCfg[key], Prefab);
            if (!prefab) {
                console.error(`[GameController] 加载建筑预制体失败: ${placement.pieceId}`);
                continue;
            }
            const node = instantiate(prefab);
            node.parent = this.boardGrid.node;
            node.setPosition(this.boardGrid.cellToLocal(placement.anchor));
            const structure = node.getComponent(StructurePieces) ?? node.addComponent(StructurePieces);
            structure.init(piece, placement.anchor, placement.rotation, this.boardGrid.cellSize);
        }
    }

    /** 警察棋子按目录顺序进入托盘槽位 */
    private async buildPolice(): Promise<void> {
        if (!this.boardGrid) return;
        const policeIds = this.session.getPoliceIds();
        for (let i = 0; i < policeIds.length; i++) {
            const pieceId = policeIds[i];
            const piece = BoardPieces[pieceId];
            const key = PIECE_PREFAB_KEYS[pieceId];
            if (!piece || !key) {
                console.error(`[GameController] 未知警察棋子: ${pieceId}`);
                continue;
            }
            const prefab = await gCtrl.res.loadAssetAsync(PrefabsCfg[key], Prefab);
            if (!prefab) {
                console.error(`[GameController] 加载警察预制体失败: ${pieceId}`);
                continue;
            }
            const node = instantiate(prefab);
            const slot = this.tray.getSlot(i);
            node.parent = slot;

            const cellSize = this.boardGrid.cellSize;
            const bounds = pieceBounds(piece, 0);
            const trayScale = Math.min(
                0.62,
                (Metrics.slotWidth - 20) / (bounds.width * cellSize),
                (Metrics.slotHeight - 16) / (bounds.height * cellSize),
            );

            const component = node.getComponent(PolicePieces) ?? node.addComponent(PolicePieces);
            component.init({
                pieceId,
                piece,
                session: this.session,
                boardGrid: this.boardGrid,
                callbacks: this.callbacks,
                dragLayer: this.pieceLayer,
                traySlot: slot,
                cellFrame: this.frames.policeCell,
                dragCellFrame: this.frames.policeCellDrag,
                trayScale,
            });
            this.pieces.set(pieceId, component);
        }
    }

    // ---------------------------------------------------------------- 游戏流程

    private onStart(): void {
        this.overlays.hideStart();
        this.started = true;
        this.setPiecesInteractable(true);
    }

    /** 延迟弹出胜利卡片；重开时需要能取消，避免旧卡片盖在新一局上 */
    private readonly showWinDelayed = (): void => {
        if (!this.over) return;
        this.overlays.showWin(this.session.stars, this.session.moveCount);
    };

    private placePiece(pieceId: string, anchor: Coord): boolean {
        if (!this.started || this.over) return false;
        if (!this.session.place(pieceId, anchor)) return false;
        this.updateHud();
        this.showCoachOnce(pieceId);
        this.checkWin();
        return true;
    }

    private rotatePiece(pieceId: string): boolean {
        if (!this.started || this.over) return false;
        // 已上场：原地转向（需要落点合法）；还在托盘：只是换个朝向
        const rotated = this.session.rotate(pieceId) || this.session.rotateInTray(pieceId);
        if (!rotated) return false;
        this.updateHud();
        this.checkWin();
        return true;
    }

    private checkWin(): void {
        if (!this.session.captured) return;
        this.over = true;
        this.setPiecesInteractable(false);
        this.boardGrid.markThiefCaught();
        this.unschedule(this.showWinDelayed);
        this.scheduleOnce(this.showWinDelayed, 0.7);
    }

    private onUndo(): void {
        if (!this.started || this.over) return;
        if (!this.session.undo()) return;
        this.syncPieces();
        this.updateHud();
    }

    private onRestart(): void {
        this.unschedule(this.showWinDelayed);
        this.session.reset();
        this.over = false;
        this.coachShown = false;
        this.boardGrid.resetThiefState();
        this.overlays.hideWin();
        this.syncPieces();
        this.setPiecesInteractable(this.started);
        this.updateHud();
    }

    private updateHud(): void {
        this.hud.setMoves(this.session.moveCount, this.session.getPoliceIds().length);
        this.hud.setUndoEnabled(this.session.undoCount > 0);
    }

    private setPiecesInteractable(value: boolean): void {
        this.pieces.forEach(piece => piece.setInteractable(value));
    }

    private syncPieces(): void {
        this.pieces.forEach(piece => piece.syncFromSession());
    }

    private showCoachOnce(pieceId: string): void {
        if (this.coachShown) return;
        const piece = this.pieces.get(pieceId);
        if (!piece) return;
        this.coachShown = true;
        const bubble = this.hud.showCoach('点一下棋子可以转向', piece.node.getWorldPosition());
        if (bubble) this.scheduleOnce(() => { if (bubble.isValid) bubble.destroy(); }, 2.2);
    }

    private startTimers(): void {
        this.schedule(() => this.hud.toggleSiren(), 0.55);
        this.schedule(() => this.sceneView.toggleCarLight(), 0.55);
        this.schedule(() => this.boardGrid.stepThiefPeek(), 1.1);
    }
}
