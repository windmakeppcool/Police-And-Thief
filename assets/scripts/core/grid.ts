import type { Vec2 } from "./types.js";

export function keyOf(pos: Vec2): string {
  return `${pos.x},${pos.y}`;
}

export function parseKey(key: string): Vec2 {
  const [x, y] = key.split(",", 2);
  return { x: Number(x), y: Number(y) };
}

export function neighbors4(pos: Vec2): Vec2[] {
  return [
    { x: pos.x - 1, y: pos.y },
    { x: pos.x + 1, y: pos.y },
    { x: pos.x, y: pos.y - 1 },
    { x: pos.x, y: pos.y + 1 }
  ];
}

export function isBoundary(pos: Vec2, width: number, height: number): boolean {
  return pos.x === 0 || pos.y === 0 || pos.x === width - 1 || pos.y === height - 1;
}

