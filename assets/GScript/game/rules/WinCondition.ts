import { type EscapePathResult } from "../domain/GameTypes";

export function isWin(result: EscapePathResult): boolean {
  return result.canEscape === false;
}
