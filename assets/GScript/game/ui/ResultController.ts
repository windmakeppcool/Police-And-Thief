import { _decorator, Color, Component, Node, UITransform, Vec3 } from 'cc';
import { EViewLayer } from '../../core/ui/EViewLayer';
import { G_VIEW_SIZE } from '../../core/ui/UIManager';
import { GameController } from '../GameController';
import { MenuController } from './MenuController';
import { DesignFrames, loadDesignFrames } from './DesignAssets';
import { computeMenuMetrics, type MenuMetrics } from './MenuWidgets';
import { ResultView } from './ResultView';
import { addSprite, createNode } from './UIFactory';
const { ccclass } = _decorator;

/**
 * 结算入口：展示巡逻报告，并负责前往下一关 / 重开本关 / 返回主菜单。
 */
@ccclass('ResultController')
export class ResultController extends Component {
    static readonly viewLayer = EViewLayer.UI;

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

        new ResultView(this.stage, this.m, this.frames, {
            onNext: () => {
                this.node.destroy();
                void gCtrl.ui.open(GameController);
            },
            onReplay: () => {
                this.node.destroy();
                void gCtrl.ui.open(GameController);
            },
            onShare: () => { /* 平台分享能力尚未接入，预留入口 */ },
            onMenu: () => {
                this.node.destroy();
                void gCtrl.ui.open(MenuController);
            },
        });
    }
}
