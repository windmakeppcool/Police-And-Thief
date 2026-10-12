import { _decorator, Component, Node, UITransform, Vec3 } from 'cc';
import { EViewLayer } from '../../core/ui/EViewLayer';
import { G_VIEW_SIZE } from '../../core/ui/UIManager';
import { AudioManager } from '../../core/audio/AudioManager';
import { GameController } from '../GameController';
import { selectLevel } from '../level/LevelSelection';
import { getLevelIds } from '../level/LevelCatalog';
import { loadLevelIndex } from '../LevelRepository';
import { ProgressStore } from '../ProgressStore';
import { DesignFrames, loadDesignFrames, PocketPalette, SfxAssetPaths } from './DesignAssets';
import { LevelsView } from './LevelsView';
import { MenuBootView } from './MenuBootView';
import { MenuHomeView } from './MenuHomeView';
import { ProfileView } from './ProfileView';
import { SettingsView } from './SettingsView';
import { computeMenuMetrics, type MenuMetrics } from './MenuWidgets';
import { addSprite, createNode } from '../../core/ui/UIFactory';
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

    /** 关卡目录（levels.json），顺序即关卡选择页的第几格 */
    private levelIds: string[] = [];

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
        if (!this.isValid || !this.node.isValid) return;
        this.levelIds = await loadLevelIndex();
        if (!this.isValid || !this.node.isValid) return;
        // 渲染菜单数据前先加载本机进度（通关数/设置）
        await ProgressStore.load();
        if (!this.isValid || !this.node.isValid) return;
        // 把存档里的音效开关/音量同步给音频管理器（登录音乐可能已在播放）
        const audio = AudioManager.getInstance();
        audio.setVolume(ProgressStore.getVolume());
        audio.setSoundEnabled(ProgressStore.getSound());
        // 预加载短音效：AudioManager 按 key 去重，重复进入菜单不会重复加载；
        // 不阻塞开机动画，未加载完成前 playSfx 是安全 no-op
        void audio.preloadSfx(Object.entries(SfxAssetPaths).map(([key, bUrl]) => ({ key, bUrl }))).catch((err) => {
            console.error('[MenuController] 音效预加载异常', err);
        });

        // 宽屏设备上 414×820 stage 两侧露出的区域用底色填满，避免黑边
        const backdrop = createNode('Backdrop', this.node,
            { width: G_VIEW_SIZE.width, height: G_VIEW_SIZE.height }, new Vec3(0, 0, -1));
        addSprite(backdrop, this.frames.solid, {
            size: { width: G_VIEW_SIZE.width, height: G_VIEW_SIZE.height },
            color: PocketPalette.cream,
        });
        // 2D UI 的渲染先后由 siblingIndex 决定，z 坐标不生效；backdrop 比 stage
        // 后创建，不挪回底层就会把整个 stage 盖住
        backdrop.setSiblingIndex(0);

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
        this.home = new MenuHomeView(this.stage, this.m, this.frames, {
            onStart: () => this.openLevel(this.nextLevelId()),
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
            this.home = new MenuHomeView(this.stage, this.m, this.frames, {
                onStart: () => this.openLevel(this.nextLevelId()),
                onLevels: () => this.openLevels(),
                onNavMenu: () => this.openMenu(),
                onNavSettings: () => this.openSettings(),
                onNavProfile: () => this.openProfile(),
            });
        }
    }

    /** 推荐的下一关：第 clearedCount+1 关；全部通关后回退到第一关 */
    private nextLevelId(): string | undefined {
        const ids = getLevelIds();
        const index = Math.min(ProgressStore.clearedCount, ids.length - 1);
        return ids[index];
    }

    /** 打开指定关卡的对局；没有可用关卡时只报错，不跳转 */
    private openLevel(levelId: string | undefined): void {
        if (!levelId) {
            console.error('[MenuController] 没有可用关卡');
            return;
        }
        selectLevel(levelId);
        // 进入对局后销毁菜单节点，避免菜单层层堆叠
        void gCtrl.ui.open(GameController)
            .then(() => this.node.destroy())
            .catch(err => console.error('[MenuController] 进入对局失败', err));
    }

    private openLevels(): void {
        this.clearSubPages();
        if (this.home) {
            this.home.node.destroy();
            this.home = null;
        }
        this.levels = new LevelsView(this.stage, this.m, this.frames,
            ProgressStore.clearedCount,
            Math.min(ProgressStore.clearedCount + 1, this.levelIds.length), {
            onBack: () => this.openMenu(),
            // 「继续巡逻」沿用当前选中的关卡，不改选择
            onContinue: () => {
                void gCtrl.ui.open(GameController)
                    .then(() => this.node.destroy())
                    .catch(err => console.error('[MenuController] 继续巡逻失败', err));
            },
            onPick: (level: number) => this.openLevel(this.levelIds[level - 1]),
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
            onPlay: () => {
                void gCtrl.ui.open(GameController)
                    .then(() => this.node.destroy())
                    .catch(err => console.error('[MenuController] 再来一局失败', err));
            },
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
