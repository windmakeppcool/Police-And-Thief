export interface PolygonPoint {
    x: number;
    y: number;
}

const EPSILON = 1e-6;

export function isPointInPolygon(point: PolygonPoint, polygon: readonly PolygonPoint[]): boolean {
    if (polygon.length < 3) return false;

    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const a = polygon[j];
        const b = polygon[i];

        if (isPointOnSegment(point, a, b)) return true;

        const intersects = (a.y > point.y) !== (b.y > point.y)
            && point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x;
        if (intersects) inside = !inside;
    }

    return inside;
}

export function isPointOnSegment(point: PolygonPoint, a: PolygonPoint, b: PolygonPoint): boolean {
    const cross = (point.y - a.y) * (b.x - a.x) - (point.x - a.x) * (b.y - a.y);
    if (Math.abs(cross) > EPSILON) return false;

    const dot = (point.x - a.x) * (b.x - a.x) + (point.y - a.y) * (b.y - a.y);
    if (dot < -EPSILON) return false;

    const squaredLength = (b.x - a.x) ** 2 + (b.y - a.y) ** 2;
    return dot <= squaredLength + EPSILON;
}
