import { _decorator, Component } from 'cc';
const { ccclass } = _decorator;

@ccclass('DestroyHook')
export class DestroyHook extends Component {
    private m_Hooks: Function[] = [];
    onDestroy() {
        for (let i = this.m_Hooks.length -1; i >= 0; i--) {
            this.m_Hooks[i]();
        }
    }
    addHook(hook: Function) {
        this.m_Hooks.push(hook);
    }
}


