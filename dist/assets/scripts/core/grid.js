export function keyOf(pos) {
    return `${pos.x},${pos.y}`;
}
export function parseKey(key) {
    const [x, y] = key.split(",", 2);
    return { x: Number(x), y: Number(y) };
}
export function neighbors4(pos) {
    return [
        { x: pos.x - 1, y: pos.y },
        { x: pos.x + 1, y: pos.y },
        { x: pos.x, y: pos.y - 1 },
        { x: pos.x, y: pos.y + 1 }
    ];
}
export function isBoundary(pos, width, height) {
    return pos.x === 0 || pos.y === 0 || pos.x === width - 1 || pos.y === height - 1;
}
