function getStorage() {
    const g = globalThis;
    if (!g.localStorage)
        return null;
    try {
        g.localStorage.setItem("__pat_probe__", "1");
        g.localStorage.getItem("__pat_probe__");
        return g.localStorage;
    }
    catch {
        return null;
    }
}
export class WebPlatformBridge {
    constructor() {
        this.storage = getStorage();
        this.mem = new Map();
    }
    getPlatformId() {
        return "web";
    }
    storageGet(key) {
        if (this.storage)
            return this.storage.getItem(key);
        return this.mem.get(key) ?? null;
    }
    storageSet(key, value) {
        if (this.storage) {
            this.storage.setItem(key, value);
            return;
        }
        this.mem.set(key, value);
    }
    showToast(message) {
        console.log(message);
    }
    vibrate(type) {
        void type;
    }
}
