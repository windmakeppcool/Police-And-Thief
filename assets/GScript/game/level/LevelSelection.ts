/** 默认关卡：菜单没选过时从这里开始 */
export const DEFAULT_LEVEL_ID = "level_01";

let selectedLevelId: string = DEFAULT_LEVEL_ID;

/**
 * 菜单选关后调用；GameController 启动时读取。
 * 用模块级状态是因为 UIManager.open 只接受组件类、无法传参，
 * 而组件的 onLoad 在 open 返回前就已执行。
 */
export function selectLevel(levelId: string): void {
    if (typeof levelId !== "string" || levelId.length === 0) {
        throw new Error("[LevelSelection] levelId 必须是非空字符串");
    }
    selectedLevelId = levelId;
}

/** 当前选中的关卡 id */
export function currentLevelId(): string {
    return selectedLevelId;
}

/** 仅测试用：恢复默认关卡 */
export function resetLevelSelection(): void {
    selectedLevelId = DEFAULT_LEVEL_ID;
}
