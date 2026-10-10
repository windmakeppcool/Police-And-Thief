import { Label, Node, Vec3 } from 'cc';
import { DesignFrames, PocketPalette } from './DesignAssets';
import { GameLayout } from './Layout';
import { addSprite, createLabel, createNode } from '../../core/ui/UIFactory';

/** 背景（对应 pocket-patrol.css `.game-screen { background: #eff3e5; }`）+ 远景天际线 + 棋盘与托盘之间的街景装饰带 */
export class GameSceneView {
    readonly node: Node;
    private readonly town: Node;
    private readonly carLight: Node;

    constructor(parent: Node, private readonly frames: DesignFrames, private readonly layout: GameLayout) {
        const { width, height } = layout;
        this.node = createNode('SceneDecor', parent, { width, height });

        // 底色：薄荷米，与设计稿游戏界面的 #eff3e5 近似（取调色板 mint 最接近的标准色）
        const sky = createNode('Sky', this.node, { width, height });
        addSprite(sky, frames.solid, { size: { width, height }, color: PocketPalette.mint });

        const skylineHeight = Math.round(width * 132 / 750);
        const skyline = createNode('Skyline', this.node, { width, height: skylineHeight },
            new Vec3(0, -height / 2 + skylineHeight / 2, 0));
        addSprite(skyline, frames.skyline, { size: { width, height: skylineHeight } });

        this.town = createNode('Town', this.node, { width, height: layout.townHeight }, new Vec3(0, layout.townY, 0));
        const scale = Math.min(1, (width - 160) / 760);
        const items: { frame: keyof DesignFrames; x: number; scale: number }[] = [
            { frame: 'houseRed', x: -330, scale: 0.55 },
            { frame: 'treeLarge', x: -250, scale: 0.65 },
            { frame: 'policeCar', x: -120, scale: 0.72 },
            { frame: 'treeSmall', x: 20, scale: 0.75 },
            { frame: 'houseYellow', x: 120, scale: 0.6 },
            { frame: 'treeLarge', x: 250, scale: 0.6 },
            { frame: 'houseRed', x: 330, scale: 0.45 },
        ];
        for (const item of items) {
            const size = this.frameSize(item.frame, item.scale);
            const node = createNode(`Town_${item.frame}_${item.x}`, this.town, size, new Vec3(item.x * scale, this.townOffsetY(size.height), 0));
            addSprite(node, this.frames[item.frame], { size });
        }

        // 警车顶灯：与警灯条同步闪烁
        const carSize = this.frameSize('policeCarLight', 0.72);
        this.carLight = createNode('PoliceCarLight', this.town, carSize,
            new Vec3(-120 * scale, this.townOffsetY(carSize.height), 0));
        addSprite(this.carLight, frames.policeCarLight, { size: carSize });
    }

    private townOffsetY(itemHeight: number): number {
        return -this.layout.townHeight / 2 + itemHeight / 2;
    }

    private frameSize(key: keyof DesignFrames, scale: number): { width: number; height: number } {
        const frame = this.frames[key];
        const width = frame?.rect.width ?? 64;
        const height = frame?.rect.height ?? 64;
        return { width: Math.round(width * scale), height: Math.round(height * scale) };
    }

    toggleCarLight(): void {
        this.carLight.active = !this.carLight.active;
    }
}

/** 开场 / 胜利弹层与首次操作引导 */
export class GameOverlayView {
    readonly node: Node;
    private readonly startCard: Node;
    private readonly winCard: Node;
    private readonly winText: Label;
    private readonly dim: Node;

    constructor(parent: Node, private readonly frames: DesignFrames, layout: GameLayout) {
        const { width, height } = layout;
        this.node = createNode('Overlays', parent, { width, height });

        this.dim = createNode('Dim', this.node, { width, height });
        addSprite(this.dim, frames.overlayDim, { size: { width, height } });

        this.startCard = this.buildStartCard();
        this.winCard = this.buildWinCard();
        this.winText = this.winCard.getChildByName('WinText')!.getComponent(Label)!;
        this.winCard.active = false;
        this.updateDim();
    }

    /** 遮罩只在有弹层显示时出现，避免常驻压暗画面 */
    private updateDim(): void {
        this.dim.active = this.startCard.active || this.winCard.active;
    }

    private buildCard(name: string): Node {
        const card = createNode(name, this.node, { width: 400, height: 380 });
        addSprite(card, this.frames.cardBg, { size: { width: 400, height: 380 }, sliced: true, color: PocketPalette.cream });
        return card;
    }

    private buildStartCard(): Node {
        const card = this.buildCard('StartCard');
        const plate = createNode('WantedPlate', card, { width: 280, height: 120 }, new Vec3(0, 110, 0));
        plate.angle = -2.5;
        addSprite(plate, this.frames.btnRound, { size: { width: 280, height: 120 }, sliced: true, color: PocketPalette.whiteish });
        createLabel(plate, 'WantedSmall', 'WANTED · 通缉令', 16, { color: PocketPalette.orange, bold: true }, new Vec3(0, 34, 0));
        createLabel(plate, 'WantedTitle', '警察抓小偷', 40, { color: PocketPalette.ink, bold: true }, new Vec3(0, -16, 0));

        createLabel(card, 'StartDesc', '小偷躲进了积木小镇！\n把警察小队拖进街区、点按转向，\n封住他上下左右所有去路就算抓到。', 18,
            { color: PocketPalette.ink, size: { width: 340, height: 110 } }, new Vec3(0, 0, 0));

        this.createPrimaryButton(card, 'StartButton', '开始巡逻', new Vec3(0, -122, 0));
        return card;
    }

    private buildWinCard(): Node {
        const card = this.buildCard('WinCard');
        // 通关固定得 1 颗星，不做多档评级，所以只画一颗
        const star = createNode('WinStar', card, { width: 56, height: 56 }, new Vec3(0, 128, 0));
        addSprite(star, this.frames.starActive, { size: { width: 56, height: 56 } });
        createLabel(card, 'WinTitle', '抓住啦！', 40, { color: PocketPalette.ink, bold: true }, new Vec3(0, 54, 0));
        const text = createLabel(card, 'WinText', '', 18, { color: PocketPalette.ink, size: { width: 320, height: 80 } }, new Vec3(0, -10, 0));
        text.getComponent(Label)!.enableWrapText = true;
        this.createPrimaryButton(card, 'AgainButton', '再来一局', new Vec3(0, -118, 0));
        const report = createNode('ReportButton', card, { width: 220, height: 36 }, new Vec3(0, -168, 0));
        createLabel(report, 'ReportText', '查看巡逻报告 ›', 20,
            { color: PocketPalette.mintDeep, size: { width: 220, height: 36 } });
        return card;
    }

    private createPrimaryButton(parent: Node, name: string, text: string, position: Vec3): Node {
        const button = createNode(name, parent, { width: 230, height: 64 }, position);
        const sprite = addSprite(button, this.frames.btnPrimary, { size: { width: 230, height: 64 }, sliced: true });
        button.on(Node.EventType.TOUCH_START, () => { sprite.spriteFrame = this.frames.btnPrimaryPressed ?? sprite.spriteFrame; });
        button.on(Node.EventType.TOUCH_END, () => { sprite.spriteFrame = this.frames.btnPrimary ?? sprite.spriteFrame; });
        button.on(Node.EventType.TOUCH_CANCEL, () => { sprite.spriteFrame = this.frames.btnPrimary ?? sprite.spriteFrame; });
        createLabel(button, `${name}Text`, text, 28, { color: PocketPalette.ink, bold: true, size: { width: 200, height: 64 } });
        return button;
    }

    bindStart(onStart: () => void): void {
        this.startCard.getChildByName('StartButton')!.on(Node.EventType.TOUCH_END, onStart, this);
    }

    bindAgain(onAgain: () => void): void {
        this.winCard.getChildByName('AgainButton')!.on(Node.EventType.TOUCH_END, onAgain, this);
    }

    bindReport(onReport: () => void): void {
        this.winCard.getChildByName('ReportButton')!.on(Node.EventType.TOUCH_END, onReport, this);
    }

    showStart(): void {
        this.startCard.active = true;
        this.updateDim();
    }

    hideStart(): void {
        this.startCard.active = false;
        this.updateDim();
    }

    get startVisible(): boolean {
        return this.startCard.active;
    }

    /** 通关固定得 1 颗星，星数不再是变量，只需展示步数 */
    showWin(moves: number): void {
        this.winText.string = `只用 ${moves} 队警力就封锁了小镇，\n小偷插翅难逃！`;
        this.winCard.active = true;
        this.updateDim();
    }

    hideWin(): void {
        this.winCard.active = false;
        this.updateDim();
    }
}
