import { randomUUID } from "node:crypto";
import { existsSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { Connect, Plugin } from "vite";

/** assets/Game/levels 在仓库中的相对路径 */
const LEVELS_REL = "assets/Game/levels";

/** 关卡 id 白名单：只会拼进文件名一次，杜绝路径穿越 */
const ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

const json = (res: ServerResponse, status: number, body: unknown): void => {
    const text = JSON.stringify(body);
    res.statusCode = status;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(text);
};

function readBody(req: IncomingMessage): Promise<string> {
    return new Promise((resolve, reject) => {
        const chunks: Buffer[] = [];
        req.on("data", (chunk: Buffer) => chunks.push(chunk));
        req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
        req.on("error", reject);
    });
}

/** 磁盘上的关卡文件名（不含扩展名），按文件名排序 */
function levelFiles(levelsDir: string): string[] {
    if (!existsSync(levelsDir)) return [];
    return readdirSync(levelsDir)
        .filter(name => name.endsWith(".json") && name !== "levels.json")
        .map(name => name.slice(0, -".json".length))
        .sort();
}

/** 读 levels.json 索引；缺失或损坏时按空数组处理（会被下一次保存重建） */
function readIndex(levelsDir: string): string[] {
    const indexPath = join(levelsDir, "levels.json");
    if (!existsSync(indexPath)) return [];
    try {
        const raw: unknown = JSON.parse(readFileSync(indexPath, "utf8"));
        return Array.isArray(raw) ? raw.filter((id): id is string => typeof id === "string") : [];
    } catch {
        return [];
    }
}

const writeJsonFile = (path: string, value: unknown): void => {
    writeFileSync(path, `${JSON.stringify(value, null, 4)}\n`, "utf8");
};

/** 新关卡需要一份 .meta，否则 Cocos 不会导入这个 JSON */
function ensureMeta(levelsDir: string, id: string): boolean {
    const metaPath = join(levelsDir, `${id}.json.meta`);
    if (existsSync(metaPath)) return false;
    writeJsonFile(metaPath, {
        ver: "2.0.1",
        importer: "json",
        imported: true,
        uuid: randomUUID(),
        files: [".json"],
        subMetas: {},
        userData: {},
    });
    return true;
}

/**
 * 开发期关卡文件的读写接口，挂在 vite dev server 上。
 * 只写 assets/Game/levels 下的 level_*.json、对应 .meta 与 levels.json 索引。
 */
export function levelsApi(repoRoot: string): Plugin {
    const levelsDir = join(repoRoot, LEVELS_REL);

    const handler: Connect.NextHandleFunction = (req, res, next) => {
        const url = new URL(req.url ?? "/", "http://localhost");
        if (!url.pathname.startsWith("/api/levels")) return next();
        const rest = url.pathname.slice("/api/levels".length).replace(/^\//, "");
        const method = req.method ?? "GET";

        // GET /api/levels —— 目录（磁盘文件 + levels.json 顺序）
        if (rest === "" && method === "GET") {
            const files = levelFiles(levelsDir);
            const index = readIndex(levelsDir).filter(id => files.includes(id));
            const unlisted = files.filter(id => !index.includes(id));
            json(res, 200, { levelsDir, index: [...index, ...unlisted], files });
            return;
        }

        // POST /api/levels/:id/delete
        const deleteMatch = /^([^/]+)\/delete$/.exec(rest);
        if (deleteMatch && method === "POST") {
            const id = decodeURIComponent(deleteMatch[1]);
            if (!ID_PATTERN.test(id)) {
                json(res, 400, { error: `关卡 id 非法：${id}` });
                return;
            }
            rmSync(join(levelsDir, `${id}.json`), { force: true });
            rmSync(join(levelsDir, `${id}.json.meta`), { force: true });
            writeJsonFile(join(levelsDir, "levels.json"), readIndex(levelsDir).filter(existing => existing !== id));
            json(res, 200, { ok: true, id });
            return;
        }

        // GET|POST /api/levels/:id
        const idMatch = /^([^/]+)$/.exec(rest);
        if (idMatch) {
            const id = decodeURIComponent(idMatch[1]);
            if (!ID_PATTERN.test(id)) {
                json(res, 400, { error: `关卡 id 非法：${id}` });
                return;
            }
            const filePath = join(levelsDir, `${id}.json`);

            if (method === "GET") {
                if (!existsSync(filePath)) {
                    json(res, 404, { error: `关卡 ${id} 不存在` });
                    return;
                }
                res.statusCode = 200;
                res.setHeader("Content-Type", "application/json; charset=utf-8");
                res.end(readFileSync(filePath, "utf8"));
                return;
            }

            if (method === "POST") {
                void readBody(req).then(text => {
                    let parsed: unknown;
                    try {
                        parsed = JSON.parse(text);
                    } catch (e) {
                        json(res, 400, { error: `请求体不是合法 JSON：${String(e)}` });
                        return;
                    }
                    const doc = parsed as { id?: unknown };
                    if (doc === null || typeof doc !== "object" || doc.id !== id) {
                        json(res, 400, { error: `关卡内容里的 id 必须是 "${id}"` });
                        return;
                    }
                    const created = !existsSync(filePath);
                    writeJsonFile(filePath, doc);
                    const metaCreated = ensureMeta(levelsDir, id);
                    const index = readIndex(levelsDir);
                    if (!index.includes(id)) {
                        writeJsonFile(join(levelsDir, "levels.json"), [...index, id]);
                    }
                    json(res, 200, {
                        ok: true,
                        id,
                        path: `${LEVELS_REL}/${id}.json`,
                        created,
                        metaCreated,
                    });
                }, (e: unknown) => json(res, 500, { error: String(e) }));
                return;
            }
        }

        json(res, 405, { error: `不支持的请求：${method} ${url.pathname}` });
    };

    return {
        name: "level-editor:levels-api",
        // 只跑在 dev server 上；构建产物里没有这个 API
        apply: "serve",
        configureServer(server) {
            server.middlewares.use(handler);
        },
    };
}
