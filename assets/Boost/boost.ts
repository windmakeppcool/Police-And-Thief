import { _decorator, assetManager, AssetManager, Canvas, Component, Node } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('boost')
export class boost extends Component {
    @property(Canvas) private canvas2d: Canvas = null;
    @property(Node) private toReleaseNode: Node = null!;

    async start() {
        try {
            /** 加载全局脚本包 */
            const bundle = await this.loadBundle("GScriptBN");
            if (!bundle) {
                console.error(`加载全局脚本包失败`);
                console.error("GScriptBN Bundle 加载失败，游戏无法启动");
                return;
            }
            const gCtrl = this.node.addComponent("GCtrl");
            await (gCtrl as any).init({ 
                canvas2d: this.canvas2d,
                releaseBoostFun: () => {
                    // 这里进行销毁首场景的渲染节点和释放资源等操作
                    if (this.toReleaseNode === null) {
                        return;
                    }
                    this.toReleaseNode.destroy();
                    this.toReleaseNode = null;
                }
            });

        } catch (error) {
            console.error(`加载资源包失败: ${error}`);
            console.error(`请检查资源包是否正确加载`);
        }
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


