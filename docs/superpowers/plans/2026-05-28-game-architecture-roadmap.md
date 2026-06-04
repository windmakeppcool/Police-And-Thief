# 《警察抓小偷》游戏架构路线图与实施计划

> **给后续智能体/开发者的说明：** 实施本计划时，请按任务顺序逐项执行。每个任务都使用 `- [ ]` 复选框表示执行进度。建议使用“每完成一个小任务就测试、再提交”的方式推进，避免一次性改动过大。

**目标：** 为 Cocos Creator 益智游戏《警察抓小偷》建立一套可测试、可维护、可发布到多平台的游戏架构。核心玩法规则用于判断玩家摆放的警察方块是否成功阻断小偷通往棋盘外的路径。

**架构原则：** 棋盘规则、关卡数据、方块摆放校验、胜负判断全部放在不依赖 Cocos 的纯 TypeScript 模块中。Cocos 组件只负责显示、输入和控制器胶水逻辑。微信、抖音、鸿蒙、Web 等平台差异统一收敛到 `PlatformAdapter` 接口。

**技术栈：** Cocos Creator 3.8.8、TypeScript、Cocos Asset Bundle（`GScriptBN`、`LoginBN`、`GameBN`）、Vitest、平台适配器。

---

## 1. 当前工程进度

当前工程已经具备 Cocos 启动流程和基础框架：

- `assets/Boost/Main.scene`：游戏启动场景。
- `assets/Boost/boost.ts`：加载全局脚本包 `GScriptBN`，动态添加 `GCtrl`，并调用 `GCtrl.init(...)`。
- `assets/GScript/GCtrl.ts`：创建全局 `gCtrl`，初始化 `UIManager` 和 `ResManager`，注册 `PrefabsCfg`，初始化 `LoginCtrl`，登录成功后加载 `GameBN` 并打开 `BoardBackgroundTiled`。
- `assets/GScript/core/ui/UIManager.ts`：创建 UI 分层节点，并按组件类打开 prefab。
- `assets/GScript/core/res/ResManager.ts`、`ResLoader.ts`、`ResConst.ts`：提供 bundle URL、bundle 加载、资源加载和自动释放能力。
- `assets/GScript/game/view/BoardBackgroundTiled.ts`：在 `EViewLayer.Scene` 层显示棋盘背景。
- `assets/GScript/auto/PrefabCfg.ts`：维护 UI 组件类名到 prefab 路径的映射。
- `assets/GScript/auto/JsonCfg.ts`：维护关卡 JSON 的 bundle 路径。

当前尚未完成的核心游戏能力：

- 棋盘和方块的纯数据模型。
- 建筑、警察、小偷的占格规则。
- 警察方块摆放合法性校验。
- 小偷逃脱路径搜索。
- 胜负判断。
- 当前局状态、走步记录和撤销。
- Web、微信、抖音、鸿蒙平台抽象。
- 游戏规则自动化测试。
- Cocos 棋盘控制器，用于把玩家输入连接到纯逻辑层。

---

## 2. 总体文件规划

### 2.1 测试与项目配置

- 修改 `package.json`：增加 Vitest、TypeScript 检查脚本和测试依赖。
- 创建 `tsconfig.spec.json`：给纯逻辑测试使用，避免依赖 Cocos 生成的 `temp/tsconfig.cocos.json`。
- 创建 `tests/game/*.test.ts`：测试领域模型、规则和服务层。

### 2.2 纯游戏领域模型

- 创建 `assets/GScript/game/domain/GameTypes.ts`：定义坐标、棋盘、方块、关卡、移动结果等通用类型。
- 创建 `assets/GScript/game/domain/PieceGeometry.ts`：处理多格方块旋转，以及从局部坐标展开到棋盘坐标。
- 创建 `assets/GScript/game/domain/BoardOccupancy.ts`：把建筑、警察等已放置方块转换成占格表。

### 2.3 纯游戏规则

- 创建 `assets/GScript/game/rules/PlacementValidator.ts`：校验警察是否能摆放，包括越界、碰撞、库存数量等。
- 创建 `assets/GScript/game/rules/EscapePathFinder.ts`：使用 BFS 搜索小偷是否能走出棋盘。
- 创建 `assets/GScript/game/rules/WinCondition.ts`：把路径搜索结果转换成胜利/继续游戏状态。

### 2.4 纯游戏服务

- 创建 `assets/GScript/game/service/GameSession.ts`：管理当前关卡状态、已放置警察、走步、撤销和胜负判断。
- 创建 `assets/GScript/game/level/LevelExamples.ts`：提供开发和测试阶段使用的内置示例关卡。

### 2.5 平台抽象层

- 创建 `assets/GScript/core/platform/PlatformAdapter.ts`：定义统一平台能力接口。
- 创建 `assets/GScript/core/platform/WebPlatformAdapter.ts`：默认 Web 实现，包含本地存储兜底。
- 创建 `assets/GScript/core/platform/PlatformFactory.ts`：检测运行环境并返回对应平台适配器。
- 修改 `assets/GScript/GCtrl.ts`：在登录和业务逻辑前初始化 `platform`。

### 2.6 Cocos 接入层

- 创建 `assets/GScript/game/controller/GameController.ts`：Cocos 组件，持有一个 `GameSession`，连接表现层和逻辑层。
- 创建 `assets/GScript/game/view/BoardGridView.ts`：Cocos 组件，把棋盘坐标转换为节点坐标，用于绘制棋盘和方块。
- 后续在 Cocos Editor 中创建真实 prefab 后，修改 `assets/GScript/auto/PrefabCfg.ts` 注册新的 UI prefab。

---

## 3. 实施任务

### 任务 1：增加纯 TypeScript 测试环境

**涉及文件：**

- 修改：`package.json`
- 创建：`tsconfig.spec.json`
- 测试：命令行 smoke test

#### 步骤 1：更新 `package.json`

将 `package.json` 更新为包含测试脚本和开发依赖的版本：

```json
{
  "name": "PoliceAndThiefV2",
  "uuid": "e26d280c-0d5f-4937-9d9b-041bb20751f4",
  "creator": {
    "version": "3.8.8"
  },
  "private": true,
  "type": "module",
  "scripts": {
    "test": "vitest run --config tsconfig.spec.json",
    "test:watch": "vitest --config tsconfig.spec.json",
    "test:game": "vitest run --config tsconfig.spec.json tests/game",
    "typecheck:game": "tsc --noEmit -p tsconfig.spec.json",
    "typecheck:cocos": "tsc --noEmit"
  },
  "devDependencies": {
    "@types/node": "^20.14.0",
    "typescript": "^5.4.0",
    "vitest": "^1.6.0"
  }
}
```

#### 步骤 2：创建 `tsconfig.spec.json`

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "types": ["vitest/globals", "node"],
    "baseUrl": "."
  },
  "include": [
    "assets/GScript/game/domain/**/*.ts",
    "assets/GScript/game/rules/**/*.ts",
    "assets/GScript/game/service/**/*.ts",
    "assets/GScript/game/level/**/*.ts",
    "assets/GScript/core/platform/**/*.ts",
    "tests/**/*.ts"
  ]
}
```

#### 步骤 3：安装依赖

```bash
npm install
```

预期结果：生成 `node_modules` 和 `package-lock.json`，且安装无错误。

#### 步骤 4：运行测试命令

```bash
npm run test:game
```

预期结果：当前还没有测试文件时，Vitest 可能提示没有找到测试。任务 2 之后，该命令应能执行具体测试。

#### 步骤 5：提交

```bash
git add package.json package-lock.json tsconfig.spec.json
git commit -m "test: add pure game logic test harness"
```

---

### 任务 2：定义纯游戏领域类型

**涉及文件：**

- 创建：`assets/GScript/game/domain/GameTypes.ts`
- 创建测试：`tests/game/GameTypes.test.ts`

#### 目标说明

该任务定义所有后续规则层和服务层共享的基础数据结构。该文件不得引入 `cc`，否则纯逻辑测试和跨平台复用都会受到影响。

#### 核心类型

需要定义：

- `Coord`：棋盘坐标。
- `BoardSize`：棋盘尺寸。
- `Rotation`：方块旋转角度。
- `PieceType`：小偷、警察、建筑。
- `PieceShape`：方块形状。
- `PlacedPiece`：已放置方块。
- `LevelData`：关卡数据。
- `ShapeCatalog`：形状配置表。
- `PlacePoliceInput`：玩家摆放警察的输入。
- `MoveResult`：移动或摆放操作结果。
- `EscapePathResult`：小偷逃脱路径搜索结果。

#### 测试重点

- 坐标能稳定序列化成 key，例如 `{ x: 3, y: 5 }` 变成 `"3,5"`。
- 坐标按值比较，而不是按引用比较。
- 棋盘尺寸支持正方形，也保留矩形扩展能力。

#### 运行命令

```bash
npm run test:game -- tests/game/GameTypes.test.ts
```

预期结果：实现前失败，实现后通过。

#### 提交

```bash
git add assets/GScript/game/domain/GameTypes.ts tests/game/GameTypes.test.ts
git commit -m "feat: define pure game domain types"
```

---

### 任务 3：实现方块几何和棋盘占格

**涉及文件：**

- 创建：`assets/GScript/game/domain/PieceGeometry.ts`
- 创建：`assets/GScript/game/domain/BoardOccupancy.ts`
- 创建测试：`tests/game/BoardOccupancy.test.ts`

#### 目标说明

该任务解决“多格方块实际占用了棋盘上的哪些格子”的问题。建筑和警察都可能是多格方块，因此必须支持：

- 根据原始形状计算旋转后的格子。
- 根据摆放原点计算棋盘绝对坐标。
- 根据所有已放置方块生成占格表。

#### 方块旋转规则

以方块自身原点为旋转中心：

- `0` 度：`{ x, y }`
- `90` 度：`{ x: -y, y: x }`
- `180` 度：`{ x: -x, y: -y }`
- `270` 度：`{ x: y, y: -x }`

#### 占格规则

- 建筑格子阻挡小偷路径。
- 警察格子阻挡小偷路径。
- 占格表应记录每个格子对应的 `pieceId`、`shapeId` 和 `type`。

#### 运行命令

```bash
npm run test:game -- tests/game/BoardOccupancy.test.ts
```

预期结果：实现前失败，实现后通过。

#### 提交

```bash
git add assets/GScript/game/domain/PieceGeometry.ts assets/GScript/game/domain/BoardOccupancy.ts tests/game/BoardOccupancy.test.ts
git commit -m "feat: add board occupancy geometry"
```

---

### 任务 4：实现警察摆放合法性校验

**涉及文件：**

- 创建：`assets/GScript/game/rules/PlacementValidator.ts`
- 创建测试：`tests/game/PlacementValidator.test.ts`

#### 目标说明

玩家拖拽或点击摆放警察时，所有合法性判断都应走这个规则模块，而不是由 Cocos 节点自行判断。

#### 校验规则

`validatePolicePlacement(...)` 需要返回 `{ ok: boolean, reason: string }`。

需要处理以下情况：

- `unknown_shape`：形状 ID 不存在。
- `not_police_shape`：尝试摆放的不是警察形状。
- `not_in_inventory`：该警察方块不在本关可用库存中。
- `inventory_exhausted`：该形状的警察已经用完。
- `out_of_bounds`：任意格子超出棋盘。
- `cell_occupied`：与建筑、已有警察或小偷所在格冲突。
- `ok`：可以摆放。

#### 运行命令

```bash
npm run test:game -- tests/game/PlacementValidator.test.ts
```

预期结果：实现前失败，实现后通过。

#### 提交

```bash
git add assets/GScript/game/rules/PlacementValidator.ts tests/game/PlacementValidator.test.ts
git commit -m "feat: validate police placement"
```

---

### 任务 5：实现小偷逃脱路径和胜负判断

**涉及文件：**

- 创建：`assets/GScript/game/rules/EscapePathFinder.ts`
- 创建：`assets/GScript/game/rules/WinCondition.ts`
- 创建测试：`tests/game/EscapePathFinder.test.ts`

#### 目标说明

小偷是否能逃脱是本游戏的核心判定。建议使用 BFS，从小偷所在格开始向上下左右扩展。

#### 搜索规则

- 小偷从自身所在格开始搜索。
- 可以向上下左右四个方向移动。
- 建筑和警察占用的格子不能进入。
- 如果搜索过程中走出棋盘边界，说明小偷可以逃脱。
- 如果所有可达格子搜索完仍不能走出棋盘，说明小偷被成功围住。

#### 胜负判断

- `canEscape === true`：小偷仍可逃脱，玩家还未胜利。
- `canEscape === false`：小偷无法逃脱，玩家胜利。

#### 运行命令

```bash
npm run test:game -- tests/game/EscapePathFinder.test.ts
```

预期结果：实现前失败，实现后通过。

#### 提交

```bash
git add assets/GScript/game/rules/EscapePathFinder.ts assets/GScript/game/rules/WinCondition.ts tests/game/EscapePathFinder.test.ts
git commit -m "feat: detect thief escape paths"
```

---

### 任务 6：实现游戏局状态和撤销

**涉及文件：**

- 创建：`assets/GScript/game/service/GameSession.ts`
- 创建：`assets/GScript/game/level/LevelExamples.ts`
- 创建测试：`tests/game/GameSession.test.ts`

#### 目标说明

`GameSession` 是一局游戏的纯逻辑状态管理器。Cocos 表现层应该通过它来执行摆放、撤销和胜负检查。

#### `GameSession` 需要提供的能力

- 读取当前关卡。
- 获取已放置警察列表。
- 摆放警察。
- 撤销上一步摆放。
- 检查当前是否胜利。

#### 示例关卡

`LevelExamples.ts` 用于在正式关卡管线完成前提供一个可测试的开发关卡：

- 3x3 棋盘。
- 小偷位于中心 `{ x: 1, y: 1 }`。
- 提供 4 个 `police_1x1`，用于围住小偷上下左右四格。

#### 运行命令

```bash
npm run test:game -- tests/game/GameSession.test.ts
npm run test:game
```

预期结果：单测和全部纯游戏测试均通过。

#### 提交

```bash
git add assets/GScript/game/service/GameSession.ts assets/GScript/game/level/LevelExamples.ts tests/game/GameSession.test.ts
git commit -m "feat: add game session flow"
```

---

### 任务 7：增加平台适配器抽象

**涉及文件：**

- 创建：`assets/GScript/core/platform/PlatformAdapter.ts`
- 创建：`assets/GScript/core/platform/WebPlatformAdapter.ts`
- 创建：`assets/GScript/core/platform/PlatformFactory.ts`
- 创建测试：`tests/game/PlatformFactory.test.ts`

#### 目标说明

业务代码不应直接调用 `wx.*`、`tt.*`、鸿蒙 API 或浏览器 API。所有平台能力统一通过 `PlatformAdapter` 暴露。

#### 平台接口需要覆盖的能力

- `init()`：平台初始化。
- `getLaunchOptions()`：获取启动参数。
- `login()`：登录。
- `getStorage()` / `setStorage()`：存取本地数据。
- `showRewardedAd()`：激励广告。
- `showInterstitialAd()`：插屏广告。
- `share()`：分享。
- `reportEvent()`：埋点。

#### 初始实现策略

第一阶段只实现 `WebPlatformAdapter`，并在 `PlatformFactory` 检测到微信、抖音、鸿蒙环境时也先返回 Web 适配器作为占位。这样可以先保证架构入口稳定，后续再分别补充具体平台 SDK 实现。

#### 运行命令

```bash
npm run test:game -- tests/game/PlatformFactory.test.ts
```

预期结果：实现前失败，实现后通过。

#### 提交

```bash
git add assets/GScript/core/platform/PlatformAdapter.ts assets/GScript/core/platform/WebPlatformAdapter.ts assets/GScript/core/platform/PlatformFactory.ts tests/game/PlatformFactory.test.ts
git commit -m "feat: add platform adapter abstraction"
```

---

### 任务 8：在 `GCtrl` 中初始化平台适配器

**涉及文件：**

- 修改：`assets/GScript/GCtrl.ts`

#### 目标说明

`gCtrl.platform` 应在登录、存档、广告、分享和埋点之前完成初始化。

#### 修改点

在 `GCtrl.ts` 中增加导入：

```ts
import { type PlatformAdapter } from './core/platform/PlatformAdapter';
import { createPlatformAdapter } from './core/platform/PlatformFactory';
```

在 `GCtrl` 类中增加属性：

```ts
readonly platform: PlatformAdapter = createPlatformAdapter();
```

在 `init(...)` 中设置 `globalThis.gCtrl` 后立即初始化：

```ts
await this.platform.init();
this.platform.reportEvent?.("game_boot", { version: "dev" });
```

#### 运行命令

```bash
npm run typecheck:game
```

如果 Cocos 已生成 `temp/tsconfig.cocos.json`，再运行：

```bash
npm run typecheck:cocos
```

如果缺少 `temp/tsconfig.cocos.json`，先用 Cocos Creator 3.8.8 打开一次项目。

#### 提交

```bash
git add assets/GScript/GCtrl.ts
git commit -m "feat: initialize platform adapter during boot"
```

---

### 任务 9：增加 Cocos 游戏控制器骨架

**涉及文件：**

- 创建：`assets/GScript/game/controller/GameController.ts`
- 创建：`assets/GScript/game/view/BoardGridView.ts`

#### 目标说明

该任务建立 Cocos 层和纯逻辑层之间的连接点，但不一次性实现完整 UI、拖拽和动画。

#### `GameController` 职责

- 在 `onLoad()` 中创建 `GameSession`。
- 通过方法调用 `session.placePolice(...)`。
- 调用 `session.checkWin()` 获取胜负结果。
- 使用 `gCtrl.platform.reportEvent(...)` 进行基础埋点。

#### `BoardGridView` 职责

- 保存棋盘格子尺寸。
- 将棋盘坐标转换为 Cocos 本地坐标。
- 根据棋盘尺寸调整节点大小。

#### 运行命令

```bash
npm run typecheck:game
```

如果 Cocos 已生成 `temp/tsconfig.cocos.json`，再运行：

```bash
npm run typecheck:cocos
```

#### 提交

```bash
git add assets/GScript/game/controller/GameController.ts assets/GScript/game/view/BoardGridView.ts
git commit -m "feat: add game controller skeleton"
```

---

### 任务 10：更新后续智能体文档

**涉及文件：**

- 修改：`CLAUDE.md`
- 保留：`docs/superpowers/plans/2026-05-28-game-architecture-roadmap.md`

#### 目标说明

让后续 Claude Code 或工程师在进入仓库后，能从 `CLAUDE.md` 快速理解当前规划。

#### 建议追加到 `CLAUDE.md` 的内容

```markdown
## Planned game architecture

The game should keep puzzle rules in pure TypeScript under `assets/GScript/game/domain`, `assets/GScript/game/rules`, and `assets/GScript/game/service`. Those files should not import `cc`, so they can be tested with Vitest and reused across Web, WeChat, Douyin, Harmony, and native builds.

Cocos components under `assets/GScript/game/view` and `assets/GScript/game/controller` should only translate input, display state, and call `GameSession`. Platform APIs should be accessed only through `assets/GScript/core/platform/PlatformAdapter.ts` and concrete adapters.

The planned implementation sequence is documented in `docs/superpowers/plans/2026-05-28-game-architecture-roadmap.md`.
```

也可以将上述英文内容改写为中文，但建议保留路径和模块名称不变。

#### 查看文档改动

```bash
git diff -- CLAUDE.md docs/superpowers/plans/2026-05-28-game-architecture-roadmap.md
```

预期结果：diff 只包含架构规划说明和本实施计划。

#### 提交

```bash
git add CLAUDE.md docs/superpowers/plans/2026-05-28-game-architecture-roadmap.md
git commit -m "docs: document game architecture roadmap"
```

---

## 4. 面向发布的里程碑

### 里程碑 A：不依赖 Cocos 的规则引擎可用

完成标准：

- `npm run test:game` 通过。
- `GameSession` 可以加载关卡、摆放警察、拒绝非法摆放、撤销操作、返回胜负状态。
- `assets/GScript/game/domain`、`assets/GScript/game/rules`、`assets/GScript/game/service` 下的文件不引入 `cc`。

### 里程碑 B：Cocos 编辑器内原型可运行

完成标准：

- 游戏仍然通过 `assets/Boost/Main.scene` 和 `GCtrl` 启动。
- `GameController` 可以创建 `GameSession`。
- `BoardGridView` 可以把棋盘坐标转换为 Cocos 本地坐标。
- 登录成功后仍能打开现有 `BoardBackgroundTiled`。

### 里程碑 C：平台抽象具备小程序发布基础

完成标准：

- `gCtrl.platform` 在登录前完成初始化。
- 游戏代码通过 `PlatformAdapter` 使用存档、登录、分享、广告和埋点。
- 对 `wx`、`tt`、鸿蒙 API 或浏览器 API 的直接调用只出现在具体平台适配器中。

### 里程碑 D：生产关卡管线成型

完成标准：

- `assets/Game/Jsons/level` 下的关卡 JSON 与 `LevelData` 类型匹配。
- 方块形状数据可以从 JSON 加载或由 TypeScript 生成。
- 后续增加求解器后，可以批量验证每个关卡至少存在一种可胜利解法。

---

## 5. 架构自检

### 需求覆盖

- 正方形棋盘上的警察、小偷、建筑规则由任务 2 到任务 6 覆盖。
- 多形状警察和建筑方块由 `PieceShape`、`PlacedPiece`、`PieceGeometry`、`BoardOccupancy` 覆盖。
- 小偷路径阻断由 `EscapePathFinder` 和 `WinCondition` 覆盖。
- 微信、抖音、鸿蒙、Web、Native 的平台可移植性由任务 7 和任务 8 覆盖。
- 当前工程进度已在本文档开头说明。
- 未来 Cocos 接入路径由任务 9 覆盖。

### 占位内容说明

本计划中平台专属小程序适配器第一阶段会先路由到 `WebPlatformAdapter`。这是有意设计的阶段性实现，用于先稳定平台抽象入口。具体微信、抖音、鸿蒙 SDK 适配应在核心游戏循环完成后拆分为独立小计划实现。

### 类型一致性

后续任务统一复用任务 2 中定义的类型：

- `Coord`
- `BoardSize`
- `Rotation`
- `PieceType`
- `PieceShape`
- `PlacedPiece`
- `LevelData`
- `ShapeCatalog`
- `PlacePoliceInput`
- `MoveResult`
- `EscapePathResult`

---

## 6. 后续建议

推荐执行顺序：

1. 先完成任务 1 到任务 6，让纯规则引擎可测试、可验证。
2. 再完成任务 7 到任务 8，建立平台适配边界。
3. 然后完成任务 9，把 Cocos 表现层接入 `GameSession`。
4. 最后扩展真实 UI、拖拽、关卡选择、存档、广告、分享和多平台 SDK。

最重要的约束：**游戏规则层不要引入 `cc`，平台能力不要散落在业务代码里。**
