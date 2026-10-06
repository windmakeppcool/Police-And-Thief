import { Color, SpriteFrame } from 'cc';
import { BL } from '../../core/res/ResConst';
import { applyInsets } from './UIFactory';

/** 设计稿“积木小镇”配色令牌，与 design/game-ui.html 保持一致 */
export const Palette = {
    sky: new Color(110, 198, 238, 255),
    ink: new Color(34, 49, 91, 255),
    cream: new Color(255, 246, 227, 255),
    police: new Color(46, 124, 214, 255),
    thief: new Color(240, 78, 69, 255),
    white: new Color(255, 255, 255, 255),
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
