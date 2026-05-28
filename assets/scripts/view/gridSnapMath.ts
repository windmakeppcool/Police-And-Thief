export type Cell = Readonly<{ x: number; y: number }>;
export type Rot = 0 | 1 | 2 | 3;

export function rotateCW(p: Cell): Cell {
  return { x: p.y, y: -p.x };
}

export function normalizeOffsets(offsets: ReadonlyArray<Cell>): Cell[] {
  let minX = Infinity;
  let minY = Infinity;
  for (const o of offsets) {
    if (o.x < minX) minX = o.x;
    if (o.y < minY) minY = o.y;
  }
  return offsets.map((o) => ({ x: o.x - minX, y: o.y - minY }));
}

export function rotatedOffsets(base: ReadonlyArray<Cell>, rot: Rot): Cell[] {
  let out = base.map((o) => ({ x: o.x, y: o.y }));
  for (let i = 0; i < rot; i++) out = out.map(rotateCW);
  return normalizeOffsets(out);
}

