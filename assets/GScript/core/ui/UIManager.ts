import { _decorator, Canvas, ResolutionPolicy, Size, view, screen } from 'cc';
import { EViewLayer, MyLayer } from './EViewLayer';
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
}

const g_Key2Url = new Map<string, IBundleUrl>();
export function registerBUrlByCfg(cfg: {[uiClassName: string]: IBundleUrl}) {
    for (let uiClassName in cfg) {
        console.log(`注册预制体: ${uiClassName}`);
        g_Key2Url.set(uiClassName, cfg[uiClassName]);
    }
}