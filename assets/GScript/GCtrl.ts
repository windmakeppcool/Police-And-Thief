import { _decorator, Canvas, Component, Node } from 'cc';
import { UIManager } from './core/ui/UIManager';
const { ccclass, property } = _decorator;

declare global {const gCtrl: GCtrl};


@ccclass('GCtrl')
export class GCtrl extends Component {
    readonly ui = new UIManager();

    async init(params: {canvas2d: Canvas}) {
        (globalThis as any)["gCtrl"] = this;
        if (!params.canvas2d) {
            console.error(`请在GCtrl组件添加到Canvas组件上`);
            return;
        }
        gCtrl.ui.init(params.canvas2d);
        
    }

    protected onDestroy(): void {
        (globalThis as any)["gCtrl"] = null;
    }
}


