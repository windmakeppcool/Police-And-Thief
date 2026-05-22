import { readFile } from "node:fs/promises";
import { loadLevel, type LevelConfig } from "../assets/scripts/core/level.js";
import { hasEscapePath } from "../assets/scripts/core/escape.js";
import { GameSession } from "../assets/scripts/game/session.js";
import { MemoryPlatformBridge } from "../assets/scripts/platform/memoryBridge.js";
import { SaveService } from "../assets/scripts/game/save.js";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function loadJson<T>(path: string): Promise<T> {
  const raw = await readFile(path, "utf8");
  return JSON.parse(raw) as T;
}

async function testLevel001(): Promise<void> {
  const cfg = await loadJson<LevelConfig>("assets/resources/levels/level_001.json");
  const loaded = loadLevel(cfg);

  assert(hasEscapePath(loaded.board.snapshot()) === true, "level_001 should be escapable at start");

  const session = new GameSession(loaded);
  const r1 = session.tryPlacePolice({ x: 3, y: 1 }, "p1");
  assert(r1.ok && r1.win === true, "level_001 should win after placing police at gap");

  assert(session.history.canUndo() === true, "undo should be available");
  session.history.undo();
  assert(hasEscapePath(session.getBoard().snapshot()) === true, "level_001 should be escapable after undo");

  session.history.redo();
  assert(hasEscapePath(session.getBoard().snapshot()) === false, "level_001 should be sealed after redo");
}

async function testLevel002(): Promise<void> {
  const cfg = await loadJson<LevelConfig>("assets/resources/levels/level_002.json");
  const loaded = loadLevel(cfg);

  assert(hasEscapePath(loaded.board.snapshot()) === true, "level_002 should be escapable at start");

  const session = new GameSession(loaded);
  const a = session.tryPlacePolice({ x: 3, y: 2 }, "p1");
  assert(a.ok && a.win === false, "level_002 should not win after 1st placement");
  const b = session.tryPlacePolice({ x: 4, y: 5 }, "p1");
  assert(b.ok && b.win === true, "level_002 should win after 2nd placement");
}

async function testSave(): Promise<void> {
  const bridge = new MemoryPlatformBridge("web");
  const save = new SaveService(bridge);
  const d1 = save.markCompleted("level_001");
  assert(d1.completedLevelIds.includes("level_001"), "save should contain level_001");
  assert(save.isCompleted("level_001") === true, "isCompleted should be true");
}

async function main(): Promise<void> {
  await testLevel001();
  await testLevel002();
  await testSave();
  console.log("selftest ok");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
