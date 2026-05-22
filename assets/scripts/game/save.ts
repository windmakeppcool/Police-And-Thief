import type { IPlatformBridge } from "../platform/bridge.js";

export type SaveDataV1 = Readonly<{
  version: 1;
  completedLevelIds: string[];
}>;

const SAVE_KEY = "pat_save_v1";

function normalize(data: SaveDataV1): SaveDataV1 {
  const unique = Array.from(new Set(data.completedLevelIds.filter((x) => typeof x === "string" && x.length > 0)));
  unique.sort();
  return { version: 1, completedLevelIds: unique };
}

export class SaveService {
  private readonly platform: IPlatformBridge;

  public constructor(platform: IPlatformBridge) {
    this.platform = platform;
  }

  public load(): SaveDataV1 {
    const raw = this.platform.storageGet(SAVE_KEY);
    if (!raw) return { version: 1, completedLevelIds: [] };

    try {
      const parsed = JSON.parse(raw) as Partial<SaveDataV1>;
      if (parsed.version !== 1 || !Array.isArray(parsed.completedLevelIds)) {
        return { version: 1, completedLevelIds: [] };
      }
      return normalize({ version: 1, completedLevelIds: parsed.completedLevelIds as string[] });
    } catch {
      return { version: 1, completedLevelIds: [] };
    }
  }

  public save(data: SaveDataV1): void {
    const normalized = normalize(data);
    this.platform.storageSet(SAVE_KEY, JSON.stringify(normalized));
  }

  public markCompleted(levelId: string): SaveDataV1 {
    const cur = this.load();
    const next = normalize({ version: 1, completedLevelIds: [...cur.completedLevelIds, levelId] });
    this.save(next);
    return next;
  }

  public isCompleted(levelId: string): boolean {
    const cur = this.load();
    return cur.completedLevelIds.includes(levelId);
  }
}

