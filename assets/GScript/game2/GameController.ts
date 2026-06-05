import { _decorator, Component, instantiate, Node, Prefab, UITransform } from 'cc';
import { EViewLayer } from '../core/ui/EViewLayer';
import { GameSession } from './common/GameSession';
import { EXAMPLE_LEVEL } from './level/LevelData';
import { PrefabsCfg } from '../auto/PrefabCfg';
import { BoardGrid } from './piece/BoardGrid';
import { StructurePieces } from './piece/StructurePieces';
const { ccclass, property } = _decorator;

@ccclass('GameController')
export class GameController extends Component {
    static readonly viewLayer = EViewLayer.Anim;

    private session: GameSession = null!;
    private boardGrid: BoardGrid = null!;
    private structurePieces: StructurePieces[] = [];
    private readonly STRUCTURE_PREFAB_KEYS: (keyof typeof PrefabsCfg)[] = [
        // 'Structure1UI', 'Structure2UI', 'Structure3UI', 'Structure4UI'
        'Structure1UI'
    ]

    protected onLoad(): void {
        this.node.addComponent(UITransform);
        this.session = new GameSession(EXAMPLE_LEVEL);
    }

    protected async start(): Promise<void> {
        await this.initBoardGrid();
        await this.initStructures();
    }

    private async initBoardGrid() {
        const bUrl = PrefabsCfg.BoardGridView;
        const prefab = await gCtrl.res.loadAssetAsync(bUrl, Prefab);
        if (!prefab) {
            console.error('[GameController] 加载棋盘预制体失败');
            return;
        }

        const node = instantiate(prefab);
        node.parent = gCtrl.ui.getLayer(EViewLayer.Scene);
        this.boardGrid = node.getComponent(BoardGrid)!;
        this.boardGrid.renderGrid(this.session);
    }

    private async initStructures() {
        for (let i = 0; i < this.STRUCTURE_PREFAB_KEYS.length; i++) {
            const prefabKey = this.STRUCTURE_PREFAB_KEYS[i];
            const bUrl = PrefabsCfg[prefabKey];
            const prefab = await gCtrl.res.loadAssetAsync(bUrl, Prefab);
            if (!prefab) {
                console.error(`[StructureView] Failed to load prefab: ${prefabKey}`);
                return null;
            }
            const node = instantiate(prefab);
            node.parent = this.node;
        }
    }
}


