import type { PoliceVariant, Vec2 } from "../core/types.js";
import type { LoadedLevel } from "../core/level.js";
import { hasEscapePath } from "../core/escape.js";
import { CommandHistory } from "./history.js";
import { PlacePoliceCommand, RemovePoliceCommand } from "./policeCommands.js";

export type PlacePoliceResult =
  | Readonly<{ ok: true; win: boolean }>
  | Readonly<{ ok: false; reason: string }>;

export type RemovePoliceResult =
  | Readonly<{ ok: true; win: boolean }>
  | Readonly<{ ok: false; reason: string }>;

export class GameSession {
  public readonly levelId: string;
  public readonly history: CommandHistory;
  private readonly level: LoadedLevel;
  private readonly inventory: Map<PoliceVariant, number>;
  private readonly initialInventory: Map<PoliceVariant, number>;

  public constructor(level: LoadedLevel) {
    this.level = level;
    this.levelId = level.config.id;
    this.history = new CommandHistory();
    this.inventory = new Map(level.policeInventory);
    this.initialInventory = new Map(level.policeInventory);
  }

  public getBoard() {
    return this.level.board;
  }

  public getRemaining(variant: PoliceVariant): number {
    return this.inventory.get(variant) ?? 0;
  }

  public getUsedCount(): number {
    let used = 0;
    for (const [variant, initial] of this.initialInventory.entries()) {
      used += initial - (this.inventory.get(variant) ?? 0);
    }
    return used;
  }

  public tryPlacePolice(pos: Vec2, variant: PoliceVariant): PlacePoliceResult {
    const board = this.level.board;

    if (!board.isInside(pos)) return { ok: false, reason: "out_of_range" };
    if (pos.x === board.thief.x && pos.y === board.thief.y) return { ok: false, reason: "thief_cell" };
    if (board.hasBuilding(pos)) return { ok: false, reason: "building_cell" };
    if (board.hasPolice(pos)) return { ok: false, reason: "occupied" };

    const remain = this.getRemaining(variant);
    if (remain <= 0) return { ok: false, reason: "no_inventory" };

    const cmd = new PlacePoliceCommand({ board, pos, variant, inventory: this.inventory });
    cmd.apply();
    this.history.push(cmd);

    return { ok: true, win: this.checkWin() };
  }

  public tryRemovePolice(pos: Vec2): RemovePoliceResult {
    const board = this.level.board;
    if (!board.isInside(pos)) return { ok: false, reason: "out_of_range" };

    const variant = board.getPoliceVariant(pos);
    if (!variant) return { ok: false, reason: "no_police" };

    const cmd = new RemovePoliceCommand({ board, pos, variant, inventory: this.inventory });
    cmd.apply();
    this.history.push(cmd);

    return { ok: true, win: this.checkWin() };
  }

  public checkWin(): boolean {
    const boardSnap = this.level.board.snapshot();
    const noEscape = !hasEscapePath(boardSnap);

    if (!noEscape) return false;
    const maxUsed = this.level.constraints.maxPoliceUsed;
    if (maxUsed === undefined) return true;
    return this.getUsedCount() <= maxUsed;
  }
}

