import { isBoundary, keyOf } from "./grid.js";
export function hasEscapePath(board) {
    const start = board.thief;
    const isInside = (x, y) => x >= 0 && y >= 0 && x < board.width && y < board.height;
    const isBlockedKey = (k) => board.buildings.has(k) || board.police.has(k);
    const isPassable = (x, y) => isInside(x, y) && !isBlockedKey(`${x},${y}`);
    if (!isPassable(start.x, start.y)) {
        throw new Error("thief position is blocked");
    }
    const q = [{ x: start.x, y: start.y }];
    const visited = new Set([keyOf(start)]);
    while (q.length > 0) {
        const cur = q.shift();
        if (isBoundary(cur, board.width, board.height)) {
            return true;
        }
        const nexts = [
            { x: cur.x - 1, y: cur.y },
            { x: cur.x + 1, y: cur.y },
            { x: cur.x, y: cur.y - 1 },
            { x: cur.x, y: cur.y + 1 }
        ];
        for (const n of nexts) {
            if (!isPassable(n.x, n.y))
                continue;
            const k = `${n.x},${n.y}`;
            if (visited.has(k))
                continue;
            visited.add(k);
            q.push(n);
        }
    }
    return false;
}
