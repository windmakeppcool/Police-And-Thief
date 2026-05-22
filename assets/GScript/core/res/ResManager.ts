import { _decorator, Asset, assetManager, AssetManager, Constructor } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('ResManager')
export class ResManager {

    loadBundle(bundleName: string, cb?: (bundle: AssetManager.Bundle | null) => void) {
        assetManager.loadBundle(bundleName, (e, bundle) => {
            if (e) {
                console.error(`加载资源包${bundleName}失败: ${e}`);
                cb?.(null);
                return;
            }
            console.log(`加载资源包${bundleName}成功`);
            cb?.(bundle);
        })
    }

    loadBundleAsync(bundleName: string): Promise<AssetManager.Bundle | null> {
        return new Promise<AssetManager.Bundle | null>(rs => {
            this.loadBundle(bundleName, rs);
        })
    }

    loadAssetAsync<T extends Asset>(bUrl: IBundleUrl, type: Constructor<T>): Promise<T | null> {
        return new Promise<T | null>(rs => {
            assetManager.loadBundle(bUrl.bundleName, type, (e, bundle) => {
                if (e || !bundle) {
                    console.error(`加载资源${bUrl.bundlePath}失败: ${e}`);
                    rs(null);
                    return;
                }
                console.log(`加载资源${bUrl.bundlePath}成功`);
                const onLoaded = (err: any, asset: T) => {
                    if (err || !asset) {
                        console.error(`加载资源${bUrl.bundlePath}失败: ${err}`);
                        rs(null);
                        return;
                    }
                    rs(asset);
                }
                bundle.load(bUrl.bundlePath, type, onLoaded);
            })
        })
    }

}


