const SAVE_KEY = "pat_save_v1";
function normalize(data) {
    const unique = Array.from(new Set(data.completedLevelIds.filter((x) => typeof x === "string" && x.length > 0)));
    unique.sort();
    return { version: 1, completedLevelIds: unique };
}
export class SaveService {
    constructor(platform) {
        this.platform = platform;
    }
    load() {
        const raw = this.platform.storageGet(SAVE_KEY);
        if (!raw)
            return { version: 1, completedLevelIds: [] };
        try {
            const parsed = JSON.parse(raw);
            if (parsed.version !== 1 || !Array.isArray(parsed.completedLevelIds)) {
                return { version: 1, completedLevelIds: [] };
            }
            return normalize({ version: 1, completedLevelIds: parsed.completedLevelIds });
        }
        catch {
            return { version: 1, completedLevelIds: [] };
        }
    }
    save(data) {
        const normalized = normalize(data);
        this.platform.storageSet(SAVE_KEY, JSON.stringify(normalized));
    }
    markCompleted(levelId) {
        const cur = this.load();
        const next = normalize({ version: 1, completedLevelIds: [...cur.completedLevelIds, levelId] });
        this.save(next);
        return next;
    }
    isCompleted(levelId) {
        const cur = this.load();
        return cur.completedLevelIds.includes(levelId);
    }
}
