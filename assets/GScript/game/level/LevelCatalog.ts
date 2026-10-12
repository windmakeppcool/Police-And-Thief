/**
 * 关卡目录顺序的纯状态：levels.json 加载成功后注入，供菜单/结算读取关卡序号。
 * 用模块级状态与 LevelSelection 同理（UIManager.open 只接受组件类、无法传参）。
 */

let levelIds: string[] = [];

/** 设置有序关卡 id 列表（拷贝一份，避免外部数组后续被改动） */
export function setLevelIds(ids: readonly string[]): void {
    levelIds = ids.slice();
}

/** 当前目录的有序关卡 id 列表 */
export function getLevelIds(): readonly string[] {
    return levelIds;
}

/** 关卡 id 在目录中的序号（从 0 开始）；找不到返回 -1 */
export function getIndex(id: string): number {
    return levelIds.indexOf(id);
}

/** 目录中该关卡的下一关 id；已经是最后一关或找不到时返回 null */
export function getNextId(id: string): string | null {
    const index = levelIds.indexOf(id);
    if (index < 0 || index >= levelIds.length - 1) {
        return null;
    }
    return levelIds[index + 1];
}
