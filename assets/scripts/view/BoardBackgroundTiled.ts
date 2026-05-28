import { _decorator, Component, Sprite, SpriteFrame, UITransform, Size } from "cc";

const { ccclass, property } = _decorator;

@ccclass("BoardBackgroundTiled")
export class BoardBackgroundTiled extends Component {
  @property({ type: SpriteFrame })
  public tileSpriteFrame: SpriteFrame | null = null;

  @property
  public gridSize = 8;

  @property
  public tilePixelSize = 64;

  public apply(): void {
    const sprite = this.getOrAdd(Sprite);
    const ui = this.getOrAdd(UITransform);

    if (!this.tileSpriteFrame) {
      throw new Error("tileSpriteFrame is required");
    }

    sprite.spriteFrame = this.tileSpriteFrame;
    sprite.sizeMode = Sprite.SizeMode.CUSTOM;
    sprite.type = Sprite.Type.TILED;

    const w = this.gridSize * this.tilePixelSize;
    const h = this.gridSize * this.tilePixelSize;
    ui.setContentSize(new Size(w, h));
  }

  protected onLoad(): void {
    this.apply();
  }

  private getOrAdd<T extends Component>(Ctor: new () => T): T {
    const existed = this.getComponent(Ctor);
    if (existed) return existed;
    return this.addComponent(Ctor);
  }
}

