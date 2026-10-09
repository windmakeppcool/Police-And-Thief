import { Color, SpriteFrame } from 'cc';
import { BL } from '../../core/res/ResConst';
import { applyInsets } from '../../core/ui/UIFactory';

/** 设计稿“口袋巡逻队”配色令牌，与 design/pocket-patrol.css 保持一致 */
export const PocketPalette = {
    ink: new Color(38, 63, 71, 255),          // --ink #263f47
    mint: new Color(220, 239, 228, 255),      // --mint #dcefe4
    mintDeep: new Color(82, 141, 121, 255),   // --mint-deep #528d79
    cream: new Color(255, 250, 240, 255),     // --cream #fffaf0
    orange: new Color(247, 132, 98, 255),     // --orange #f78462
    orangeDark: new Color(199, 100, 73, 255), // --orange-dark #c76449
    line: new Color(205, 220, 210, 255),      // --line #cddcd2
    yellow: new Color(255, 207, 113, 255),    // --yellow #ffcf71
    blue: new Color(131, 184, 217, 255),      // --blue #83b8d9
    whiteish: new Color(255, 253, 242, 255),  // 主按钮文字白 #fffdf2
    muted: new Color(139, 151, 135, 255),     // 次级文字 #8b9787
};

/** GameBN 中以 image/ 为根的素材地址 */
const IMG = (path: string) => BL(`image/${path}`, 'GameBN');

export const DesignAssetPaths = {
    cellNormal: IMG('board/cell_normal'),
    cellCorner: IMG('board/cell_corner'),
    ghostValid: IMG('board/ghost_valid'),
    ghostInvalid: IMG('board/ghost_invalid'),
    thiefNormal: IMG('character/thief_normal'),
    thiefPeekLeft: IMG('character/thief_peek_left'),
    thiefPeekRight: IMG('character/thief_peek_right'),
    policeCell: IMG('piece/police_cell'),
    policeCellDrag: IMG('piece/police_cell_drag'),
    trayBg: IMG('ui/tray_bg'),
    slotDashed: IMG('ui/slot_dashed'),
    btnRound: IMG('ui/btn_round'),
    btnPrimary: IMG('ui/btn_primary'),
    btnPrimaryPressed: IMG('ui/btn_primary_pressed'),
    cardBg: IMG('ui/card_bg'),
    coachBubble: IMG('ui/coach_bubble'),
    overlayDim: IMG('ui/overlay_dim'),
    sirenRed: IMG('ui/siren_red_left'),
    sirenBlue: IMG('ui/siren_blue_left'),
    skyline: IMG('icon/skyline'),
    starActive: IMG('icon/star_active'),
    starInactive: IMG('icon/star_inactive'),
    undo: IMG('icon/undo'),
    restart: IMG('icon/restart'),
    houseRed: IMG('town/house_red'),
    houseYellow: IMG('town/house_yellow'),
    treeLarge: IMG('town/tree_large'),
    treeSmall: IMG('town/tree_small'),
    policeCar: IMG('town/police_car'),
    policeCarLight: IMG('town/police_car_light'),
    /** 2×2 纯白贴图，作为纯色矩形使用 */
    solid: IMG('white'),

    // ── 口袋巡逻队：图标（design/pocket-patrol.html 拆分） ──
    badge: IMG('icon/badge'),
    play: IMG('icon/play'),
    grid: IMG('icon/grid'),
    home: IMG('icon/home'),
    settings: IMG('icon/settings'),
    user: IMG('icon/user'),
    back: IMG('icon/back'),
    arrow: IMG('icon/arrow'),
    arrowWhite: IMG('icon/arrow_white'),
    lock: IMG('icon/lock'),
    pause: IMG('icon/pause'),
    hint: IMG('icon/hint'),
    reset: IMG('icon/reset'),
    share: IMG('icon/share'),
    clock: IMG('icon/clock'),
    sound: IMG('icon/sound'),
    check: IMG('icon/check'),
    close: IMG('icon/close'),
    thief: IMG('icon/thief'),
    tree: IMG('icon/tree'),

    // ── 口袋巡逻队：UI 面板 ──
    btnSecondary: IMG('ui/btn_secondary'),
    navBg: IMG('ui/nav_bg'),
    levelTile: IMG('ui/level_tile'),
    levelTileCurrent: IMG('ui/level_tile_current'),
    levelTileLocked: IMG('ui/level_tile_locked'),
    switchOn: IMG('ui/switch_on'),
    switchOff: IMG('ui/switch_off'),
    progressTrack: IMG('ui/progress_track'),
    progressFill: IMG('ui/progress_fill'),
    cardMint: IMG('ui/card_mint'),
    cardGroup: IMG('ui/card_group'),
    cardAchievement: IMG('ui/card_achievement'),
    cardTicket: IMG('ui/card_ticket'),
    cardStats: IMG('ui/card_stats'),
    resultSeal: IMG('ui/result_seal'),
    sceneTag: IMG('ui/scene_tag'),
    difficultyPill: IMG('ui/difficulty_pill'),
    starCounter: IMG('ui/star_counter'),
    btnHint: IMG('ui/btn_hint'),
    profileAvatarBg: IMG('ui/profile_avatar_bg'),
    bootMark: IMG('ui/boot_mark'),
    loadingTrack: IMG('ui/loading_track'),
    loadingFill: IMG('ui/loading_fill'),

    // ── 口袋巡逻队：主视觉 ──
    heroTown: IMG('menu/hero_town'),
} as const;

/** 需要九宫格拉伸的素材：边框宽度按设计稿圆角取值 */
const NINE_SLICE_INSETS: Partial<Record<keyof typeof DesignAssetPaths, number>> = {
    btnRound: 16,
    btnPrimary: 20,
    btnPrimaryPressed: 20,
    cardBg: 28,
    trayBg: 24,
    slotDashed: 20,
    coachBubble: 16,
    sirenRed: 8,
    sirenBlue: 8,
    // 口袋巡逻队面板
    btnSecondary: 40,
    navBg: 4,
    levelTile: 42,
    levelTileCurrent: 42,
    levelTileLocked: 42,
    progressTrack: 8,
    progressFill: 8,
    cardMint: 50,
    cardGroup: 44,
    cardAchievement: 44,
    cardTicket: 52,
    cardStats: 44,
    sceneTag: 34,
    difficultyPill: 22,
    starCounter: 28,
    btnHint: 36,
    profileAvatarBg: 70,
    bootMark: 84,
    loadingTrack: 16,
    loadingFill: 16,
};

export type DesignAssetKey = keyof typeof DesignAssetPaths;
export type DesignFrames = Record<DesignAssetKey, SpriteFrame | null>;

/** 一次性加载设计稿拆分出的全部精灵素材 */
export async function loadDesignFrames(): Promise<DesignFrames> {
    const keys = Object.keys(DesignAssetPaths) as DesignAssetKey[];
    const frames = await Promise.all(keys.map(async key => {
        const frame = await gCtrl.res.loadAssetAsync(DesignAssetPaths[key], SpriteFrame);
        if (!frame) {
            console.error(`[DesignAssets] 素材加载失败: ${DesignAssetPaths[key].bundlePath}`);
            return null;
        }
        const inset = NINE_SLICE_INSETS[key];
        if (inset) applyInsets(frame, inset);
        frame.addRef();
        return frame;
    }));
    const result = {} as DesignFrames;
    keys.forEach((key, i) => { result[key] = frames[i]; });
    return result;
}
