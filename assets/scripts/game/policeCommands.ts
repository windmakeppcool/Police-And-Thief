import type { PoliceVariant, Vec2 } from "../core/types.js";
import type { BoardState } from "../core/board.js";
import type { Command } from "./command.js";

export class PlacePoliceCommand implements Command {
  private readonly board: BoardState;
  private readonly pos: Vec2;
  private readonly variant: PoliceVariant;
  private readonly inventory: Map<PoliceVariant, number>;

  public constructor(args: {
    board: BoardState;
    pos: Vec2;
    variant: PoliceVariant;
    inventory: Map<PoliceVariant, number>;
  }) {
    this.board = args.board;
    this.pos = args.pos;
    this.variant = args.variant;
    this.inventory = args.inventory;
  }

  public apply(): void {
    this.board.setPolice(this.pos, this.variant);
    this.inventory.set(this.variant, (this.inventory.get(this.variant) ?? 0) - 1);
  }

  public revert(): void {
    this.board.removePolice(this.pos);
    this.inventory.set(this.variant, (this.inventory.get(this.variant) ?? 0) + 1);
  }
}

export class RemovePoliceCommand implements Command {
  private readonly board: BoardState;
  private readonly pos: Vec2;
  private readonly variant: PoliceVariant;
  private readonly inventory: Map<PoliceVariant, number>;

  public constructor(args: {
    board: BoardState;
    pos: Vec2;
    variant: PoliceVariant;
    inventory: Map<PoliceVariant, number>;
  }) {
    this.board = args.board;
    this.pos = args.pos;
    this.variant = args.variant;
    this.inventory = args.inventory;
  }

  public apply(): void {
    this.board.removePolice(this.pos);
    this.inventory.set(this.variant, (this.inventory.get(this.variant) ?? 0) + 1);
  }

  public revert(): void {
    this.board.setPolice(this.pos, this.variant);
    this.inventory.set(this.variant, (this.inventory.get(this.variant) ?? 0) - 1);
  }
}

