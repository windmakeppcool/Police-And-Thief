import { _decorator, Canvas, ResolutionPolicy, Size, view, screen, Constructor, Component, instantiate, assetManager, Prefab, Node, UITransform } from 'cc';
import { EViewLayer, MyLayer } from './EViewLayer';
import { ResLoader } from '../res/ResLoader';
import { getUIClassByUrl } from '../res/ResConst';
const { ccclass, property } = _decorator;

export const G_VIEW_SIZE = new Size(0, 0);
function adapterScreen() {
    let resolutionPolicy: ResolutionPolicy = view.getResolutionPolicy();
    let designSize = view.getDesignResolutionSize();
    let frameSize = screen.windowSize;
    let frameW = frameSize.width;
    let frameH = frameSize.height;
    const isScreenWidthLarger = (frameW / frameH) > (designSize.width / designSize.height);
    let targetResolutionPolicy = isScreenWidthLarger ? ResolutionPolicy.FIXED_HEIGHT : ResolutionPolicy.FIXED_WIDTH;
    if (targetResolutionPolicy !== resolutionPolicy.getContentStrategy().strategy) {
        view.setDesignResolutionSize(designSize.width, designSize.height, targetResolutionPolicy);
        view.emit("canvas-resize");
    }
    if (isScreenWidthLarger) {
        G_VIEW_SIZE.width = Math.ceil(designSize.height * frameSize.width / frameSize.height);
        G_VIEW_SIZE.height = designSize.height;
    } else {
        G_VIEW_SIZE.width = designSize.width;
        G_VIEW_SIZE.height = Math.ceil(designSize.width * frameSize.height / frameSize.width);
    }
    console.log(`屏幕${isScreenWidthLarger ? "更宽, 高度适配" : "更高, 宽度适配"} 设计分辨率比例下的屏幕尺寸: ${G_VIEW_SIZE.width}x${G_VIEW_SIZE.height}`);
    return isScreenWidthLarger;
}


export class UIManager {
    private m_Canvas: Canvas = null!;
    private m_Layers: MyLayer[] = [];

    init(canvas2d: Canvas) {
        this.m_Canvas = canvas2d;
        adapterScreen();
        for (let layer = EViewLayer.Scene; layer <= EViewLayer.Toast; layer++) {
            this.m_Layers.push(new MyLayer(layer, this.m_Canvas, EViewLayer[layer]));
        }
    }

    getLayer(layer: EViewLayer): Node {
        return this.m_Layers[layer].node;
    }

    async open<UI extends Component>(uiClass: Constructor<UI> & { readonly viewLayer: EViewLayer; }): Promise<UI> {
        const viewLayer: EViewLayer = typeof (uiClass.viewLayer) == 'number' ? uiClass.viewLayer : EViewLayer.UI;
        const resLoader = new ResLoader();
        resLoader.addUI(uiClass);
        await resLoader.load();
        let ui = this.instantiate(uiClass);
        this.m_Layers[viewLayer].node.addChild(ui.node);
        const uiTransform = ui.node.getComponent(UITransform);
        if (uiTransform) {
            uiTransform.setContentSize(G_VIEW_SIZE.clone());
        }
        resLoader.autoRelease(ui);
        return ui;
    }

    instantiate<UE extends Component>(ueClass: Constructor<UE>): UE {
        let bUrl = getUIClassByUrl(ueClass);
        let bundle = assetManager.getBundle(bUrl.bundleName);
        if (!bundle) {
            throw new Error(`实例化UI失败: Bundle "${bUrl.bundleName}" 尚未加载, 请先调用 gCtrl.res.loadBundleAsync("${bUrl.bundleName}")`);
        }
        let prefab: Prefab = bundle.get(bUrl.bundlePath, Prefab);
        if (!prefab) {
            throw new Error(`实例化UI失败: 在Bundle "${bUrl.bundleName}" 中找不到Prefab "${bUrl.bundlePath}", 请检查 PrefabCfg 中的路径与磁盘是否一致`);
        }
        let node: Node = instantiate(prefab);
        return (node.getComponent(ueClass as any) || node.addComponent(ueClass as any)) as any as UE;
    }

}


