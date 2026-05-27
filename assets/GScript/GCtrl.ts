import { _decorator, Canvas, Component, Node } from 'cc';
import { registerBUrlByCfg, UIManager } from './core/ui/UIManager';
import { ResManager } from './core/res/ResManager';
import { PrefabsCfg } from './auto/PrefabCfg';
import { LoginCtrl } from 'db://assets/Login/LoginCtrl';
const { ccclass, property } = _decorator;

declare global {const gCtrl: GCtrl};


@ccclass('GCtrl')
export class GCtrl extends Component {
    readonly ui = new UIManager();
    readonly res = new ResManager();
    readonly loginCtr = new LoginCtrl();

    async init(params: {
        canvas2d: Canvas,
        releaseBoostFun: Function,
    }) {
        (globalThis as any)["gCtrl"] = this;
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
        gCtrl.loginCtr.showLogin(() => {
            console.log("登录成功");
            params.releaseBoostFun();
        });
        
    }

    protected onDestroy(): void {
        (globalThis as any)["gCtrl"] = null;
    }
}


