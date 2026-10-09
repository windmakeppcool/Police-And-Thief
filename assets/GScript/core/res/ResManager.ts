import { _decorator, Asset, assetManager, AssetManager, Constructor, SpriteFrame, Texture2D } from 'cc';
const { ccclass } = _decorator;

/**
 * 图片子资源在 bundle 路径索引中的名字。
 *
 * 编辑器预览与构建产物的 bundle 索引格式并不一致：构建产物把子资源挂在同一个
 * path 下，靠 type 区分（`image/a` 同时对应 ImageAsset / Texture2D / SpriteFrame）；
 * 编辑器预览则把子资源拆成独立 path（`image/a`、`image/a/texture`、
 * `image/a/spriteFrame`）。此时按标准 path 配 SpriteFrame 会匹配到 ImageAsset 而失败。
 * 标准 path 命中不了时按这里的名字回退，两种索引格式就都能加载到。
 */
const SUB_ASSET_PATH_SUFFIX = new Map<Constructor<Asset>, string>([
    [SpriteFrame as Constructor<Asset>, 'spriteFrame'],
    [Texture2D as Constructor<Asset>, 'texture'],
]);

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
            assetManager.loadBundle(bUrl.bundleName, (e, bundle) => {
                if (e || !bundle) {
                    console.error(`加载资源${bUrl.bundlePath}失败: ${e}`);
                    rs(null);
                    return;
                }
                const onLoaded = (err: any, asset: T) => {
                    if (err || !asset) {
                        console.error(`加载资源${bUrl.bundlePath}失败: ${err}`);
                        rs(null);
                        return;
                    }
                    console.log(`加载资源${bUrl.bundlePath}成功`);
                    rs(asset);
                }
                bundle.load(bUrl.bundlePath, type, (err, asset) => {
                    if (!err && asset) {
                        onLoaded(null, asset);
                        return;
                    }
                    const suffix = SUB_ASSET_PATH_SUFFIX.get(type as Constructor<Asset>);
                    if (!suffix) {
                        onLoaded(err, asset);
                        return;
                    }
                    // 标准 path 下只挂了主资源，改用子资源 path 再试一次
                    bundle.load(`${bUrl.bundlePath}/${suffix}`, type, onLoaded);
                });
            })
        })
    }

}


