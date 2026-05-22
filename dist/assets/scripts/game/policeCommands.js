export class PlacePoliceCommand {
    constructor(args) {
        this.board = args.board;
        this.pos = args.pos;
        this.variant = args.variant;
        this.inventory = args.inventory;
    }
    apply() {
        this.board.setPolice(this.pos, this.variant);
        this.inventory.set(this.variant, (this.inventory.get(this.variant) ?? 0) - 1);
    }
    revert() {
        this.board.removePolice(this.pos);
        this.inventory.set(this.variant, (this.inventory.get(this.variant) ?? 0) + 1);
    }
}
export class RemovePoliceCommand {
    constructor(args) {
        this.board = args.board;
        this.pos = args.pos;
        this.variant = args.variant;
        this.inventory = args.inventory;
    }
    apply() {
        this.board.removePolice(this.pos);
        this.inventory.set(this.variant, (this.inventory.get(this.variant) ?? 0) + 1);
    }
    revert() {
        this.board.setPolice(this.pos, this.variant);
        this.inventory.set(this.variant, (this.inventory.get(this.variant) ?? 0) - 1);
    }
}
