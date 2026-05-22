import { _decorator, assetManager, AssetManager, Canvas, Component, Node } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('boost')
export class boost extends Component {
    @property(Canvas) private canvas: Canvas = null;

    start() {

    }

    private loadBundle(bundleName: string): Promise<AssetManager.Bundle | null> {
        return new Promise<AssetManager.Bundle | null>(rs => {
            assetManager.loadBundle(bundleName, (err, bundle) => {
                if (err) {
                    console.error(`加载资源包${bundleName}失败: ${err}`);
                    rs(null);
                } else {
                    rs(bundle);
                }
            })
        });
    }



}


