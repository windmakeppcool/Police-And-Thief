import { _decorator, Canvas, Component, Node } from 'cc';
import { UIManager } from './core/ui/UIManager';
import { ResManager } from './core/res/ResManager';
import { PrefabsCfg } from './auto/PrefabCfg';
import { LoginCtrl } from './login/LoginCtrl';
import { registerBUrlByCfg } from './core/res/ResConst';
import { type PlatformAdapter } from './core/platform/PlatformAdapter';
import { createPlatformAdapter } from './core/platform/PlatformFactory';
import { GameController } from './game/controller/GameController';
const { ccclass, property } = _decorator;

declare global { const gCtrl: GCtrl };


@ccclass('GCtrl')
export class GCtrl extends Component {
    readonly ui = new UIManager();
    readonly res = new ResManager();
    readonly loginCtr = new LoginCtrl();
    readonly platform: PlatformAdapter = createPlatformAdapter();

    async init(params: {
        canvas2d: Canvas,
        releaseBoostFun: Function,
    }) {
        (globalThis as any)["gCtrl"] = this;
        await this.platform.init();
        this.platform.reportEvent?.("game_boot", { version: "dev" });
        if (!params.canvas2d) {
            console.error(`请在GCtrl组件添加到Canvas组件上`);
            return;
        }
        gCtrl.ui.init(params.canvas2d);

        // 提前注册预制体信息
        registerBUrlByCfg(PrefabsCfg);

        // 登录模块初始化
        gCtrl.loginCtr.init();

        // 显示登录界面（传入登录成功回调函数）
        gCtrl.loginCtr.showLogin(async () => {
            // 通过 UIManager 打开登录成功后的游戏控制器
            await gCtrl.res.loadBundleAsync("GameBN");
            await gCtrl.ui.open(GameController);
            console.log("登录成功");
            params.releaseBoostFun();
        });

    }

    protected onDestroy(): void {
        (globalThis as any)["gCtrl"] = null;
    }
}


