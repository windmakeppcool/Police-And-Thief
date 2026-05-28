import { _decorator, Component, Node, UITransform, Vec2, Vec3, Size } from "cc";
import { rotatedOffsets, type Cell, type Rot } from "./gridSnapMath";

const { ccclass, property } = _decorator;

@ccclass("GridSnapper")
export class GridSnapper extends Component {
  @property(Node)
  public boardNode: Node | null = null;

  @property
  public gridSize = 8;

  @property
  public tileSize = 64;

  @property
  public rotation: Rot = 0;

  @property(Node)
  public pieceNode: Node | null = null;

  public readonly baseLOffsets: ReadonlyArray<Cell> = [
    { x: 0, y: 0 },
    { x: 0, y: 1 },
    { x: 0, y: 2 },
    { x: 1, y: 2 }
  ];

  public rotateNext(): void {
    this.rotation = (((this.rotation + 1) % 4) as Rot) ?? 0;
    this.applyRotationToPiece();
  }

  public setRotation(rot: Rot): void {
    this.rotation = rot;
    this.applyRotationToPiece();
  }

  public snapPieceToUILocation(uiPos: Vec2): Readonly<{
    origin: Cell;
    occupied: Cell[];
    okInBounds: boolean;
  }> {
    const board = this.getBoardUI();
    const local = board.convertToNodeSpaceAR(new Vec3(uiPos.x, uiPos.y, 0));
    const origin = this.localToCell(local);
    const offsets = rotatedOffsets(this.baseLOffsets, this.rotation);
    const occupied = offsets.map((o) => ({ x: origin.x + o.x, y: origin.y + o.y }));
    const okInBounds = occupied.every((c) => c.x >= 0 && c.y >= 0 && c.x < this.gridSize && c.y < this.gridSize);

    const snappedLocal = this.cellToLocal(origin);
    if (this.pieceNode) {
      const world = board.convertToWorldSpaceAR(snappedLocal);
      this.pieceNode.setWorldPosition(world);
    }

    return { origin, occupied, okInBounds };
  }

  public setBoardPixelSize(): void {
    const board = this.getBoardUI();
    board.setContentSize(new Size(this.gridSize * this.tileSize, this.gridSize * this.tileSize));
  }

  private applyRotationToPiece(): void {
    if (!this.pieceNode) return;
    this.pieceNode.setRotationFromEuler(0, 0, -90 * this.rotation);
  }

  private getBoardUI(): UITransform {
    if (!this.boardNode) throw new Error("boardNode is required");
    const ui = this.boardNode.getComponent(UITransform);
    if (!ui) throw new Error("boardNode must have UITransform");
    return ui;
  }

  private localToCell(local: Vec3): Cell {
    const half = (this.gridSize * this.tileSize) / 2;
    const x = Math.round((local.x + half - this.tileSize / 2) / this.tileSize);
    const y = Math.round((local.y + half - this.tileSize / 2) / this.tileSize);
    return { x, y };
  }

  private cellToLocal(cell: Cell): Vec3 {
    const half = (this.gridSize * this.tileSize) / 2;
    const lx = cell.x * this.tileSize - half + this.tileSize / 2;
    const ly = cell.y * this.tileSize - half + this.tileSize / 2;
    return new Vec3(lx, ly, 0);
  }
}

