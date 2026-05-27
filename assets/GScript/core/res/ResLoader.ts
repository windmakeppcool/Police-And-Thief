import { _decorator, Asset, Component, Constructor, Node, Prefab } from 'cc';
import { DestroyHook } from './DestroyHook';
import { getUIClassByUrl } from './ResConst';
const { ccclass, property } = _decorator;

@ccclass('ResLoader')
export class ResLoader extends Component {
    /** 待加载的资源 */
    private toLoadAssets: {
        type: Constructor<Asset> | null,
        bUrl: IBundleUrl
    }[] = [];

    /** 已加载的资源 */
    private loadedAssets: Asset[] = [];
    /** 标记已调用释放资源接口 */
    private m_Released: boolean = false;

    addAsset(bUrl: IBundleUrl, type: Constructor<Asset> | null) {
        this.toLoadAssets.push({ type: type, bUrl: bUrl });
        return this;
    }

    async load() {
        let toLoadPromises = this.toLoadAssets.map( toLoad => gCtrl.res.loadAssetAsync(toLoad.bUrl, toLoad.type));
        let toLoadResults = await Promise.all(toLoadPromises);
        toLoadResults.forEach((asset, i) => {
            if (!asset) {
                console.error(`加载资源${this.toLoadAssets[i].bUrl.bundlePath}失败`);
                return;
            }
            asset.addRef();
            if (!this.m_Released) {
                this.loadedAssets.push(asset);
            } else {
                asset.decRef(true);
            }
        })
    }

    addUI<UI extends Component>(uiClass: Constructor<UI>) {
        this.addAsset(getUIClassByUrl(uiClass), Prefab);
        if (typeof uiClass['R'] === "function") {
            (uiClass['R'] as Function).call(uiClass, this);
        }
        return this;

    }

    /** 释放已加载资源的引用计数 */
    releaseResRef() {
        if (this.m_Released) return;
        this.m_Released = true;
        while (this.loadedAssets.length) {
            this.loadedAssets.pop().decRef(true);
        }
    }

    autoRelease(comp: Component) {
        comp.node.addComponent(DestroyHook).addHook(() => {
            this.releaseResRef();
        })
        return this;
    }

}


