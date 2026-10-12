import { _decorator, Color, Component, Node, UITransform, Vec3 } from 'cc';
import { EViewLayer } from '../../core/ui/EViewLayer';
import { G_VIEW_SIZE } from '../../core/ui/UIManager';
import { GameController } from '../GameController';
import { currentLevelId, selectLevel } from '../level/LevelSelection';
import { getIndex, getNextId } from '../level/LevelCatalog';

import { MenuController } from './MenuController';
import { DesignFrames, loadDesignFrames } from './DesignAssets';
import { computeMenuMetrics, type MenuMetrics } from './MenuWidgets';
import { ResultView } from './ResultView';
import { addSprite, createNode } from '../../core/ui/UIFactory';
const { ccclass } = _decorator;

/**
 * 结算入口：展示巡逻报告，并负责前往下一关 / 重开本关 / 返回主菜单。
 */
@ccclass('ResultController')
export class ResultController extends Component {
    static readonly viewLayer = EViewLayer.UI;

    /** 上一局实际部署步数，由 GameController 在打开结算前写入 */
    static lastMoves: number | null = null;

    private frames!: DesignFrames;
    private m!: MenuMetrics;
    private stage!: Node;

    protected onLoad(): void {
        const transform = this.node.getComponent(UITransform) ?? this.node.addComponent(UITransform);
        transform.setContentSize(G_VIEW_SIZE.width, G_VIEW_SIZE.height);
    }

    protected async start(): Promise<void> {
        this.m = computeMenuMetrics();
        this.stage = createNode('ResultStage', this.node,
            { width: this.m.width, height: this.m.height }, new Vec3(0, 0, 0));
        this.frames = await loadDesignFrames();
        if (!this.isValid || !this.node.isValid) return;

        // 宽屏设备上 stage 两侧露出的区域用底色填满，避免黑边
        const backdrop = createNode('Backdrop', this.node,
            { width: G_VIEW_SIZE.width, height: G_VIEW_SIZE.height }, new Vec3(0, 0, -1));
        addSprite(backdrop, this.frames.solid, {
            size: { width: G_VIEW_SIZE.width, height: G_VIEW_SIZE.height },
            color: new Color(244, 248, 236, 255),
        });
        // 2D UI 的渲染先后由 siblingIndex 决定，z 坐标不生效；backdrop 比 stage
        // 后创建，不挪回底层就会把整个 stage 盖住
        backdrop.setSiblingIndex(0);

        const levelIndex = getIndex(currentLevelId()) + 1;
        new ResultView(this.stage, this.m, this.frames, {
            onNext: () => this.onNext(),
            onReplay: () => this.onReplay(),
            onShare: () => { /* 平台分享能力尚未接入，预留入口 */ },
            onMenu: () => this.onHome(),
        }, {
            levelIndex: levelIndex > 0 ? levelIndex : undefined,
            moves: ResultController.lastMoves,
            hasNext: getNextId(currentLevelId()) !== null,
        });
    }

    /** 下一关：有下一关时带 id 进对局；已全部通关时按钮由 ResultView 置灰屏蔽 */
    private onNext(): void {
        const nextId = getNextId(currentLevelId());
        if (!nextId) return;
        selectLevel(nextId);
        void gCtrl.ui.open(GameController)
            .then(() => this.node.destroy())
            .catch(err => console.error('[ResultController] 进入下一关失败', err));
    }

    /** 重开本关：显式重选当前关卡，避免沿用上一局的选择状态 */
    private onReplay(): void {
        selectLevel(currentLevelId());
        void gCtrl.ui.open(GameController)
            .then(() => this.node.destroy())
            .catch(err => console.error('[ResultController] 重开本关失败', err));
    }

    /** 返回主菜单：菜单仍在（结算由对局内直接打开）时不重复创建 */
    private onHome(): void {
        if (!gCtrl.ui.isOpened(MenuController)) {
            void gCtrl.ui.open(MenuController)
                .then(() => this.node.destroy())
                .catch(err => console.error('[ResultController] 返回主菜单失败', err));
            return;
        }
        this.node.destroy();
    }
}
