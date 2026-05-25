import { _decorator, Canvas, Component, Node } from 'cc';
import { registerBUrlByCfg, UIManager } from './core/ui/UIManager';
import { ResManager } from './core/res/ResManager';
import { PrefabsCfg } from './auto/PrefabCfg';
const { ccclass, property } = _decorator;

declare global {const gCtrl: GCtrl};


@ccclass('GCtrl')
export class GCtrl extends Component {
    readonly ui = new UIManager();
    readonly res = new ResManager();

    async init(params: {canvas2d: Canvas}) {
        (globalThis as any)["gCtrl"] = this;
        if (!params.canvas2d) {
            console.error(`请在GCtrl组件添加到Canvas组件上`);
            return;
        }
        gCtrl.ui.init(params.canvas2d);

        // 提前注册预制体信息
        registerBUrlByCfg(PrefabsCfg);
        
    }

    protected onDestroy(): void {
        (globalThis as any)["gCtrl"] = null;
    }
}


