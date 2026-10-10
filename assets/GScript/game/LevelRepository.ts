import { JsonAsset } from 'cc';
import { BL } from '../core/res/ResConst';
import type { LevelData } from './common/GameTypes';
import { LevelParseError, parseLevel, parseLevelIndex } from './level/LevelParser';
import { BoardPieces } from './piece/pieces';

/** 关卡目录在 GameBN 里的地址：assets/Game/levels/levels.json */
const LEVEL_INDEX_URL = BL('levels/levels', 'GameBN');

/** 单关 JSON 的地址：assets/Game/levels/<levelId>.json */
const levelUrl = (levelId: string) => BL(`levels/${levelId}`, 'GameBN');

function report(e: unknown, fallback: string): void {
    if (e instanceof LevelParseError) console.error(e.message);
    else console.error(`${fallback}: ${e}`);
}

/**
 * 读关卡目录（levels.json），返回按可选关顺序排列的关卡 id。
 * 加载或解析失败时回退为 ['level_01']：索引缺失属于打包故障，
 * 回退比让游戏完全打不开更合适（单关内容错误仍然是拒入）。
 */
export async function loadLevelIndex(): Promise<string[]> {
    const asset = await gCtrl.res.loadAssetAsync(LEVEL_INDEX_URL, JsonAsset);
    if (!asset) {
        console.error('[LevelRepository] 加载 levels.json 失败，回退为单关 level_01');
        return ['level_01'];
    }
    try {
        return parseLevelIndex(asset.json);
    } catch (e) {
        report(e, '[LevelRepository] 关卡目录解析异常');
        return ['level_01'];
    }
}

/**
 * 读单关关卡数据。解析失败返回 null，由调用方拒绝进入该关。
 */
export async function loadLevel(levelId: string): Promise<LevelData | null> {
    const asset = await gCtrl.res.loadAssetAsync(levelUrl(levelId), JsonAsset);
    if (!asset) {
        console.error(`[LevelRepository] 加载关卡 ${levelId} 失败`);
        return null;
    }
    try {
        const level = parseLevel(asset.json, BoardPieces);
        if (level.id !== levelId) {
            console.error(`[LevelRepository] 关卡 ${levelId} 的 id 字段是 "${level.id}"，与文件名不一致`);
            return null;
        }
        return level;
    } catch (e) {
        report(e, `[LevelRepository] 关卡 ${levelId} 解析异常`);
        return null;
    }
}
