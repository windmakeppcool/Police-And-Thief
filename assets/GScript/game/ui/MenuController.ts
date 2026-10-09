import { _decorator, Component, Node, UITransform, Vec3 } from 'cc';
import { EViewLayer } from '../../core/ui/EViewLayer';
import { G_VIEW_SIZE } from '../../core/ui/UIManager';
import { GameController } from '../GameController';
import { DesignFrames, loadDesignFrames, PocketPalette } from './DesignAssets';
import { LevelsView } from './LevelsView';
import { MenuBootView } from './MenuBootView';
import { MenuHomeView } from './MenuHomeView';
import { ProfileView } from './ProfileView';
import { SettingsView } from './SettingsView';
import { computeMenuMetrics, type MenuMetrics } from './MenuWidgets';
import { addSprite, createNode } from './UIFactory';
const { ccclass } = _decorator;

/**
 * 口袋巡逻队主流程入口：启动加载页 → 主菜单，
 * 并负责向关卡选择 / 设置 / 个人中心以及游戏对局跳转。
 */
@ccclass('MenuController')
export class MenuController extends Component {
    static readonly viewLayer = EViewLayer.UI;

    private frames!: DesignFrames;
    private m!: MenuMetrics;
    private stage!: Node;
    private boot: MenuBootView | null = null;
    private home: MenuHomeView | null = null;
    private levels: LevelsView | null = null;
    private settings: SettingsView | null = null;
    private profile: ProfileView | null = null;

    private bootElapsed = 0;
    private readonly bootDuration = 1.2;
    private booted = false;

    protected onLoad(): void {
        const transform = this.node.getComponent(UITransform) ?? this.node.addComponent(UITransform);
        transform.setContentSize(G_VIEW_SIZE.width, G_VIEW_SIZE.height);
    }

    protected async start(): Promise<void> {
        this.m = computeMenuMetrics();
        this.stage = createNode('MenuStage', this.node,
            { width: this.m.width, height: this.m.height }, new Vec3(0, 0, 0));
        this.frames = await loadDesignFrames();

        // 宽屏设备上 414×820 stage 两侧露出的区域用底色填满，避免黑边
        const backdrop = createNode('Backdrop', this.node,
            { width: G_VIEW_SIZE.width, height: G_VIEW_SIZE.height }, new Vec3(0, 0, -1));
        addSprite(backdrop, this.frames.solid, {
            size: { width: G_VIEW_SIZE.width, height: G_VIEW_SIZE.height },
            color: PocketPalette.cream,
        });

        this.boot = new MenuBootView(this.stage, this.m, this.frames);
        this.boot.setProgress(0);
    }

    protected update(dt: number): void {
        if (this.booted || !this.boot) return;
        this.bootElapsed += dt;
        const p = Math.min(1, this.bootElapsed / this.bootDuration);
        this.boot.setProgress(p);
        if (p >= 1) {
            this.booted = true;
            this.showHome();
        }
    }

    private showHome(): void {
        if (this.boot) {
            this.boot.node.destroy();
            this.boot = null;
        }
        this.home = new MenuHomeView(this.stage, this.m, this.frames, 128, 8, {
            onStart: () => { void gCtrl.ui.open(GameController); },
            onLevels: () => this.openLevels(),
            onNavMenu: () => this.openMenu(),
            onNavSettings: () => this.openSettings(),
            onNavProfile: () => this.openProfile(),
        });
    }

    private openMenu(): void {
        // 回到主菜单：销毁其它子页
        this.clearSubPages();
        if (!this.home) {
            this.home = new MenuHomeView(this.stage, this.m, this.frames, 128, 8, {
                onStart: () => { void gCtrl.ui.open(GameController); },
                onLevels: () => this.openLevels(),
                onNavMenu: () => this.openMenu(),
                onNavSettings: () => this.openSettings(),
                onNavProfile: () => this.openProfile(),
            });
        }
    }

    private openLevels(): void {
        this.clearSubPages();
        if (this.home) {
            this.home.node.destroy();
            this.home = null;
        }
        this.levels = new LevelsView(this.stage, this.m, this.frames, 128, 8, {
            onBack: () => this.openMenu(),
            onContinue: () => { void gCtrl.ui.open(GameController); },
            onPick: () => { void gCtrl.ui.open(GameController); },
        });
    }

    private openSettings(): void {
        if (this.settings) return;
        // 设置可由主菜单或个人中心进入，返回时回到对应来源
        const fromProfile = !!this.profile;
        if (this.home) {
            this.home.node.destroy();
            this.home = null;
        }
        if (this.profile) {
            this.profile.node.destroy();
            this.profile = null;
        }
        this.settings = new SettingsView(this.stage, this.m, this.frames, {
            onBack: () => {
                this.settings?.node.destroy();
                this.settings = null;
                if (fromProfile) this.openProfile();
                else this.openMenu();
            },
        });
    }

    private openProfile(): void {
        this.clearSubPages();
        if (this.home) {
            this.home.node.destroy();
            this.home = null;
        }
        this.profile = new ProfileView(this.stage, this.m, this.frames, {
            onBack: () => this.openMenu(),
            onSettings: () => this.openSettings(),
            onPlay: () => { void gCtrl.ui.open(GameController); },
            onLevels: () => this.openLevels(),
        });
    }

    /** 销毁除主菜单外的所有子页（设置/个人中心） */
    private clearSubPages(): void {
        if (this.levels) {
            this.levels.node.destroy();
            this.levels = null;
        }
        if (this.settings) {
            this.settings.node.destroy();
            this.settings = null;
        }
        if (this.profile) {
            this.profile.node.destroy();
            this.profile = null;
        }
    }
}
