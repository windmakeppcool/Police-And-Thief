import { _decorator, AssetManager, Canvas, Component, Node } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('boost')
export class boost extends Component {
    @property(Canvas) private canvas: Canvas = null;
    
    start() {

    }

    private loadBundle(bundleName: string): Promise<AssetManager.Bundle> {
        
    }
}


