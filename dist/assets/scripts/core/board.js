import { keyOf, neighbors4 as neighbors4Raw } from "./grid.js";
export class BoardState {
    constructor(init) {
        this.width = init.width;
        this.height = init.height;
        this.thief = init.thief;
        this.buildings = new Map();
        this.police = new Map();
    }
    snapshot() {
        return {
            width: this.width,
            height: this.height,
            thief: this.thief,
            buildings: this.buildings,
            police: this.police
        };
    }
    isInside(pos) {
        return pos.x >= 0 && pos.y >= 0 && pos.x < this.width && pos.y < this.height;
    }
    hasBuilding(pos) {
        return this.buildings.has(keyOf(pos));
    }
    hasPolice(pos) {
        return this.police.has(keyOf(pos));
    }
    isBlocked(pos) {
        const k = keyOf(pos);
        return this.buildings.has(k) || this.police.has(k);
    }
    isPassable(pos) {
        return this.isInside(pos) && !this.isBlocked(pos);
    }
    setBuilding(pos, variant = "default") {
        this.buildings.set(keyOf(pos), variant);
    }
    setPolice(pos, variant = "default") {
        this.police.set(keyOf(pos), variant);
    }
    removePolice(pos) {
        return this.police.delete(keyOf(pos));
    }
    getPoliceVariant(pos) {
        return this.police.get(keyOf(pos));
    }
    neighbors4(pos) {
        return neighbors4Raw(pos).filter((n) => this.isInside(n));
    }
}
