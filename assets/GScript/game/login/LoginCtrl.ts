import { AudioManager } from "../../core/audio/AudioManager";
import { BL } from "../../core/res/ResConst";

const B = (m: string) => BL(`Res/Audio/${m}`, "LoginBN");

export const LoginMusic = {
    bgm: B("background"),
}

export class LoginCtrl {
    init() {
        AudioManager.getInstance().playMusic(LoginMusic.bgm);
    }

    private m_OnLoginSuccess: Function = null!;
    showLogin(onLoginSuccess: Function) {
        this.m_OnLoginSuccess = onLoginSuccess;
        this.autoLogin();
    }

    autoLogin() {
        // 模拟登录耗时 1 秒回调实现（后续修改此为不同平台登录逻辑即可）
        setTimeout(() => {
            Promise.resolve()
                .then(() => this.m_OnLoginSuccess())
                .catch(e => console.error("登录回调失败:", e));
        }, 1000);
    }
}