export type LevelList = { levelsDir: string; index: string[]; files: string[] };

export type SaveResult = { ok: true; path: string; created: boolean; metaCreated: boolean } | { ok: false; error: string };

/** 保存接口是 dev server 上的中间件；静态打开时没有它，界面会退回复制/下载 */
let serverAvailable: boolean | null = null;

export const hasServer = (): boolean | null => serverAvailable;

async function request(path: string, init?: RequestInit): Promise<Response | null> {
    try {
        return await fetch(path, init);
    } catch {
        serverAvailable = false;
        return null;
    }
}

export async function fetchLevels(): Promise<LevelList | null> {
    const res = await request("/api/levels");
    if (!res || !res.ok) {
        serverAvailable = false;
        return null;
    }
    serverAvailable = true;
    return (await res.json()) as LevelList;
}

export async function fetchLevel(id: string): Promise<unknown | null> {
    const res = await request(`/api/levels/${encodeURIComponent(id)}`);
    if (!res || !res.ok) return null;
    return (await res.json()) as unknown;
}

export async function saveLevel(id: string, doc: unknown): Promise<SaveResult> {
    const res = await request(`/api/levels/${encodeURIComponent(id)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(doc),
    });
    if (!res) return { ok: false, error: "没有可用的保存接口：请用 npm run level-editor 启动，或改用复制/下载" };
    const body = (await res.json()) as { error?: string; path?: string; created?: boolean; metaCreated?: boolean };
    if (!res.ok) return { ok: false, error: body.error ?? `保存失败（HTTP ${res.status}）` };
    return { ok: true, path: body.path ?? id, created: body.created ?? false, metaCreated: body.metaCreated ?? false };
}

export async function deleteLevel(id: string): Promise<string | null> {
    const res = await request(`/api/levels/${encodeURIComponent(id)}/delete`, { method: "POST" });
    if (!res) return "没有可用的保存接口";
    if (!res.ok) {
        const body = (await res.json()) as { error?: string };
        return body.error ?? `删除失败（HTTP ${res.status}）`;
    }
    return null;
}
