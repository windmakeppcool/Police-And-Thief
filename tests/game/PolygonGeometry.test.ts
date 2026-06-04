import { describe, expect, it } from 'vitest';
import { isPointInPolygon, isPointOnSegment } from '../../assets/GScript/game/domain/PolygonGeometry';

describe('PolygonGeometry', () => {
  it('detects points inside and outside a rectangle', () => {
    const rect = [
      { x: -1, y: -1 },
      { x: 1, y: -1 },
      { x: 1, y: 1 },
      { x: -1, y: 1 },
    ];

    expect(isPointInPolygon({ x: 0, y: 0 }, rect)).toBe(true);
    expect(isPointInPolygon({ x: 2, y: 0 }, rect)).toBe(false);
  });

  it('treats points on edges and vertices as inside', () => {
    const rect = [
      { x: -1, y: -1 },
      { x: 1, y: -1 },
      { x: 1, y: 1 },
      { x: -1, y: 1 },
    ];

    expect(isPointInPolygon({ x: 0, y: -1 }, rect)).toBe(true);
    expect(isPointInPolygon({ x: 1, y: 1 }, rect)).toBe(true);
  });

  it('supports concave L-shaped polygons', () => {
    const lShape = [
      { x: -32, y: -160 },
      { x: 96, y: -160 },
      { x: 96, y: -96 },
      { x: 32, y: -96 },
      { x: 32, y: 32 },
      { x: -32, y: 32 },
    ];

    expect(isPointInPolygon({ x: 0, y: 0 }, lShape)).toBe(true);
    expect(isPointInPolygon({ x: 64, y: -128 }, lShape)).toBe(true);
    expect(isPointInPolygon({ x: 64, y: 0 }, lShape)).toBe(false);
  });

  it('returns false for invalid polygons', () => {
    expect(isPointInPolygon({ x: 0, y: 0 }, [])).toBe(false);
    expect(isPointInPolygon({ x: 0, y: 0 }, [{ x: 0, y: 0 }, { x: 1, y: 1 }])).toBe(false);
  });

  it('detects points on a segment', () => {
    expect(isPointOnSegment({ x: 1, y: 1 }, { x: 0, y: 0 }, { x: 2, y: 2 })).toBe(true);
    expect(isPointOnSegment({ x: 3, y: 3 }, { x: 0, y: 0 }, { x: 2, y: 2 })).toBe(false);
    expect(isPointOnSegment({ x: 1, y: 2 }, { x: 0, y: 0 }, { x: 2, y: 2 })).toBe(false);
  });
});
