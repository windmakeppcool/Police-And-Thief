import { Label, Node, Sprite, SpriteFrame, UIOpacity, Vec3 } from 'cc';
import { DesignFrames, PocketPalette } from './DesignAssets';
import { GameLayout, Metrics } from './Layout';
import { addLabel, addSprite, createLabel, createNode } from '../../core/ui/UIFactory';

export type HudHandlers = {
    onUndo: () => void;
    onRestart: () => void;
    onPause: () => void;
};

/** 顶部 HUD：关卡牌 + 警灯条 + 暂停/撤销/重开按钮，以及状态行（步数 / 目标） */
export class GameHudView {
    readonly node: Node;
    readonly statusNode: Node;

    private readonly siren: Sprite;
    private readonly sirenRed: SpriteFrame | null;
    private readonly sirenBlue: SpriteFrame | null;
    private readonly movesLabel: Label;
    private sirenFlip = false;
    /** 各圆形按钮的可用标志：false 时触摸回调直接 return，且无按下反馈 */
    private readonly buttonEnabled = new Map<string, boolean>();
    /** 暂停/重开按钮的总开关（未开局/暂停等状态），与撤销自身可用性独立 */
    private actionsEnabled = true;

    constructor(parent: Node, private readonly frames: DesignFrames, layout: GameLayout, handlers: HudHandlers,
        /** 关卡序号（从 1 开始）；不传时默认显示第 1 关 */
        levelIndex: number = 1) {
        const { width } = layout;
        this.sirenRed = frames.sirenRed;
        this.sirenBlue = frames.sirenBlue;

        this.node = createNode('Hud', parent, { width, height: Metrics.hudHeight }, new Vec3(0, layout.hudY, 0));

        // 关卡牌
        const badgeWidth = 190;
        const badgeX = -width / 2 + Metrics.margin + badgeWidth / 2;
        const badge = createNode('LevelBadge', this.node, { width: badgeWidth, height: 52 }, new Vec3(badgeX, 0, 0));
        addSprite(badge, frames.btnRound, { size: { width: badgeWidth, height: 52 }, sliced: true, color: PocketPalette.cream });
        const star = createNode('Star', badge, { width: 30, height: 30 }, new Vec3(-badgeWidth / 2 + 30, 0, 0));
        addSprite(star, frames.starActive, { size: { width: 30, height: 30 } });
        createLabel(badge, 'LevelText', `第 ${levelIndex} 关`, 24, { color: PocketPalette.ink, bold: true }, new Vec3(18, 0, 0));

        // 警灯条（红蓝交替闪烁）
        const undoSize = 46;
        const gap = 10;
        const sirenWidth = width - Metrics.margin * 2 - badgeWidth - undoSize * 3 - gap * 2 - 36;
        const sirenX = badgeX + badgeWidth / 2 + 12 + sirenWidth / 2;
        const sirenNode = createNode('Siren', this.node, { width: sirenWidth, height: 18 }, new Vec3(sirenX, 0, 0));
        this.siren = addSprite(sirenNode, frames.sirenRed, { size: { width: sirenWidth, height: 18 }, sliced: false });

        // 暂停 / 撤销 / 重开
        const restartX = width / 2 - Metrics.margin - undoSize / 2;
        const undoX = restartX - undoSize / 2 - gap - undoSize / 2;
        const pauseX = undoX - undoSize / 2 - gap - undoSize / 2;
        this.createRoundButton('PauseButton', pauseX, frames.pause, handlers.onPause);
        this.createRoundButton('UndoButton', undoX, frames.undo, handlers.onUndo);
        this.createRoundButton('RestartButton', restartX, frames.restart, handlers.onRestart);

        // 状态行
        this.statusNode = createNode('StatusRow', parent, { width, height: Metrics.statusHeight }, new Vec3(0, layout.statusY, 0));
        const pillWidth = 250;
        const pill = createNode('MovesPill', this.statusNode, { width: pillWidth, height: 34 }, new Vec3(-width / 2 + Metrics.margin + pillWidth / 2, 0, 0));
        addSprite(pill, frames.btnRound, { size: { width: pillWidth, height: 34 }, sliced: true, color: PocketPalette.ink });
        this.movesLabel = addLabel(pill, this.movesText(0, 6), 18, { color: PocketPalette.whiteish, bold: true, size: { width: pillWidth - 24, height: 34 } });

        createLabel(this.statusNode, 'GoalText', '围住小偷，别让他跑了！', 20,
            { color: PocketPalette.whiteish, bold: true, align: Label.HorizontalAlign.RIGHT, size: { width: 420, height: Metrics.statusHeight } },
            new Vec3(width / 2 - Metrics.margin - 210, 0, 0));
    }

    private createRoundButton(name: string, x: number, icon: SpriteFrame | null, onClick: () => void): Node {
        const button = createNode(name, this.node, { width: 46, height: 46 }, new Vec3(x, 0, 0));
        addSprite(button, this.frames.btnRound, { size: { width: 46, height: 46 }, sliced: true, color: PocketPalette.cream });
        const iconNode = createNode(`${name}Icon`, button, { width: 24, height: 24 });
        addSprite(iconNode, icon, { size: { width: 24, height: 24 } });
        // 圆形按钮默认启用；禁用时回调直接 return，按下只做轻微变暗反馈且仅在启用时生效
        this.buttonEnabled.set(name, true);
        const setOpacity = (value: number): void => {
            const opacity = button.getComponent(UIOpacity) ?? button.addComponent(UIOpacity);
            opacity.opacity = value;
        };
        button.on(Node.EventType.TOUCH_START, () => {
            if (!this.isButtonActive(name)) return;
            setOpacity(190);
        }, this);
        button.on(Node.EventType.TOUCH_END, () => {
            if (!this.isButtonActive(name)) return;
            setOpacity(255);
            onClick();
        }, this);
        button.on(Node.EventType.TOUCH_CANCEL, () => setOpacity(this.isButtonActive(name) ? 255 : 110), this);
        return button;
    }

    /** 该圆形按钮当前是否可点：撤销要同时满足总开关与撤销历史非空 */
    private isButtonActive(name: string): boolean {
        if (name === 'UndoButton') return this.actionsEnabled && (this.buttonEnabled.get(name) ?? true);
        if (name === 'RestartButton') return this.actionsEnabled;
        return this.buttonEnabled.get(name) ?? true;
    }

    /** 刷新单个圆形按钮的禁用透明度（110）/ 正常透明度（255） */
    private refreshButtonOpacity(name: string): void {
        const button = this.node.getChildByName(name);
        if (!button) return;
        const opacity = button.getComponent(UIOpacity) ?? button.addComponent(UIOpacity);
        opacity.opacity = this.isButtonActive(name) ? 255 : 110;
    }

    /** 暂停/撤销/重开按钮的总开关（未开局时关闭，暂停时由遮罩吞掉触摸、这里不额外变灰） */
    setActionsEnabled(enabled: boolean): void {
        this.actionsEnabled = enabled;
        this.refreshButtonOpacity('UndoButton');
        this.refreshButtonOpacity('RestartButton');
    }

    private movesText(moves: number, total: number): string {
        return `已部署 ${moves} / ${total} 队警力`;
    }

    setMoves(moves: number, total: number): void {
        this.movesLabel.string = this.movesText(moves, total);
    }

    setUndoEnabled(enabled: boolean): void {
        // 真正禁用：除降低透明度外，触摸回调经 isButtonActive 直接拦截
        this.buttonEnabled.set('UndoButton', enabled);
        this.refreshButtonOpacity('UndoButton');
    }

    /** 警灯红蓝交替 */
    toggleSiren(): void {
        this.sirenFlip = !this.sirenFlip;
        this.siren.spriteFrame = (this.sirenFlip ? this.sirenBlue : this.sirenRed) ?? this.siren.spriteFrame;
    }

    /** 操作引导气泡；宽度可按文案长度传入，返回节点，由调用方负责销毁 */
    showCoach(text: string, worldPos: Vec3, bubbleWidth = 200): Node | null {
        const root = this.node.parent;
        if (!root) return null;
        const node = createNode('Coach', root, { width: bubbleWidth, height: 56 });
        addSprite(node, this.frames.coachBubble, { size: { width: bubbleWidth, height: 56 }, sliced: true });
        createLabel(node, 'CoachText', text, 18, { color: PocketPalette.whiteish, bold: true, size: { width: bubbleWidth - 20, height: 48 } });
        node.setWorldPosition(worldPos.clone().add(new Vec3(0, Metrics.coachLiftY, 0)));
        // 气泡必须压在弹层之下（设计稿 z-index 60 < overlay 100）
        const overlays = root.getChildByName('Overlays');
        if (overlays) node.setSiblingIndex(overlays.getSiblingIndex());
        return node;
    }
}
