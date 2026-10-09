import { Label, Node, Sprite, SpriteFrame, UIOpacity, Vec3 } from 'cc';
import { DesignFrames, Palette } from './DesignAssets';
import { GameLayout, Metrics } from './Layout';
import { addLabel, addSprite, createLabel, createNode } from './UIFactory';

export type HudHandlers = {
    onUndo: () => void;
    onRestart: () => void;
};

/** 顶部 HUD：关卡牌 + 警灯条 + 撤销/重开按钮，以及状态行（步数 / 目标） */
export class GameHudView {
    readonly node: Node;
    readonly statusNode: Node;

    private readonly siren: Sprite;
    private readonly sirenRed: SpriteFrame | null;
    private readonly sirenBlue: SpriteFrame | null;
    private readonly undoButton: Node;
    private readonly movesLabel: Label;
    private sirenFlip = false;

    constructor(parent: Node, private readonly frames: DesignFrames, layout: GameLayout, handlers: HudHandlers) {
        const { width } = layout;
        this.sirenRed = frames.sirenRed;
        this.sirenBlue = frames.sirenBlue;

        this.node = createNode('Hud', parent, { width, height: Metrics.hudHeight }, new Vec3(0, layout.hudY, 0));

        // 关卡牌
        const badgeWidth = 190;
        const badgeX = -width / 2 + Metrics.margin + badgeWidth / 2;
        const badge = createNode('LevelBadge', this.node, { width: badgeWidth, height: 52 }, new Vec3(badgeX, 0, 0));
        addSprite(badge, frames.btnRound, { size: { width: badgeWidth, height: 52 }, sliced: true, color: Palette.cream });
        const star = createNode('Star', badge, { width: 30, height: 30 }, new Vec3(-badgeWidth / 2 + 30, 0, 0));
        addSprite(star, frames.starActive, { size: { width: 30, height: 30 } });
        createLabel(badge, 'LevelText', '第 1 关', 24, { color: Palette.ink, bold: true }, new Vec3(18, 0, 0));

        // 警灯条（红蓝交替闪烁）
        const undoSize = 46;
        const gap = 10;
        const sirenWidth = width - Metrics.margin * 2 - badgeWidth - undoSize * 2 - gap - 36;
        const sirenX = badgeX + badgeWidth / 2 + 12 + sirenWidth / 2;
        const sirenNode = createNode('Siren', this.node, { width: sirenWidth, height: 18 }, new Vec3(sirenX, 0, 0));
        this.siren = addSprite(sirenNode, frames.sirenRed, { size: { width: sirenWidth, height: 18 }, sliced: false });

        // 撤销 / 重开
        const restartX = width / 2 - Metrics.margin - undoSize / 2;
        const undoX = restartX - undoSize / 2 - gap - undoSize / 2;
        this.undoButton = this.createRoundButton('UndoButton', undoX, frames.undo, handlers.onUndo);
        this.createRoundButton('RestartButton', restartX, frames.restart, handlers.onRestart);

        // 状态行
        this.statusNode = createNode('StatusRow', parent, { width, height: Metrics.statusHeight }, new Vec3(0, layout.statusY, 0));
        const pillWidth = 250;
        const pill = createNode('MovesPill', this.statusNode, { width: pillWidth, height: 34 }, new Vec3(-width / 2 + Metrics.margin + pillWidth / 2, 0, 0));
        addSprite(pill, frames.btnRound, { size: { width: pillWidth, height: 34 }, sliced: true, color: Palette.ink });
        this.movesLabel = addLabel(pill, this.movesText(0, 6), 18, { color: Palette.white, bold: true, size: { width: pillWidth - 24, height: 34 } });

        createLabel(this.statusNode, 'GoalText', '围住小偷，别让他跑了！', 20,
            { color: Palette.white, bold: true, align: Label.HorizontalAlign.RIGHT, size: { width: 420, height: Metrics.statusHeight } },
            new Vec3(width / 2 - Metrics.margin - 210, 0, 0));
    }

    private createRoundButton(name: string, x: number, icon: SpriteFrame | null, onClick: () => void): Node {
        const button = createNode(name, this.node, { width: 46, height: 46 }, new Vec3(x, 0, 0));
        addSprite(button, this.frames.btnRound, { size: { width: 46, height: 46 }, sliced: true, color: Palette.cream });
        const iconNode = createNode(`${name}Icon`, button, { width: 24, height: 24 });
        addSprite(iconNode, icon, { size: { width: 24, height: 24 } });
        button.on(Node.EventType.TOUCH_END, onClick, this);
        return button;
    }

    private movesText(moves: number, total: number): string {
        return `已部署 ${moves} / ${total} 队警力`;
    }

    setMoves(moves: number, total: number): void {
        this.movesLabel.string = this.movesText(moves, total);
    }

    setUndoEnabled(enabled: boolean): void {
        const opacity = this.undoButton.getComponent(UIOpacity) ?? this.undoButton.addComponent(UIOpacity);
        opacity.opacity = enabled ? 255 : 110;
    }

    /** 警灯红蓝交替 */
    toggleSiren(): void {
        this.sirenFlip = !this.sirenFlip;
        this.siren.spriteFrame = (this.sirenFlip ? this.sirenBlue : this.sirenRed) ?? this.siren.spriteFrame;
    }

    /** 首次放置后的操作引导气泡；返回节点，由调用方负责销毁 */
    showCoach(text: string, worldPos: Vec3): Node | null {
        const root = this.node.parent;
        if (!root) return null;
        const node = createNode('Coach', root, { width: 200, height: 56 });
        addSprite(node, this.frames.coachBubble, { size: { width: 200, height: 56 }, sliced: true });
        createLabel(node, 'CoachText', text, 18, { color: Palette.white, bold: true, size: { width: 180, height: 48 } });
        node.setWorldPosition(worldPos.clone().add(new Vec3(0, 60, 0)));
        // 气泡必须压在弹层之下（设计稿 z-index 60 < overlay 100）
        const overlays = root.getChildByName('Overlays');
        if (overlays) node.setSiblingIndex(overlays.getSiblingIndex());
        return node;
    }
}
