import { G_VIEW_SIZE } from '../../core/ui/UIManager';

/** 设计稿尺寸常量（对应 design/game-ui.html 的 64px 网格与卡片尺寸） */
export const Metrics = {
    /** 棋盘外框（深色面板）边长 */
    boardOuter: 404,
    hudHeight: 56,
    statusHeight: 30,
    trayHeight: 150,
    trayWidth: 760,
    slotWidth: 112,
    slotHeight: 100,
    slotGap: 8,
    margin: 16,
    topMargin: 12,
    bottomMargin: 12,
};

export type GameLayout = Readonly<{
    width: number;
    height: number;
    /** 顶部信息条中心 Y */
    hudY: number;
    /** 状态行中心 Y */
    statusY: number;
    /** 棋盘面板中心 Y */
    boardY: number;
    boardBottom: number;
    /** 街景装饰带中心 Y */
    townY: number;
    townHeight: number;
    /** 托盘中心 Y */
    trayY: number;
    trayTop: number;
}>;

/**
 * 依据实际设计分辨率计算纵向布局。
 *
 * 宽高比 >= 16:9 时（FIXED_HEIGHT）高度固定 720，多出来的宽度只影响横向；
 * 屏幕更窄时（手机竖屏，FIXED_WIDTH）G_VIEW_SIZE 会变成 1280×更高，
 * 此时把「棋盘 + 街景」整体在 HUD 与托盘之间居中，避免中间留下大片空白。
 */
export function computeLayout(): GameLayout {
    const width = G_VIEW_SIZE.width || 1280;
    const height = G_VIEW_SIZE.height || 720;
    const half = height / 2;

    const hudY = half - Metrics.topMargin - Metrics.hudHeight / 2;
    const statusY = hudY - Metrics.hudHeight / 2 - 8 - Metrics.statusHeight / 2;

    const topLimit = statusY - Metrics.statusHeight / 2 - 10;
    const trayY = -half + Metrics.bottomMargin + Metrics.trayHeight / 2;
    const trayTop = trayY + Metrics.trayHeight / 2;

    const preferredTownHeight = 44;
    const blockHeight = Metrics.boardOuter + preferredTownHeight;
    const slack = Math.max(0, (topLimit - trayTop) - blockHeight);
    const boardTop = topLimit - slack / 2;
    const boardY = boardTop - Metrics.boardOuter / 2;
    const boardBottom = boardTop - Metrics.boardOuter;

    const townHeight = Math.max(36, boardBottom - trayTop - 8);
    const townY = (boardBottom + trayTop) / 2;

    return { width, height, hudY, statusY, boardY, boardBottom, townY, townHeight, trayY, trayTop };
}
