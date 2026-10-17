import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import { levelsApi } from "./server/levelsApi";

const editorRoot = fileURLToPath(new URL(".", import.meta.url));
const repoRoot = fileURLToPath(new URL("../..", import.meta.url));

/**
 * 关卡编辑器开发服务器。
 * root 是本目录，但要 import assets/GScript 里的游戏模块，所以放开仓库根的文件访问。
 * 编辑器只跑 dev server，从不构建，也不被 assets/ 里的任何代码引用。
 */
export default defineConfig({
    root: editorRoot,
    publicDir: false,
    server: {
        port: 5173,
        fs: { allow: [repoRoot] },
    },
    plugins: [levelsApi(repoRoot)],
});
