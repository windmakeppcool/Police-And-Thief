function wx() {
    return globalThis.wx;
}
export class WechatPlatformBridge {
    getPlatformId() {
        return "wechat";
    }
    storageGet(key) {
        try {
            const v = wx().getStorageSync(key);
            return typeof v === "string" ? v : null;
        }
        catch {
            return null;
        }
    }
    storageSet(key, value) {
        wx().setStorageSync(key, value);
    }
    showToast(message) {
        try {
            wx().showToast({ title: message, icon: "none" });
        }
        catch {
            console.log(message);
        }
    }
    vibrate(type) {
        try {
            wx().vibrateShort({ type });
        }
        catch {
            void type;
        }
    }
}
