import type { Vec2 } from "./types.js";
import type { LevelConfig } from "./level.js";
import { keyOf } from "./grid.js";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function isInt(n: number): boolean {
  return Number.isFinite(n) && Math.floor(n) === n;
}

function inside(pos: Vec2, size: number): boolean {
  return pos.x >= 0 && pos.y >= 0 && pos.x < size && pos.y < size;
}

export function validateLevelConfig(config: LevelConfig): void {
  assert(typeof config.id === "string" && config.id.length > 0, "level.id invalid");
  assert(isInt(config.size) && config.size >= 2, "level.size invalid");

  assert(isInt(config.thief.x) && isInt(config.thief.y), "level.thief invalid");
  assert(inside(config.thief, config.size), "level.thief out of range");

  const thiefKey = keyOf(config.thief);
  const buildingKeys = new Set<string>();

  for (const b of config.buildings) {
    assert(isInt(b.x) && isInt(b.y), "level.buildings contains invalid pos");
    const k = keyOf({ x: b.x, y: b.y });
    assert(k !== thiefKey, "level.buildings overlaps thief");
    assert(!buildingKeys.has(k), "level.buildings has duplicates");
    assert(inside({ x: b.x, y: b.y }, config.size), "level.buildings out of range");
    buildingKeys.add(k);
  }

  for (const p of config.policePool) {
    assert(typeof p.variant === "string" && p.variant.length > 0, "level.policePool variant invalid");
    assert(isInt(p.count) && p.count >= 0, "level.policePool count invalid");
  }

  if (config.constraints?.maxPoliceUsed !== undefined) {
    assert(
      isInt(config.constraints.maxPoliceUsed) && config.constraints.maxPoliceUsed >= 0,
      "level.constraints.maxPoliceUsed invalid"
    );
  }
}

