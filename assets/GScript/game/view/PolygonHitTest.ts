import { PolygonCollider2D, UITransform, Vec2, Vec3, type Node } from 'cc';
import { isPointInPolygon } from '../domain/PolygonGeometry';

export function isTouchInsidePolygonCollider(node: Node, uiLocation: Readonly<Vec2>): boolean {
    const transform = node.getComponent(UITransform);
    if (!transform) return false;

    const localPoint = transform.convertToNodeSpaceAR(new Vec3(uiLocation.x, uiLocation.y, 0));
    const colliders = node.getComponents(PolygonCollider2D);
    for (const collider of colliders) {
        if (!collider.enabled || collider.points.length < 3) continue;

        const offset = collider.offset;
        const polygon = collider.points.map(point => ({
            x: point.x + offset.x,
            y: point.y + offset.y,
        }));
        if (isPointInPolygon(localPoint, polygon)) return true;
    }

    return false;
}
