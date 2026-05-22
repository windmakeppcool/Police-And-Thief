import { hasEscapePath } from "../core/escape.js";
import { CommandHistory } from "./history.js";
import { PlacePoliceCommand, RemovePoliceCommand } from "./policeCommands.js";
export class GameSession {
    constructor(level) {
        this.level = level;
        this.levelId = level.config.id;
        this.history = new CommandHistory();
        this.inventory = new Map(level.policeInventory);
        this.initialInventory = new Map(level.policeInventory);
    }
    getBoard() {
        return this.level.board;
    }
    getRemaining(variant) {
        return this.inventory.get(variant) ?? 0;
    }
    getUsedCount() {
        let used = 0;
        for (const [variant, initial] of this.initialInventory.entries()) {
            used += initial - (this.inventory.get(variant) ?? 0);
        }
        return used;
    }
    tryPlacePolice(pos, variant) {
        const board = this.level.board;
        if (!board.isInside(pos))
            return { ok: false, reason: "out_of_range" };
        if (pos.x === board.thief.x && pos.y === board.thief.y)
            return { ok: false, reason: "thief_cell" };
        if (board.hasBuilding(pos))
            return { ok: false, reason: "building_cell" };
        if (board.hasPolice(pos))
            return { ok: false, reason: "occupied" };
        const remain = this.getRemaining(variant);
        if (remain <= 0)
            return { ok: false, reason: "no_inventory" };
        const cmd = new PlacePoliceCommand({ board, pos, variant, inventory: this.inventory });
        cmd.apply();
        this.history.push(cmd);
        return { ok: true, win: this.checkWin() };
    }
    tryRemovePolice(pos) {
        const board = this.level.board;
        if (!board.isInside(pos))
            return { ok: false, reason: "out_of_range" };
        const variant = board.getPoliceVariant(pos);
        if (!variant)
            return { ok: false, reason: "no_police" };
        const cmd = new RemovePoliceCommand({ board, pos, variant, inventory: this.inventory });
        cmd.apply();
        this.history.push(cmd);
        return { ok: true, win: this.checkWin() };
    }
    checkWin() {
        const boardSnap = this.level.board.snapshot();
        const noEscape = !hasEscapePath(boardSnap);
        if (!noEscape)
            return false;
        const maxUsed = this.level.constraints.maxPoliceUsed;
        if (maxUsed === undefined)
            return true;
        return this.getUsedCount() <= maxUsed;
    }
}
