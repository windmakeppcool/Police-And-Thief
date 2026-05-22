import type { BuildingVariant, PoliceVariant, Vec2 } from "./types.js";
import { keyOf, neighbors4 as neighbors4Raw } from "./grid.js";

export type BoardSnapshot = Readonly<{
  width: number;
  height: number;
  thief: Vec2;
  buildings: ReadonlyMap<string, BuildingVariant>;
  police: ReadonlyMap<string, PoliceVariant>;
}>;

export class BoardState {
  public readonly width: number;
  public readonly height: number;
  public thief: Vec2;
  private readonly buildings: Map<string, BuildingVariant>;
  private readonly police: Map<string, PoliceVariant>;

  public constructor(init: { width: number; height: number; thief: Vec2 }) {
    this.width = init.width;
    this.height = init.height;
    this.thief = init.thief;
    this.buildings = new Map();
    this.police = new Map();
  }

  public snapshot(): BoardSnapshot {
    return {
      width: this.width,
      height: this.height,
      thief: this.thief,
      buildings: this.buildings,
      police: this.police
    };
  }

  public isInside(pos: Vec2): boolean {
    return pos.x >= 0 && pos.y >= 0 && pos.x < this.width && pos.y < this.height;
  }

  public hasBuilding(pos: Vec2): boolean {
    return this.buildings.has(keyOf(pos));
  }

  public hasPolice(pos: Vec2): boolean {
    return this.police.has(keyOf(pos));
  }

  public isBlocked(pos: Vec2): boolean {
    const k = keyOf(pos);
    return this.buildings.has(k) || this.police.has(k);
  }

  public isPassable(pos: Vec2): boolean {
    return this.isInside(pos) && !this.isBlocked(pos);
  }

  public setBuilding(pos: Vec2, variant: BuildingVariant = "default"): void {
    this.buildings.set(keyOf(pos), variant);
  }

  public setPolice(pos: Vec2, variant: PoliceVariant = "default"): void {
    this.police.set(keyOf(pos), variant);
  }

  public removePolice(pos: Vec2): boolean {
    return this.police.delete(keyOf(pos));
  }

  public getPoliceVariant(pos: Vec2): PoliceVariant | undefined {
    return this.police.get(keyOf(pos));
  }

  public neighbors4(pos: Vec2): Vec2[] {
    return neighbors4Raw(pos).filter((n) => this.isInside(n));
  }
}

