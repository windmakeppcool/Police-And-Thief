import type { BuildingVariant, LevelId, PoliceVariant, Vec2 } from "./types.js";
import { BoardState } from "./board.js";
import { validateLevelConfig } from "./validation.js";

export type LevelBuilding = Readonly<{ x: number; y: number; variant?: BuildingVariant }>;
export type LevelPolicePoolItem = Readonly<{ variant: PoliceVariant; count: number }>;

export type LevelConstraints = Readonly<{
  maxPoliceUsed?: number;
}>;

export type LevelMeta = Readonly<{
  title?: string;
  difficulty?: number;
}>;

export type LevelConfig = Readonly<{
  id: LevelId;
  size: number;
  thief: Vec2;
  buildings: ReadonlyArray<LevelBuilding>;
  policePool: ReadonlyArray<LevelPolicePoolItem>;
  constraints?: LevelConstraints;
  meta?: LevelMeta;
}>;

export type LoadedLevel = Readonly<{
  config: LevelConfig;
  board: BoardState;
  policeInventory: ReadonlyMap<PoliceVariant, number>;
  constraints: LevelConstraints;
}>;

export function loadLevel(config: LevelConfig): LoadedLevel {
  validateLevelConfig(config);

  const board = new BoardState({
    width: config.size,
    height: config.size,
    thief: config.thief
  });

  for (const b of config.buildings) {
    board.setBuilding({ x: b.x, y: b.y }, b.variant ?? "default");
  }

  const inventory = new Map<PoliceVariant, number>();
  for (const p of config.policePool) {
    inventory.set(p.variant, (inventory.get(p.variant) ?? 0) + p.count);
  }

  return {
    config,
    board,
    policeInventory: inventory,
    constraints: config.constraints ?? {}
  };
}

