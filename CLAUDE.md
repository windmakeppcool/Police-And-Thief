# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概览

这是一个 Cocos Creator 3.8.8 + TypeScript 项目，游戏主题是“警察抓小偷”。运行时代码主要在 `assets/GScript`，Cocos 管理的场景、预制体、贴图、JSON 和 `.meta` 文件在 `assets` 下，移动或重命名资源时必须保持 `.meta` 同步。

游戏只有一个实现：`assets/GScript/game`，仓库中不存在第二套并行结构，不需要判断“当前调用链走的是哪一套”。注意测试目录名为 `tests/game2`，与源码目录 `game` 并不一致，属于历史命名残留。

Cocos Asset Bundle 划分：

- `assets/Boost`：启动 bundle，包含 `Main.scene` 和 `boost` 组件。
- `assets/GScript`：bundle 名为 `GScriptBN`，包含全局 TypeScript 代码和运行时基础设施。
- `assets/Login`：bundle 名为 `LoginBN`，当前主要包含登录音频资源。
- `assets/Game`：bundle 名为 `GameBN`，包含游戏预制体、拆分后的设计稿图片素材，以及关卡 JSON 资料（`levels/`：`levels.json` 索引 + 每关一个 `level_XX.json`）。

## 常用命令

```bash
# 安装依赖
npm install

# 运行全部 Vitest 测试
npm test

# 只运行纯逻辑（game 规则层）与平台相关测试
npm run test:logic

# 监听模式运行测试
npm run test:watch

# 运行单个测试文件
npx vitest run tests/game2/GameSession.test.ts

# 类型检查纯逻辑与平台代码
npm run typecheck:logic

# 类型检查完整 Cocos 项目；需要先由 Cocos Creator 生成 temp/tsconfig.cocos.json
npm run typecheck:cocos
```

测试配置使用 Vitest，入口为 `tests/**/*.test.ts`，Node 环境，`passWithNoTests` 为 true。`tsconfig.spec.json` include 的是 `assets/GScript/game/{common,rules,level}`、`assets/GScript/core/platform` 和 `tests`，因此这些纯逻辑文件**不能 import `cc`**，否则 `typecheck:logic` 会失败。

## 启动流程

启动场景是 `assets/Boost/Main.scene`。`boost` 组件加载 `GScriptBN`，动态添加 `GCtrl`，并调用 `GCtrl.init(...)`。

`GCtrl` 初始化后会：

1. 将自身挂到 `globalThis.gCtrl`；
2. 初始化平台适配器；
3. 初始化 `UIManager` 和 UI 分层；
4. 注册 `PrefabsCfg` 中的预制体路径；
5. 初始化并显示登录流程；
6. 登录成功后加载 `GameBN`，通过 `gCtrl.ui.open(GameController)` 打开 `assets/GScript/game/GameController.ts`。

多数运行时代码默认 `gCtrl` 在启动完成后全局可用。

## game 架构

`game` 分为纯逻辑层（可测试、不依赖 Cocos）与表现层，边界按目录划分：

纯逻辑层（无 `cc` 依赖，Node 下可直接测试）：

- `game/common/GameTypes.ts`：`Coord`、`Rotation`、`PieceType`、`Piece`、`PieceCatalog`、`BuildingPlacement`、`LevelData`。颜色令牌已移到表现层，本文件保持纯净。
- `game/rules/PieceGeometry.ts`：绕 origin cell 的旋转（`(x, y) -> (-y, x)`，与设计稿一致）、角度/步数换算、绝对坐标展开。
- `game/rules/BoardOccupancy.ts`：`buildOccupancy` 与 `"x,y"` 格子键，占用表为 `格子键 -> 棋子 id`。
- `game/rules/PlacementValidator.ts`：放置合法性（棋盘内、不踩小偷、不重叠、支持忽略自身占用）。
- `game/rules/WinCondition.ts`：小偷去路枚举、是否被围住。
- `game/common/GameSession.ts`：一局游戏的状态机，负责建筑占用、放置/移动/旋转、撤销历史、步数与胜负；表现层所有合法性判断都交给它。
- `game/level/LevelParser.ts`：关卡 JSON 解析与校验。JSON 用左上原点列/行坐标（0..gridSize-1），在这里一次换算为内部网格坐标；严格模式拦截未知字段，校验错误一次性收集并按 JSON 坐标报告。
- `game/level/LevelSelection.ts`：菜单与对局之间传递「当前关卡 id」的模块级状态（`UIManager.open` 不支持传参）。

表现层（Cocos）：

- `game/GameController.ts`：入口组件，挂在 `EViewLayer.Anim`。装配设计稿 UI → 加载棋盘预制体 → 按关卡数据摆放建筑 → 把 6 个警察棋子放进托盘槽位，并驱动开始/撤销/重开/胜利流程与定时动画（警灯、警车顶灯、小偷东张西望）。
- `game/LevelRepository.ts`：从 `GameBN` 加载 `levels/levels` 与 `levels/<id>` 的 `JsonAsset` 并交给 `LevelParser`。放在 `game/` 根目录而非 `game/level/`，因为后者被 `tsconfig.spec.json` 覆盖、不能 `import 'cc'`。
- `game/piece/BoardGrid.ts`：绘制棋盘格（四角用斑马线素材）、小偷节点与落点预览（合法/非法两套贴图）。
- `game/piece/DraggablePiece.ts`：警察棋子交互。托盘 → 棋盘拖拽（超过 8px 才算拖拽）、落点预览、点击原地转向、非法落点弹回并抖动；命中判定用“格子方块并集”，不依赖 `PolygonCollider2D`。
- `game/piece/StructurePieces.ts`：建筑障碍，只按关卡数据摆放，不参与交互。
- `game/piece/pieceLayout.ts`：按 `cells` + `origin` 摆放预制体子节点，保证视觉与 `PieceGeometry` 的占位计算一致（不使用 `node.angle`，避免与逻辑旋转方向不一致）。
- `game/ui/*`：设计稿素材加载（`DesignAssets.ts`）、布局（`Layout.ts`）以及 HUD、托盘、弹层、菜单、结算、设置、个人中心等界面。节点/精灵/文本构造工具位于 `core/ui/UIFactory.ts`。

## UI 与素材体系

UI 视觉基准是 `design/pocket-patrol-design.md`（“口袋巡逻队”薄荷绿积木小镇，含配色、圆角、字号、触控与动效规范），预览稿为 `design/pocket-patrol.html`（内含 20 个 `i-*` SVG 图标 symbol）+ `design/pocket-patrol.css`（色板、圆角、阴影、渐变规格）。

`assets/Game/image` 下的 PNG 素材原先由早期“积木小镇”原型 `design/game-ui.html` 拆分而来，该原型已删除（如需回溯见 git `79da70f^`）。因此**现有素材仍是积木小镇配色**（深蓝墨 `#22315B` / 警察蓝 `#2E7CD6` / 小偷红 `#F04E45`）。

配色统一使用 `game/ui/DesignAssets.ts` 的 `PocketPalette`，与 `design/pocket-patrol.css` 的 CSS 变量一一对应。旧的“积木小镇”配色令牌 `Palette` 已移除，素材也已按新设计稿重制完毕（生成管线与规格表见 `tools/asset-gen/`，原图备份在 `tools/asset-gen/backup/`）。

素材分类存放在 `assets/Game/image` 下：

- `board/`：棋盘格（普通 + 四角斑马线）、落点预览（合法/非法）
- `character/`：小偷警惕动画三帧
- `piece/`：警察格（正常 + 拖拽高亮）、警察站位徽章
- `ui/`：按钮、卡片底、托盘底、警灯闪烁两帧、虚线槽位、引导气泡、遮罩
- `town/`：小屋、树、警车（正常 + 顶灯）
- `icon/`：撤销/重开图标、星星（亮/暗）、城市天际线

素材通过 `game/ui/DesignAssets.ts` 的 `DesignAssetPaths`（`BL('image/...', 'GameBN')`）在运行时加载，需要九宫格拉伸的素材在加载时写入 inset。**新增或替换素材时改这一处即可**，不需要在预制体里逐个挂图。

`assets/Game/Prefab` 中的预制体只负责棋子的格子子节点：

- 棋子 prefab 的子节点名必须与 `game/piece/pieces.ts` 的 `cells.name` 一致；白块本地坐标应等于 `coord * 64`，且 origin cell 位于节点本地原点 `(0,0)`（`pieceLayout.ts` 会按数据重新摆放，但仍建议保持预制体与数据一致）。
- 警察 prefab 的警察站位格内嵌 `cop_badge` 节点；`pieces.ts` 的 `policeAt` 必须与该格子对应。
- 建筑 prefab 使用 `block_05.png`；`PolygonCollider2D` 已不再参与命中判定，可以留作编辑器辅助。

`UIManager` 负责 Canvas 下的 UI 分层，层级来自 `EViewLayer`。打开 UI 时使用组件类：`gCtrl.ui.open(SomeComponent)`。组件类必须在 `assets/GScript/auto/PrefabCfg.ts` 中注册，`registerBUrlByCfg(PrefabsCfg)` 会建立类名到 bundle 路径的映射（`GameController` 的键名必须与类名一致）。

`ResConst.BL(path, bundleName)` 创建 bundle 资源地址。`ResManager` 包装 Cocos `assetManager`，常用调用是：

- `gCtrl.res.loadBundleAsync(bundleName)`：加载 Asset Bundle。
- `gCtrl.res.loadAssetAsync(bUrl, type)`：从 bundle 中加载指定类型资源。

## 玩法规则

- 6×6 棋盘，坐标范围 -3..2，小偷固定在关卡配置的格子；建筑由关卡数据自动摆放，玩家不能移动。
- 关卡从 `assets/Game/levels/level_XX.json` 读取：可配置小偷位置与建筑摆放（`anchor` + `rotation`）。JSON 坐标是左上原点列/行（x 向右、y 向下），运行时换算为内部坐标；加载时只做静态校验，非法关卡拒入并打印全部错误。可解性由 `tests/game2/LevelJson.test.ts` 扫盘断言。
- 玩家从托盘拖出警察棋子放到棋盘；点击棋子会顺时针转向 90°：已上场时绕 origin cell 原地转向（需要落点合法），还在托盘时则先调好朝向（`GameSession.rotateInTray`），这样贴边的落点也能直接拖上去。
- 只有棋子“首次上岗”才计入步数；把已上场的棋子挪到别的格子不计步。
- **获胜 = 小偷被围住 且 6 枚警察棋子全部上场**（`GameSession.won`）。两者缺一不可：只围住不算赢，摆满了没围住也不算。
- **关卡可解性要求「用满全部警察棋子」**：一关只算合格，当且仅当存在一种放法把 6 枚警察棋子全部合法放到棋盘上、并且围住小偷。这保证不会出现「某枚棋子被建筑堵得完全放不下去」的坏关卡。
- 通关固定得 1 颗星，不做多档评级（星数等于已过关卡数）。
- 撤销可回退上一次放置/移动（首次上岗被撤销时步数回退），重开把所有警察恢复到托盘初始状态。

## 平台适配

平台 API 统一经过 `assets/GScript/core/platform/PlatformAdapter.ts`。当前 `PlatformFactory` 对 `wx`、`tt`、`harmony` 和默认运行时都返回 `WebPlatformAdapter`，真实微信/抖音/Harmony 适配器尚未接入。

不要在游戏逻辑、控制器或视图中直接调用 `wx.*`、`tt.*`、Harmony API 或浏览器专有 API；需要平台能力时先扩展平台适配层。

## 编辑注意事项

- 修改 Cocos 资源时保留 `.meta` 文件，不要只移动 `.prefab`、图片或场景文件。
- `core/ui/UIFactory.ts` 是与游戏无关的 UI 构造工具，`addLabel` / `createLabel` 的 `color` 为必填项——core 层不绑定业务配色，漏传会在编译期报错而不是运行时变白字。
- 新增可测试的规则时放在 `game/rules`、`game/common`、`game/level` 中（保持无 `cc` 依赖），并在 `tests/game2` 补用例。
- 调整关卡 JSON 后跑 `npm test`：`tests/game2/LevelJson.test.ts` 会扫盘校验 `levels.json` 与关卡文件一一对应、每关结构合法、开局不会被围死，且**用满全部 6 个警察棋子可解**（判定实现在 `tests/game2/helpers/levelSolver.ts` 的 `findFullSquadSolution`）；`tests/game2/LevelData.test.ts` 另外断言 level_01 的参考解与最少步数。
- UI 布局常量集中在 `game/ui/Layout.ts`，设计分辨率为 1280×720（`FIXED_HEIGHT`），改布局优先改这里的 `Metrics`。
- `typecheck:cocos` 依赖 Cocos Creator 生成的 `temp/tsconfig.cocos.json`；缺失时需要先用 Cocos Creator 打开项目。
- `npm install` 当前可能报告来自测试工具链依赖的中等漏洞，不要直接运行破坏性升级命令；若本机 npm 缓存权限异常，可用 `npm install --cache .npm-cache`。
