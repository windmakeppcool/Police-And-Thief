import { Label, Node, Vec3 } from 'cc';
import { DesignFrames, Palette } from './DesignAssets';
import { GameLayout, Metrics } from './Layout';
import { addSprite, createLabel, createNode } from './UIFactory';

/** 底部托盘：待部署警力的槽位容器 */
export class GameTrayView {
    readonly node: Node;
    private readonly slots: Node[] = [];

    constructor(parent: Node, frames: DesignFrames, layout: GameLayout, slotCount: number) {
        this.node = createNode('Tray', parent, { width: Metrics.trayWidth, height: Metrics.trayHeight }, new Vec3(0, layout.trayY, 0));
        addSprite(this.node, frames.trayBg, {
            size: { width: Metrics.trayWidth, height: Metrics.trayHeight },
            sliced: true,
            color: Palette.cream,
        });

        const halfW = Metrics.trayWidth / 2;
        const halfH = Metrics.trayHeight / 2;

        createLabel(this.node, 'TrayLabel', '待部署警力', 24,
            { color: Palette.ink, bold: true, align: Label.HorizontalAlign.LEFT, size: { width: 240, height: 30 } },
            new Vec3(-halfW + 24 + 120, halfH - 26, 0));

        const tipWidth = 200;
        const tip = createNode('TrayTip', this.node, { width: tipWidth, height: 30 }, new Vec3(halfW - 24 - tipWidth / 2, halfH - 26, 0));
        addSprite(tip, frames.btnRound, { size: { width: tipWidth, height: 30 }, sliced: true, color: Palette.police });
        createLabel(tip, 'TrayTipText', '拖到街区 · 点按转向', 16,
            { color: Palette.white, bold: true, size: { width: tipWidth - 16, height: 30 } });

        const totalWidth = slotCount * Metrics.slotWidth + (slotCount - 1) * Metrics.slotGap;
        const startX = -totalWidth / 2 + Metrics.slotWidth / 2;
        const slotY = -halfH + Metrics.slotHeight / 2 + 14;
        for (let i = 0; i < slotCount; i++) {
            const slot = createNode(`Slot_${i}`, this.node,
                { width: Metrics.slotWidth, height: Metrics.slotHeight },
                new Vec3(startX + i * (Metrics.slotWidth + Metrics.slotGap), slotY, 0));
            addSprite(slot, frames.slotDashed, { size: { width: Metrics.slotWidth, height: Metrics.slotHeight } });
            this.slots.push(slot);
        }
    }

    getSlot(index: number): Node {
        return this.slots[Math.max(0, Math.min(this.slots.length - 1, index))];
    }

}
