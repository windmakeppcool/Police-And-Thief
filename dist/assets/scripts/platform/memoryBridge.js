export class MemoryPlatformBridge {
    constructor(platformId = "web") {
        this.storage = new Map();
        this.platformId = platformId;
    }
    getPlatformId() {
        return this.platformId;
    }
    storageGet(key) {
        return this.storage.get(key) ?? null;
    }
    storageSet(key, value) {
        this.storage.set(key, value);
    }
    showToast(message) {
        void message;
    }
    vibrate(type) {
        void type;
    }
}
