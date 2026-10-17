import "./style.css";
import { type Rotation } from "../../../assets/GScript/game/common/GameTypes";
import { PolicePieces, StructuresPieces, BoardPieces } from "../../../assets/GScript/game/piece/pieces";
import { coordKey } from "../../../assets/GScript/game/rules/BoardOccupancy";
import { nextRotation, pieceCells } from "../../../assets/GScript/game/rules/PieceGeometry";
import { toGridCoord, toJsonCoord, type JsonCoord } from "../../../assets/GScript/game/level/LevelParser";
import { analyze, placementIndex, solutionOverlay, type CellOwner, type Report } from "./analysis";
import * as api from "./api";
import {
    buildingLabel,
    canPlaceAt,
    emptyDoc,
    findPresetPolice,
    fromRawLevel,
    listOf,
    placementJsonCells,
    serializeLevel,
    withGridSize,
    withPlacementAdded,
    withPlacementMoved,
    withPlacementRemoved,
    withPlacementRotated,
    withThief,
    ID_PATTERN,
    type Doc,
    type PlacementKind,
    type PlacementRef,
} from "./doc";

/** 建筑在棋盘上的区分色，按放置顺序循环 */
const TINTS = ["#528d79", "#8a6bb0", "#b1803f", "#a8552f", "#5c7a3f", "#7a5570", "#2f6f6a", "#6b6340"];
const PRESET_COLOR = "#3f7fa8";

type Brush = { kind: "thief" } | { kind: "place"; place: PlacementKind; pieceId: string };

type State = {
    doc: Doc;
    /** null = 指针模式（点选棋盘上的预置物） */
    brush: Brush | null;
    brushRotation: Rotation;
    selected: PlacementRef | null;
    hover: JsonCoord | null;
    past: Doc[];
    future: Doc[];
    report: Report;
    solving: boolean;
    showSolution: boolean;
    message: string;
    messageError: boolean;
    levels: api.LevelList | null;
};

const el = <T extends HTMLElement>(id: string): T => {
    const node = document.getElementById(id);
    if (node === null) throw new Error(`缺少 DOM 节点 #${id}`);
    return node as T;
};

const boardEl = el<HTMLDivElement>("board");
const toolsEl = el<HTMLDivElement>("tools");
const paletteEl = el<HTMLDivElement>("palette");
const brushRotationEl = el<HTMLParagraphElement>("brush-rotation");
const reportEl = el<HTMLDivElement>("report");
const jsonEl = el<HTMLPreElement>("json");
const messageEl = el<HTMLDivElement>("message");
const idInput = el<HTMLInputElement>("level-id");
const gridSelect = el<HTMLSelectElement>("grid-size");
const pickerEl = el<HTMLSelectElement>("level-picker");
const saveBtn = el<HTMLButtonElement>("btn-save");
const saveHintEl = el<HTMLParagraphElement>("save-hint");
const deleteBtn = el<HTMLButtonElement>("btn-delete");
const clearBtn = el<HTMLButtonElement>("btn-clear");
const newBtn = el<HTMLButtonElement>("btn-new");
const solutionInput = el<HTMLInputElement>("show-solution");

const doc0 = emptyDoc("level_04", 6);
const state: State = {
    doc: doc0,
    brush: null,
    brushRotation: 0,
    selected: null,
    hover: null,
    past: [],
    future: [],
    report: analyze(doc0),
    solving: false,
    showSolution: false,
    message: "",
    messageError: false,
    levels: null,
};

// ── 状态变更 ────────────────────────────────────────────────

const sameDoc = (a: Doc, b: Doc): boolean => serializeLevel(a) === serializeLevel(b);

function setMessage(text: string, isError = false): void {
    state.message = text;
    state.messageError = isError;
    messageEl.textContent = text;
    messageEl.classList.toggle("message--error", isError);
}

function commit(next: Doc): void {
    if (sameDoc(next, state.doc)) return;
    state.past.push(state.doc);
    state.future.length = 0;
    state.doc = next;
    scheduleAnalyze();
}

function replaceDoc(next: Doc): void {
    state.doc = next;
    state.past.length = 0;
    state.future.length = 0;
    state.selected = null;
    state.hover = null;
    scheduleAnalyze();
}

function undo(): void {
    const previous = state.past.pop();
    if (previous === undefined) return;
    state.future.push(state.doc);
    state.doc = previous;
    state.selected = null;
    setMessage("已撤销");
    scheduleAnalyze();
}

function redo(): void {
    const next = state.future.pop();
    if (next === undefined) return;
    state.past.push(state.doc);
    state.doc = next;
    state.selected = null;
    setMessage("已重做");
    scheduleAnalyze();
}

let analyzeTimer = 0;

/** 校验 + 可解性求解偏重（几十到几百毫秒），先让界面画出「求解中」，再同步跑 */
function scheduleAnalyze(): void {
    state.solving = true;
    renderReport();
    window.clearTimeout(analyzeTimer);
    analyzeTimer = window.setTimeout(() => {
        state.report = analyze(state.doc);
        state.solving = false;
        render();
    }, 180);
}

// ── 标签 ────────────────────────────────────────────────────

/** PoliceUI-003 -> P3，建筑按下标 -> A、B、C */
function ownerTag(owner: CellOwner): string {
    if (owner.kind === "buildings") return buildingLabel(owner.index);
    const pieceId = state.doc.police[owner.index]?.pieceId ?? "";
    const num = /(\d+)$/.exec(pieceId)?.[1] ?? String(owner.index + 1);
    return `P${num}`;
}

// ── 棋盘渲染 ────────────────────────────────────────────────

function ghostCells(): { ok: boolean; keys: Set<string> } | null {
    const brush = state.brush;
    if (brush?.kind !== "place" || state.hover === null) return null;
    const options = {
        doc: state.doc,
        kind: brush.place,
        pieceId: brush.pieceId,
        anchor: state.hover,
        rotation: state.brushRotation,
    };
    return {
        ok: canPlaceAt(options),
        keys: new Set(
            placementJsonCells(
                { pieceId: brush.pieceId, anchor: state.hover, rotation: state.brushRotation },
                state.doc.gridSize,
            ).map(at => `${at.x},${at.y}`),
        ),
    };
}

function renderBoard(): void {
    const { doc } = state;
    boardEl.style.gridTemplateColumns = `repeat(${doc.gridSize}, var(--cell))`;

    const owners = placementIndex(doc);
    const ghost = ghostCells();

    const solCells = new Map<string, string>();
    const solCops = new Set<string>();
    const solution = state.report.solve?.solution ?? null;
    if (state.showSolution && solution !== null) {
        solutionOverlay(solution).forEach(piece => {
            const num = /(\d+)$/.exec(piece.pieceId)?.[1] ?? "?";
            for (const cell of piece.cells) {
                const at = toJsonCoord(cell, doc.gridSize);
                solCells.set(`${at.x},${at.y}`, `P${num}`);
            }
            const cop = toJsonCoord(piece.police, doc.gridSize);
            solCops.add(`${cop.x},${cop.y}`);
        });
    }

    const fragment = document.createDocumentFragment();
    for (let y = 0; y < doc.gridSize; y++) {
        for (let x = 0; x < doc.gridSize; x++) {
            fragment.appendChild(cellNode({ x, y }, owners, ghost, solCells, solCops));
        }
    }
    boardEl.replaceChildren(fragment);
}

function isSelected(owner: CellOwner): boolean {
    return state.selected?.kind === owner.kind && state.selected.index === owner.index;
}

function cellNode(
    at: JsonCoord,
    owners: Map<string, CellOwner>,
    ghost: { ok: boolean; keys: Set<string> } | null,
    solCells: Map<string, string>,
    solCops: Set<string>,
): HTMLElement {
    const node = document.createElement("div");
    node.className = "cell";
    node.dataset.x = String(at.x);
    node.dataset.y = String(at.y);
    const key = `${at.x},${at.y}`;
    const owner = owners.get(coordKey(toGridCoord(at, state.doc.gridSize)));

    let tag = "";
    if (state.doc.thief !== null && state.doc.thief.x === at.x && state.doc.thief.y === at.y) {
        node.classList.add("cell--thief");
        tag = "小偷";
    } else if (owner !== undefined) {
        const isPolice = owner.kind === "police";
        node.classList.add(isPolice ? "cell--preset" : "cell--building");
        if (!isPolice) node.style.setProperty("--tint", TINTS[owner.index % TINTS.length]);
        else node.style.setProperty("--tint", PRESET_COLOR);
        tag = ownerTag(owner);
        const placement = listOf(state.doc, owner.kind)[owner.index];
        if (placement?.anchor.x === at.x && placement?.anchor.y === at.y) node.classList.add("cell--anchor");
        if (isSelected(owner)) node.classList.add("cell--selected");
        node.title = placement?.pieceId ?? "";
    }

    if (ghost !== null && ghost.keys.has(key)) node.classList.add(ghost.ok ? "cell--ghost-ok" : "cell--ghost-bad");

    const solLabel = solCells.get(key);
    if (solLabel !== undefined) {
        node.classList.add("cell--sol");
        tag = solLabel;
    }
    if (solCops.has(key)) node.classList.add("cell--sol-cop");

    if (tag !== "") {
        const badge = document.createElement("span");
        badge.className = "tag";
        badge.textContent = tag;
        node.appendChild(badge);
    }
    const coord = document.createElement("span");
    coord.className = "coord";
    coord.textContent = `${at.x},${at.y}`;
    node.appendChild(coord);
    return node;
}

// ── 侧栏渲染 ────────────────────────────────────────────────

function pieceThumb(pieceId: string, rotation: Rotation): HTMLElement {
    const cells = pieceCells(BoardPieces[pieceId], rotation);
    const xs = cells.map(cell => cell.x);
    const ys = cells.map(cell => cell.y);
    const minX = Math.min(...xs);
    const minY = Math.min(...ys);
    const maxX = Math.max(...xs);
    const maxY = Math.max(...ys);
    const occupied = new Set(cells.map(cell => `${cell.x - minX},${maxY - cell.y}`));

    const thumb = document.createElement("div");
    thumb.className = "thumb";
    thumb.style.gridTemplateColumns = `repeat(${maxX - minX + 1}, 10px)`;
    for (let row = 0; row < maxY - minY + 1; row++) {
        for (let col = 0; col < maxX - minX + 1; col++) {
            const cell = document.createElement("i");
            if (occupied.has(`${col},${row}`)) cell.className = "on";
            // origin cell 旋转后恒为 (0, 0)（相对坐标），在缩略图里就是 (-minX, maxY)
            if (col === -minX && row === maxY) cell.classList.add("origin");
            thumb.appendChild(cell);
        }
    }
    return thumb;
}

function renderTools(): void {
    const tools: { label: string; brush: Brush | null }[] = [
        { label: "指针", brush: null },
        { label: "小偷", brush: { kind: "thief" } },
    ];
    toolsEl.replaceChildren(
        ...tools.map(tool => {
            const active =
                tool.brush === null
                    ? state.brush === null
                    : state.brush?.kind === "thief" && tool.brush.kind === "thief";
            const button = document.createElement("button");
            button.type = "button";
            button.className = `tool${active ? " active" : ""}`;
            button.textContent = tool.label;
            button.addEventListener("click", () => {
                state.brush = tool.brush;
                state.selected = null;
                setMessage(tool.brush === null ? "指针模式：点棋盘上的棋子可选中" : "点格子放置小偷");
                render();
            });
            return button;
        }),
    );
}

function paletteButton(kind: PlacementKind, pieceId: string): HTMLButtonElement {
    const active =
        state.brush?.kind === "place" && state.brush.place === kind && state.brush.pieceId === pieceId;
    const used = kind === "police" && findPresetPolice(state.doc, pieceId) >= 0;
    const rotation = active ? state.brushRotation : BoardPieces[pieceId].rotation;
    const button = document.createElement("button");
    button.type = "button";
    button.className = `palette-item${active ? " active" : ""}${used ? " used" : ""}`;
    button.disabled = used;
    button.appendChild(pieceThumb(pieceId, rotation));
    const name = document.createElement("span");
    name.className = "tool-name";
    name.textContent = used ? `${pieceId} · 已预置` : pieceId;
    button.appendChild(name);
    button.addEventListener("click", () => {
        const same = active;
        state.brush = same ? null : { kind: "place", place: kind, pieceId };
        state.selected = null;
        const label = kind === "police" ? "预置警察（开局锁定）" : "建筑";
        setMessage(same ? "指针模式：点棋盘上的棋子可选中" : `放置${label} ${pieceId}：点格子落下，R 换朝向`);
        render();
    });
    return button;
}

function groupLabel(text: string): HTMLElement {
    const node = document.createElement("span");
    node.className = "palette-group";
    node.textContent = text;
    return node;
}

function renderPalette(): void {
    const nodes: HTMLElement[] = [groupLabel("建筑障碍")];
    Object.values(StructuresPieces).forEach(piece => nodes.push(paletteButton("buildings", piece.id)));
    nodes.push(groupLabel("预置警察（开局锁定、不进托盘）"));
    Object.values(PolicePieces).forEach(piece => nodes.push(paletteButton("police", piece.id)));
    paletteEl.replaceChildren(...nodes);

    const brush = state.brush;
    if (brush?.kind === "place") {
        const label = brush.place === "police" ? "预置警察" : "建筑";
        brushRotationEl.textContent = `${label} ${brush.pieceId} 当前朝向 ${state.brushRotation}°，按 R 旋转`;
    } else {
        brushRotationEl.textContent =
            "选中建筑或预置警察再点棋盘；选中后 R 旋转、Delete / 右键删除、方向键平移";
    }
}

function reportLine(label: string, text: string, tone: "ok" | "bad" | "busy"): HTMLElement {
    const line = document.createElement("div");
    line.className = `report-line ${tone}`;
    const name = document.createElement("b");
    name.textContent = label;
    const value = document.createElement("span");
    value.textContent = text;
    line.append(name, value);
    return line;
}

function renderReport(): void {
    const { report, solving } = state;
    const lines: HTMLElement[] = [];

    lines.push(
        reportLine(
            "结构校验",
            report.errors.length === 0 ? "通过" : `${report.errors.length} 处错误`,
            report.errors.length === 0 ? "ok" : "bad",
        ),
    );
    lines.push(
        report.level === null
            ? reportLine("开局", "—", "busy")
            : reportLine(
                  "开局",
                  report.captured ? "小偷已被围死（游戏一进去就结束）" : "小偷未被围死",
                  report.captured ? "bad" : "ok",
              ),
    );

    const presetCount = state.doc.police.length;
    lines.push(
        reportLine(
            "预置警察",
            presetCount === 0 ? "无" : `${presetCount} 枚锁定在棋盘上，玩家另部署 ${6 - presetCount} 枚`,
            presetCount > 6 ? "bad" : "ok",
        ),
    );

    const solve = report.solve;
    if (solving) {
        lines.push(reportLine("可解性", "求解中…", "busy"));
    } else if (solve === null) {
        lines.push(reportLine("可解性", "—", "busy"));
    } else if (solve.status === "solved") {
        lines.push(reportLine("可解性", `可解：玩家再放 ${solve.solution?.length ?? 0} 枚（${solve.nodes} 节点）`, "ok"));
    } else if (solve.status === "unsat") {
        lines.push(reportLine("可解性", "无解：其余警察全部上场也围不住", "bad"));
    } else {
        lines.push(reportLine("可解性", `预算不足（访问 ${solve.nodes} 节点），无法判定`, "bad"));
    }

    lines.push(
        report.blockers.length === 0
            ? reportLine("保存", "可以保存", "ok")
            : reportLine("保存", `${report.blockers.length} 项待处理`, "bad"),
    );

    const extras: HTMLElement[] = [];
    for (const text of [...report.errors, ...report.blockers]) {
        const list = document.createElement("ul");
        list.className = "errors";
        const item = document.createElement("li");
        item.textContent = text;
        list.appendChild(item);
        extras.push(list);
    }

    reportEl.replaceChildren(...lines, ...extras);

    const canSave = report.blockers.length === 0 && !solving && ID_PATTERN.test(state.doc.id);
    saveBtn.disabled = !canSave;
    saveBtn.title = canSave ? `写入 assets/Game/levels/${state.doc.id}.json` : "先解决校验面板里的问题";
    deleteBtn.disabled = api.hasServer() === false;
}

function updateSaveHint(): void {
    saveHintEl.textContent =
        api.hasServer() === false
            ? "未检测到本地保存接口（不是 npm run level-editor 起的服务），请用复制/下载手工搬运"
            : state.levels === null
              ? ""
              : `写入 ${state.levels.levelsDir}`;
}

function renderJson(): void {
    jsonEl.textContent = serializeLevel(state.doc);
    updateSaveHint();
}

function render(): void {
    idInput.value = state.doc.id;
    gridSelect.value = String(state.doc.gridSize);
    renderBoard();
    renderTools();
    renderPalette();
    renderReport();
    renderJson();
    messageEl.textContent = state.message;
    messageEl.classList.toggle("message--error", state.messageError);
}

// ── 编辑操作 ────────────────────────────────────────────────

function onCellClick(at: JsonCoord): void {
    const { doc } = state;
    const owners = placementIndex(doc);
    const here = owners.get(coordKey(toGridCoord(at, doc.gridSize)));

    if (state.brush?.kind === "thief") {
        commit(withThief(doc, at));
        setMessage(`小偷放在 (${at.x}, ${at.y})`);
        render();
        return;
    }

    if (state.brush?.kind === "place") {
        const { place, pieceId } = state.brush;
        if (here !== undefined) {
            state.selected = { kind: here.kind, index: here.index };
            setMessage(`(${at.x}, ${at.y}) 已被占用，已改为选中它`);
            render();
            return;
        }
        const result = withPlacementAdded(doc, place, pieceId, at, state.brushRotation);
        if (!result.ok) {
            setMessage(result.reason, true);
            render();
            return;
        }
        const index = listOf(doc, place).length;
        commit(result.doc);
        state.selected = { kind: place, index };
        const label = place === "police" ? "预置警察" : "建筑";
        setMessage(`放置${label} ${pieceId} 于 (${at.x}, ${at.y})，朝向 ${state.brushRotation}°`);
        render();
        return;
    }

    if (here !== undefined) {
        state.selected = { kind: here.kind, index: here.index };
        const pieceId = listOf(doc, here.kind)[here.index]?.pieceId ?? "";
        setMessage(`选中 ${here.kind === "police" ? "预置警察" : "建筑"} ${ownerTag(here)}（${pieceId}）`);
        render();
        return;
    }
    if (state.selected) {
        const { kind, index } = state.selected;
        const result = withPlacementMoved(doc, kind, index, at);
        if (!result.ok) {
            setMessage(result.reason, true);
            render();
            return;
        }
        commit(result.doc);
        setMessage(`${ownerTag(state.selected)} 移到 (${at.x}, ${at.y})`);
        render();
        return;
    }
    setMessage("先在右侧选「小偷」、建筑或预置警察，再点棋盘", true);
    render();
}

function rotate(): void {
    if (state.selected) {
        const { kind, index } = state.selected;
        const placement = listOf(state.doc, kind)[index];
        if (!placement) return;
        const rotation = nextRotation(placement.rotation);
        const result = withPlacementRotated(state.doc, kind, index, rotation);
        if (!result.ok) {
            setMessage(result.reason, true);
            render();
            return;
        }
        commit(result.doc);
        setMessage(`${ownerTag(state.selected)} 转到 ${rotation}°`);
        render();
        return;
    }
    if (state.brush?.kind === "place") {
        state.brushRotation = nextRotation(state.brushRotation);
        setMessage(`${state.brush.pieceId} 朝向 ${state.brushRotation}°`);
        render();
        return;
    }
    setMessage("先选中一个棋子（或从右侧面板里选一项）再按 R", true);
    render();
}

function remove(): void {
    if (!state.selected) {
        setMessage("先选中一个棋子再删除", true);
        render();
        return;
    }
    const { kind, index } = state.selected;
    const tag = ownerTag(state.selected);
    state.selected = null;
    commit(withPlacementRemoved(state.doc, kind, index));
    setMessage(`已删除 ${tag}`);
    render();
}

function moveSelected(dx: number, dy: number): void {
    if (state.selected) {
        const { kind, index } = state.selected;
        const placement = listOf(state.doc, kind)[index];
        if (!placement) return;
        const result = withPlacementMoved(state.doc, kind, index, {
            x: placement.anchor.x + dx,
            y: placement.anchor.y + dy,
        });
        if (!result.ok) {
            setMessage(result.reason, true);
            render();
            return;
        }
        commit(result.doc);
        setMessage(`${ownerTag(state.selected)} 移到 (${placement.anchor.x + dx}, ${placement.anchor.y + dy})`);
        render();
        return;
    }
    if (state.doc.thief !== null) {
        const at = { x: state.doc.thief.x + dx, y: state.doc.thief.y + dy };
        if (at.x < 0 || at.y < 0 || at.x >= state.doc.gridSize || at.y >= state.doc.gridSize) return;
        commit(withThief(state.doc, at));
        setMessage(`小偷移到 (${at.x}, ${at.y})`);
        render();
    }
}

// ── 关卡文件读写 ────────────────────────────────────────────

function refreshPicker(preferred?: string): void {
    const previous = preferred ?? pickerEl.value;
    const options: HTMLOptionElement[] = [];
    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = state.levels === null ? "（本地保存接口不可用）" : "— 选择已有关卡 —";
    options.push(placeholder);
    for (const id of state.levels?.index ?? []) {
        const option = document.createElement("option");
        option.value = id;
        option.textContent = id;
        options.push(option);
    }
    pickerEl.replaceChildren(...options);
    pickerEl.value = options.some(option => option.value === previous) ? previous : "";
    updateSaveHint();
}

async function loadLevelList(preferred?: string): Promise<void> {
    state.levels = await api.fetchLevels();
    refreshPicker(preferred);
    deleteBtn.disabled = api.hasServer() === false;
}

async function openLevel(id: string): Promise<void> {
    const raw = await api.fetchLevel(id);
    if (raw === null) {
        setMessage(`读取 ${id} 失败`, true);
        return;
    }
    const doc = fromRawLevel(raw, id);
    if (doc === null) {
        setMessage(`${id} 不是可识别的关卡文件`, true);
        return;
    }
    doc.id = id;
    replaceDoc(doc);
    setMessage(`已打开 ${id}`);
}

function nextLevelId(): string {
    const used = new Set([...(state.levels?.index ?? []), ...(state.levels?.files ?? [])]);
    for (let i = 1; i < 1000; i++) {
        const id = `level_${String(i).padStart(2, "0")}`;
        if (!used.has(id)) return id;
    }
    return `level_${Date.now()}`;
}

async function save(): Promise<void> {
    const { report, doc } = state;
    if (report.blockers.length > 0) {
        setMessage(`还有 ${report.blockers.length} 项问题：${report.blockers[0]}`, true);
        render();
        return;
    }
    const result = await api.saveLevel(doc.id, JSON.parse(serializeLevel(doc)) as unknown);
    if (!result.ok) {
        setMessage(result.error, true);
        renderJson();
        return;
    }
    setMessage(
        `已写入 ${result.path}${result.created ? "（新建）" : ""}${result.metaCreated ? "，并补了 .meta，Cocos 里刷新一下资源" : ""}`,
    );
    await loadLevelList(doc.id);
    render();
}

// ── 事件绑定 ────────────────────────────────────────────────

boardEl.addEventListener("pointermove", event => {
    const cell = (event.target as HTMLElement).closest<HTMLElement>(".cell");
    const at = cell === null ? null : { x: Number(cell.dataset.x), y: Number(cell.dataset.y) };
    const same =
        (at === null && state.hover === null) ||
        (at !== null && state.hover !== null && at.x === state.hover.x && at.y === state.hover.y);
    if (same) return;
    state.hover = at;
    renderBoard();
});

boardEl.addEventListener("pointerleave", () => {
    if (state.hover === null) return;
    state.hover = null;
    renderBoard();
});

boardEl.addEventListener("click", event => {
    const cell = (event.target as HTMLElement).closest<HTMLElement>(".cell");
    if (cell === null) return;
    onCellClick({ x: Number(cell.dataset.x), y: Number(cell.dataset.y) });
});

function removeAt(at: JsonCoord): void {
    const owners = placementIndex(state.doc);
    const here = owners.get(coordKey(toGridCoord(at, state.doc.gridSize)));
    if (here === undefined) {
        setMessage("这一格没有棋子", true);
        return;
    }
    const tag = ownerTag(here);
    if (state.selected?.kind === here.kind && state.selected.index === here.index) state.selected = null;
    commit(withPlacementRemoved(state.doc, here.kind, here.index));
    setMessage(`已删除 ${tag}`);
    render();
}

boardEl.addEventListener("contextmenu", event => {
    event.preventDefault();
    const cell = (event.target as HTMLElement).closest<HTMLElement>(".cell");
    if (cell === null) return;
    removeAt({ x: Number(cell.dataset.x), y: Number(cell.dataset.y) });
});

idInput.addEventListener("input", () => {
    state.doc = { ...state.doc, id: idInput.value.trim() };
    renderReport();
    renderJson();
});

gridSelect.addEventListener("change", () => {
    const size = Number(gridSelect.value);
    if (size === state.doc.gridSize) return;
    if (state.doc.buildings.length > 0 || state.doc.police.length > 0 || state.doc.thief !== null) {
        const confirmed = window.confirm(`换成 ${size} × ${size} 会清空当前摆放，继续吗？`);
        if (!confirmed) {
            gridSelect.value = String(state.doc.gridSize);
            return;
        }
    }
    replaceDoc(withGridSize(state.doc, size));
    setMessage(`棋盘换成 ${size} × ${size}`);
});

pickerEl.addEventListener("change", () => {
    if (pickerEl.value !== "") void openLevel(pickerEl.value);
});

newBtn.addEventListener("click", () => {
    const id = nextLevelId();
    replaceDoc(emptyDoc(id, state.doc.gridSize));
    pickerEl.value = "";
    setMessage(`新建 ${id}：先放小偷，再摆建筑 / 预置警察`);
});

clearBtn.addEventListener("click", () => {
    const { doc } = state;
    if (doc.thief === null && doc.buildings.length === 0 && doc.police.length === 0) {
        setMessage("棋盘已经是空的", true);
        return;
    }
    if (!window.confirm("清空棋盘上的小偷、建筑和预置警察？（id 与棋盘尺寸保留，可用 Ctrl+Z 撤销）")) return;
    state.selected = null;
    state.brush = null;
    commit({ ...doc, thief: null, buildings: [], police: [] });
    setMessage("已清空棋盘");
    render();
});

deleteBtn.addEventListener("click", () => {
    const id = state.doc.id;
    if (!window.confirm(`从磁盘删除 assets/Game/levels/${id}.json（含 .meta 与 levels.json 索引项）？`)) return;
    void api.deleteLevel(id).then(error => {
        if (error !== null) {
            setMessage(error, true);
            return;
        }
        setMessage(`已删除 ${id}`);
        void loadLevelList();
    });
});

saveBtn.addEventListener("click", () => void save());

el<HTMLButtonElement>("btn-copy").addEventListener("click", () => {
    const text = serializeLevel(state.doc);
    void navigator.clipboard.writeText(text).then(
        () => setMessage(`已复制 ${text.length} 字符的 JSON`),
        () => setMessage("复制失败，请手动从下方 JSON 里选中", true),
    );
});

el<HTMLButtonElement>("btn-download").addEventListener("click", () => {
    const blob = new Blob([serializeLevel(state.doc)], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${state.doc.id}.json`;
    link.click();
    URL.revokeObjectURL(link.href);
});

solutionInput.addEventListener("change", () => {
    state.showSolution = solutionInput.checked;
    renderBoard();
});

window.addEventListener("keydown", event => {
    const target = event.target as HTMLElement | null;
    if (target !== null && /^(INPUT|SELECT|TEXTAREA)$/.test(target.tagName)) return;
    const mod = event.metaKey || event.ctrlKey;
    if (mod && event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
        return;
    }
    if (mod && event.key.toLowerCase() === "y") {
        event.preventDefault();
        redo();
        return;
    }
    if (mod) return;
    switch (event.key) {
        case "r":
        case "R":
            event.preventDefault();
            rotate();
            break;
        case "Delete":
        case "Backspace":
            event.preventDefault();
            remove();
            break;
        case "Escape":
            state.brush = null;
            state.selected = null;
            setMessage("指针模式");
            render();
            break;
        case "ArrowLeft":
            event.preventDefault();
            moveSelected(-1, 0);
            break;
        case "ArrowRight":
            event.preventDefault();
            moveSelected(1, 0);
            break;
        case "ArrowUp":
            event.preventDefault();
            moveSelected(0, -1);
            break;
        case "ArrowDown":
            event.preventDefault();
            moveSelected(0, 1);
            break;
        default:
            break;
    }
});

// ── 启动 ────────────────────────────────────────────────────

render();
void loadLevelList().then(() => {
    // 开局还没动过的空关卡：自动取一个没被占用的 id，避免手一抖覆盖已有关卡
    if (state.past.length === 0 && state.doc.buildings.length === 0 && state.doc.police.length === 0 && state.doc.thief === null) {
        state.doc = { ...state.doc, id: nextLevelId() };
    }
    setMessage("先在右侧选「小偷」、建筑或预置警察，再点棋盘");
    render();
});
