import { BoardState } from "./board.js";
import { validateLevelConfig } from "./validation.js";
export function loadLevel(config) {
    validateLevelConfig(config);
    const board = new BoardState({
        width: config.size,
        height: config.size,
        thief: config.thief
    });
    for (const b of config.buildings) {
        board.setBuilding({ x: b.x, y: b.y }, b.variant ?? "default");
    }
    const inventory = new Map();
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
