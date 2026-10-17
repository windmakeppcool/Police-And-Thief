import { _decorator, Component, instantiate, Node, Prefab, UITransform, Vec3 } from 'cc';
import { PrefabsCfg } from '../auto/PrefabCfg';
import { EViewLayer } from '../core/ui/EViewLayer';
import { G_VIEW_SIZE } from '../core/ui/UIManager';
import { AudioManager } from '../core/audio/AudioManager';
import { GameSession } from './common/GameSession';
import type { Coord } from './common/GameTypes';
import { currentLevelId, DEFAULT_LEVEL_ID } from './level/LevelSelection';
import { getIndex } from './level/LevelCatalog';
import { loadLevel } from './LevelRepository';
import { ProgressStore } from './ProgressStore';
import { BoardGrid } from './piece/BoardGrid';
import type { PieceCallbacks } from './piece/DraggablePiece';
import { pieceBounds } from './piece/pieceLayout';
import { PIECE_PREFAB_KEYS } from './piece/PiecePrefabs';
import { BoardPieces } from './piece/pieces';
import { PolicePieces } from './piece/PolicePieces';
import { StructurePieces } from './piece/StructurePieces';
import { DesignFrames, loadDesignFrames, PocketPalette } from './ui/DesignAssets';
import { GameHudView } from './ui/GameHudView';
import { GameOverlayView, GameSceneView } from './ui/GameOverlayView';
import { MenuController } from './ui/MenuController';
import { ResultController } from './ui/ResultController';
import { GameTrayView } from './ui/GameTrayView';
import { computeLayout, type GameLayout, Metrics } from './ui/Layout';
import { addSprite, createNode } from '../core/ui/UIFactory';
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
    /** 暂停态：冻结装饰定时器、屏蔽棋子交互，由暂停弹层控制 */
    private paused = false;

    /** level_01 首次游玩的分步引导是否启用（已完成引导的旧玩家不再触发） */
    private guideEnabled = false;
    /** 当前引导步数：0=尚未开始，1..4 对应四步提示，4=已到最后一步 */
    private guideStep = 0;
    /** 当前展示中的引导气泡；一次只显示一条 */
    private guideBubble: Node | null = null;

    private readonly callbacks: PieceCallbacks = {
        place: (pieceId, anchor) => this.placePiece(pieceId, anchor),
        rotate: (pieceId) => this.rotatePiece(pieceId),
        remove: (pieceId) => this.removePiece(pieceId),
        illegal: () => AudioManager.getInstance().playSfx('invalid'),
    };

    protected onLoad(): void {
        const transform = this.node.getComponent(UITransform) ?? this.node.addComponent(UITransform);
        transform.setContentSize(G_VIEW_SIZE.width, G_VIEW_SIZE.height);
    }

    protected async start(): Promise<void> {
        // 关卡是 JSON 资源，必须异步加载；onLoad 里还拿不到
        const levelId = currentLevelId();
        const level = await loadLevel(levelId);
        if (!level) {
            console.error(`[GameController] 关卡 ${levelId} 校验失败，拒绝进入该关`);
            // 菜单层仍在下方，销毁对局节点即可回到关卡选择
            this.abortToMenu();
            return;
        }
        if (!this.isValid || !this.node.isValid) return;
        this.session = new GameSession(level, BoardPieces);

        this.layout = computeLayout();
        this.frames = await loadDesignFrames();
        if (!this.isValid || !this.node.isValid) return;
        this.buildViews();
        if (!(await this.buildBoard())) return;
        await this.buildStructures();
        if (!this.isValid || !this.node.isValid) return;
        await this.buildPolice();
        if (!this.isValid || !this.node.isValid) return;

        this.overlays.bindStart(() => this.onStart());
        this.overlays.bindAgain(() => this.resetSession());
        this.overlays.bindReport(() => this.onShowReport());
        this.overlays.bindPauseResume(() => this.resumeGame());
        this.overlays.bindPauseRestart(() => this.resetSession());
        this.overlays.bindPauseExit(() => this.abortToMenu());
        this.overlays.bindRestartConfirm(() => this.confirmRestart());
        this.overlays.bindRestartCancel(() => this.overlays.hideRestartConfirm());
        this.overlays.showStart();
        this.setPiecesInteractable(false);
        // 未开局时 HUD 的撤销/重开不响应；开始巡逻后才放行
        this.hud.setActionsEnabled(false);
        this.updateHud();
        // 仅 level_01 首次游玩启用分步引导；旧存档 guideDone 默认 false，完成一次后永久关闭
        this.guideEnabled = currentLevelId() === DEFAULT_LEVEL_ID && !ProgressStore.isGuideDone();
        this.startTimers();
    }

    // ---------------------------------------------------------------- 视图装配

    private buildViews(): void {
        this.sceneView = new GameSceneView(this.node, this.frames, this.layout);

        const boardSize = { width: Metrics.boardOuter, height: Metrics.boardOuter };
        const panel = createNode('BoardPanel', this.node, boardSize, new Vec3(0, this.layout.boardY, 0));
        addSprite(panel, this.frames.cardBg, { size: boardSize, sliced: true, color: PocketPalette.ink });

        const levelIndex = getIndex(currentLevelId()) + 1;
        this.hud = new GameHudView(this.node, this.frames, this.layout, {
            onUndo: () => this.onUndo(),
            onRestart: () => this.askRestart(),
            onPause: () => this.pauseGame(),
        }, levelIndex > 0 ? levelIndex : undefined);
        // 托盘只为关卡未预置的警察棋子造槽位；预置锁定的开局就在棋盘上
        this.tray = new GameTrayView(this.node, this.frames, this.layout, this.session.getTrayPoliceIds().length);
        // 拖拽层必须盖在托盘之上，弹层再盖住拖拽层
        this.pieceLayer = createNode('PieceLayer', this.node, { width: this.layout.width, height: this.layout.height });
        this.overlays = new GameOverlayView(this.node, this.frames, this.layout);
    }

    /** 返回棋盘是否装配成功；失败时已走销毁自身 + 回菜单的恢复路径 */
    private async buildBoard(): Promise<boolean> {
        const prefab = await gCtrl.res.loadAssetAsync(PrefabsCfg.BoardGridView, Prefab);
        if (!prefab) {
            console.error('[GameController] 加载棋盘预制体失败');
            this.abortToMenu();
            return false;
        }
        if (!this.isValid || !this.node.isValid) return false;
        const node = instantiate(prefab);
        node.parent = this.node;
        node.setPosition(0, this.layout.boardY, 0);
        const panel = this.node.getChildByName('BoardPanel');
        if (panel) node.setSiblingIndex(panel.getSiblingIndex() + 1);
        this.boardGrid = node.getComponent(BoardGrid) ?? node.addComponent(BoardGrid);
        this.boardGrid.configure(this.frames);
        this.boardGrid.renderGrid(this.session);
        return true;
    }

    /** 致命资源/关卡错误的统一恢复：销毁对局节点并回到主菜单（菜单已在则不重复打开） */
    private abortToMenu(): void {
        this.node.destroy();
        if (!gCtrl.ui.isOpened(MenuController)) {
            void gCtrl.ui.open(MenuController)
                .catch(err => console.error('[GameController] 返回主菜单失败', err));
        }
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
            if (!this.isValid || !this.node.isValid) return;
            const node = instantiate(prefab);
            node.parent = this.boardGrid.node;
            node.setPosition(this.boardGrid.cellToLocal(placement.anchor));
            const structure = node.getComponent(StructurePieces) ?? node.addComponent(StructurePieces);
            structure.init(piece, placement.anchor, placement.rotation, this.boardGrid.cellSize);
        }
    }

    /**
     * 警察棋子分两类装配：
     * - 关卡预置的：锁定摆在棋盘 anchor 上，不可拖拽/转向；
     * - 其余的：按目录顺序进入托盘槽位，玩家拖上场。
     */
    private async buildPolice(): Promise<void> {
        if (!this.boardGrid) return;

        for (const pieceId of this.session.getPresetPoliceIds()) {
            const piece = BoardPieces[pieceId];
            const key = PIECE_PREFAB_KEYS[pieceId];
            if (!piece || !key) {
                console.error(`[GameController] 未知预置警察棋子: ${pieceId}`);
                continue;
            }
            const prefab = await gCtrl.res.loadAssetAsync(PrefabsCfg[key], Prefab);
            if (!prefab) {
                console.error(`[GameController] 加载警察预制体失败: ${pieceId}`);
                continue;
            }
            if (!this.isValid || !this.node.isValid) return;
            const node = instantiate(prefab);
            node.parent = this.boardGrid.node;
            const component = node.getComponent(PolicePieces) ?? node.addComponent(PolicePieces);
            component.initLocked({
                pieceId,
                piece,
                session: this.session,
                boardGrid: this.boardGrid,
                cellFrame: this.frames.policeCell,
            });
            this.pieces.set(pieceId, component);
        }

        const trayIds = this.session.getTrayPoliceIds();
        for (let i = 0; i < trayIds.length; i++) {
            const pieceId = trayIds[i];
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
            if (!this.isValid || !this.node.isValid) return;
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
        this.hud.setActionsEnabled(true);
        // 引导第 1 步：提示把警察从托盘拖到棋盘
        this.advanceGuide(1);
        // 极端关卡（例如 6 枚警察全部预置）开局就可能同时满足「围住 + 全部上场」，
        // 此时棋盘上没有可落子/可转向的棋子，必须在这里补一次判定，否则游戏会卡住。
        this.checkWin();
    }

    /** 延迟弹出胜利卡片；重开时需要能取消，避免旧卡片盖在新一局上 */
    private readonly showWinDelayed = (): void => {
        if (!this.over) return;
        AudioManager.getInstance().playSfx('win');
        this.overlays.showWin();
    };

    private placePiece(pieceId: string, anchor: Coord): boolean {
        if (!this.started || this.over || this.paused) return false;
        if (!this.session.place(pieceId, anchor)) return false;
        AudioManager.getInstance().playSfx('place');
        this.updateHud();
        // 引导第 2 步：首次放子后提示点按转向
        this.advanceGuide(2, pieceId);
        this.checkWin();
        return true;
    }

    /** 撤下已上场的棋子：不会产生胜利，只更新在场数 */
    private removePiece(pieceId: string): boolean {
        if (!this.started || this.over || this.paused) return false;
        if (!this.session.remove(pieceId)) return false;
        AudioManager.getInstance().playSfx('remove');
        this.updateHud();
        // 引导第 3 步：首次撤下后提示可以拖出棋盘收回
        this.advanceGuide(3);
        return true;
    }

    private rotatePiece(pieceId: string): boolean {
        if (!this.started || this.over || this.paused) return false;
        // 已上场：原地转向（需要落点合法）；还在托盘：只是换个朝向
        const rotated = this.session.rotate(pieceId) || this.session.rotateInTray(pieceId);
        if (!rotated) return false;
        AudioManager.getInstance().playSfx('rotate');
        this.updateHud();
        this.checkWin();
        return true;
    }

    private checkWin(): void {
        // 获胜要同时满足：小偷被围住 + 六枚警力全部就位
        if (!this.session.won) return;
        this.over = true;
        // 胜利时若处于异常暂停态也要一并清掉，避免定时器继续冻结
        this.paused = false;
        this.setPiecesInteractable(false);
        this.boardGrid.markThiefCaught();
        // 引导第 4 步：获胜瞬间提示通关条件，展示后本关引导永久完成
        this.advanceGuide(4);
        this.unschedule(this.showWinDelayed);
        this.scheduleOnce(this.showWinDelayed, 0.7);
    }

    private onUndo(): void {
        if (!this.started || this.over || this.paused) return;
        if (!this.session.undo()) return;
        AudioManager.getInstance().playSfx('undo');
        this.syncPieces();
        this.updateHud();
    }

    /** HUD 重开按钮：未开局不响应；对局中先弹二次确认小弹层 */
    private askRestart(): void {
        if (!this.started || this.over || this.paused) return;
        if (this.overlays.modalVisible) return;
        this.overlays.showRestartConfirm();
    }

    /** 重开确认弹层里点「重新开始」：关弹层后真正重开 */
    private confirmRestart(): void {
        this.overlays.hideRestartConfirm();
        this.resetSession();
    }

    /** 真正执行重开：暂停弹层/胜利卡内的重开走这里，不再二次确认 */
    private resetSession(): void {
        this.unschedule(this.showWinDelayed);
        this.paused = false;
        this.session.reset();
        this.over = false;
        this.boardGrid.resetThiefState();
        this.overlays.hideWin();
        this.overlays.hidePause();
        this.overlays.hideRestartConfirm();
        this.syncPieces();
        this.setPiecesInteractable(this.started);
        this.updateHud();
        // 首次游玩本关且尚未完成引导时，重开后从第 1 步重新引导；否则不弹
        this.dismissGuide();
        this.guideStep = 0;
        if (this.guideEnabled && this.started) this.advanceGuide(1);
        // 与 onStart 同理：全预置关卡重开后依旧没有可操作棋子，补一次胜利判定
        this.checkWin();
    }

    /** 前往结算页：记录通关进度后再打开结算，最后销毁对局节点 */
    private onShowReport(): void {
        this.unschedule(this.showWinDelayed);
        // 打开结算前先登记通关（去重保存），并把本局步数带给结算页展示
        ProgressStore.markCleared(currentLevelId());
        ResultController.lastMoves = this.session.moveCount;
        this.node.destroy();
        void gCtrl.ui.open(ResultController).catch(err => console.error('[GameController] 打开结算页失败', err));
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

    // ---------------------------------------------------------------- 暂停 / 恢复

    /** HUD 暂停按钮：仅对局中可暂停，且不与其它模态弹层叠加 */
    private pauseGame(): void {
        if (!this.started || this.over || this.paused) return;
        if (this.overlays.modalVisible) return;
        this.paused = true;
        // 暂停期间棋子不可交互；装饰动画在定时器回调里跳过
        this.setPiecesInteractable(false);
        this.overlays.showPause();
    }

    /** 暂停弹层「继续游戏」：恢复定时器与棋子交互 */
    private resumeGame(): void {
        if (!this.paused) return;
        this.paused = false;
        this.overlays.hidePause();
        this.setPiecesInteractable(true);
    }

    // ---------------------------------------------------------------- 新手引导

    /**
     * 把引导推进到指定步数：只进不退（可按玩家已达成的最高进度跳步），
     * 暂停期间不推进、不弹气泡，一次只显示一条。
     */
    private advanceGuide(step: number, pieceId?: string): void {
        if (!this.guideEnabled || this.paused) return;
        if (step <= this.guideStep) return;
        this.guideStep = step;

        let anchor: Vec3 | null = null;
        let text = '';
        let width = 200;
        if (step === 1) {
            // 指向托盘：锚点取托盘顶边，气泡抬升后正好浮在托盘上方
            text = '把警察拖到棋盘上';
            anchor = this.tray.node.getWorldPosition().add(new Vec3(0, Metrics.trayHeight / 2, 0));
            width = 220;
        } else if (step === 2) {
            text = '点一下棋子可以转向';
            const piece = pieceId ? this.pieces.get(pieceId) : undefined;
            anchor = piece ? piece.node.getWorldPosition() : null;
        } else if (step === 3) {
            text = '拖出棋盘可以收回哦';
            anchor = this.tray.node.getWorldPosition().add(new Vec3(0, Metrics.trayHeight / 2, 0));
            width = 220;
        } else {
            text = '全部放好、围住小偷就赢啦！';
            // 用棋盘节点的世界坐标，避免依赖对局节点本身位于原点
            anchor = this.boardGrid.node.getWorldPosition();
            width = 280;
        }

        this.dismissGuide();
        if (!anchor) return;
        const bubble = this.hud.showCoach(text, anchor, width);
        this.guideBubble = bubble;
        if (bubble) {
            // 保留原有 2.2s 自动消失；回调期间若处于暂停则顺延到恢复后再销毁
            this.scheduleOnce(this.dismissGuideScheduled, 2.2);
        }

        if (step === 4) {
            // 走到最后一步：引导永久完成并落盘，本关之后（含再来一局）不再弹
            this.guideEnabled = false;
            ProgressStore.setGuideDone(true);
        }
    }

    /** 自动消失回调：暂停期间不销毁气泡，顺延一次等待恢复 */
    private readonly dismissGuideScheduled = (): void => {
        if (this.paused) {
            this.scheduleOnce(this.dismissGuideScheduled, 0.3);
            return;
        }
        this.dismissGuide();
    };

    /** 立即收起当前引导气泡并取消待执行的自动消失 */
    private dismissGuide(): void {
        this.unschedule(this.dismissGuideScheduled);
        if (this.guideBubble && this.guideBubble.isValid) this.guideBubble.destroy();
        this.guideBubble = null;
    }

    private startTimers(): void {
        // 暂停态直接跳过本次回调，动画冻结在当前帧，恢复后继续
        this.schedule(() => { if (!this.paused) this.hud.toggleSiren(); }, 0.55);
        this.schedule(() => { if (!this.paused) this.sceneView.toggleCarLight(); }, 0.55);
        this.schedule(() => { if (!this.paused) this.boardGrid.stepThiefPeek(); }, 1.1);
    }

    protected onDestroy(): void {
        // 组件销毁时停掉所有定时器（装饰闪烁、胜利延迟、引导自动消失），避免回调落在已销毁节点上
        this.unscheduleAllCallbacks();
        if (this.guideBubble && this.guideBubble.isValid) this.guideBubble.destroy();
        this.guideBubble = null;
    }
}
