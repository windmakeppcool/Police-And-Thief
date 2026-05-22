function tt() {
    return globalThis.tt;
}
export class DouyinPlatformBridge {
    getPlatformId() {
        return "douyin";
    }
    storageGet(key) {
        try {
            const v = tt().getStorageSync(key);
            return typeof v === "string" ? v : null;
        }
        catch {
            return null;
        }
    }
    storageSet(key, value) {
        tt().setStorageSync(key, value);
    }
    showToast(message) {
        try {
            tt().showToast({ title: message, icon: "none" });
        }
        catch {
            console.log(message);
        }
    }
    vibrate(type) {
        try {
            tt().vibrateShort({ type });
        }
        catch {
            void type;
        }
    }
}
