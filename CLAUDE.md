# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概览

这是一个 Cocos Creator 3.8.8 + TypeScript 项目，游戏主题是“警察抓小偷”。运行时代码主要在 `assets/GScript`，Cocos 管理的场景、预制体、贴图、JSON 和 `.meta` 文件在 `assets` 下，移动或重命名资源时必须保持 `.meta` 同步。

当前主线正在从旧的 `assets/GScript/game` 重构到 `assets/GScript/game2`，但重构尚未完成：`GCtrl` 已经打开 `game2/GameController`，而测试、部分规则逻辑和旧视图仍保留在 `game` 目录中。处理游戏逻辑时要先确认当前调用链使用的是 `game2` 还是旧 `game`，不要把两套结构误认为已经完全统一。

Cocos Asset Bundle 划分：

- `assets/Boost`：启动 bundle，包含 `Main.scene` 和 `boost` 组件。
- `assets/GScript`：bundle 名为 `GScriptBN`，包含全局 TypeScript 代码和运行时基础设施。
- `assets/Login`：bundle 名为 `LoginBN`，当前主要包含登录音频资源。
- `assets/Game`：bundle 名为 `GameBN`，包含游戏预制体、图片和关卡 JSON 资源。

## 常用命令

```bash
# 安装依赖
npm install

# 运行全部 Vitest 测试
npm test

# 运行旧 game 纯逻辑/平台相关测试
npm run test:game

# 监听模式运行测试
npm run test:watch

# 运行单个测试文件
npx vitest run tests/game/path/to/test.test.ts

# 类型检查旧 game 纯逻辑与平台代码
npm run typecheck:game

# 类型检查完整 Cocos 项目；需要先由 Cocos Creator 生成 temp/tsconfig.cocos.json
npm run typecheck:cocos
```

测试配置使用 Vitest，入口为 `tests/**/*.test.ts`，Node 环境，`passWithNoTests` 为 true。`tsconfig.spec.json` 目前 include 的是旧 `game/domain`、`game/rules`、`game/service`、`game/level`、`core/platform` 和测试目录，因此它不是 `game2` 的完整类型检查。

## 启动流程

启动场景是 `assets/Boost/Main.scene`。`boost` 组件加载 `GScriptBN`，动态添加 `GCtrl`，并调用 `GCtrl.init(...)`。

`GCtrl` 初始化后会：

1. 将自身挂到 `globalThis.gCtrl`；
2. 初始化平台适配器；
3. 初始化 `UIManager` 和 UI 分层；
4. 注册 `PrefabsCfg` 中的预制体路径；
5. 初始化并显示登录流程；
6. 登录成功后加载 `GameBN`，通过 `gCtrl.ui.open(GameController)` 打开 `assets/GScript/game2/GameController.ts`。

多数运行时代码默认 `gCtrl` 在启动完成后全局可用。

## game2 当前架构

`game2` 是当前正在接入的新实现，目标是替代旧 `game`，但目前仍处于开发中。

- `assets/GScript/game2/GameController.ts` 是当前游戏入口 UI 组件，挂在 `EViewLayer.Anim`。它创建 `GameSession`，加载 `BoardGridView` 预制体并渲染棋盘，然后实例化棋子预制体。当前 `STRUCTURE_PREFAB_KEYS` 只启用了 `Structure1UI`，其余结构棋子仍在接入中。
- `assets/GScript/game2/common/GameTypes.ts` 定义 `Coord`、`Rotation`、`PieceType`、`Piece`、`PieceCatalog`、颜色和最小 `LevelData`。注意该文件当前 import 了 Cocos 的 `Color`，所以 `game2/common` 还不是纯 TypeScript 领域层。
- `assets/GScript/game2/common/GameSession.ts` 目前只保存并返回关卡数据，还没有旧 `game/service/GameSession` 中的放置、撤销、胜负判断等完整规则。
- `assets/GScript/game2/level/LevelData.ts` 提供当前示例关卡。
- `assets/GScript/game2/piece/Pieces.ts` 是棋子目录，定义建筑棋子 `Structure-001..004` 和警察棋子 `PoliceUI-001..006` 的格子、origin、初始旋转和警察站位。
- `assets/GScript/game2/piece/BoardGrid.ts` 负责绘制棋盘格，并提供 `cellToLocal` 坐标转换。
- `assets/GScript/game2/piece/DraggablePiece.ts` 处理棋子的触摸命中、多边形碰撞体检测、拖拽、弹回和点击旋转。
- `assets/GScript/game2/piece/StructurePieces.ts` 继承 `DraggablePiece`，用于建筑棋子的颜色和拖拽行为。

`game2` 的棋子预制体位于 `assets/Game/Prefab/PolicePiece` 和 `assets/Game/Prefab/StructurePiece`。白块节点位置应与 `Pieces.ts` 的 `cells.coord` 保持一致，坐标按 64 像素网格映射；根节点的 `PolygonCollider2D._points` 需要覆盖白块并集外轮廓，否则拖拽命中区域会不正确。

## 旧 game 目录状态

`assets/GScript/game` 是重构前实现，仍包含较完整的纯逻辑和 Cocos 视图分层：领域类型、几何旋转、占用图、放置校验、逃脱路径、胜负判断、关卡校验/求解、旧 `GameSession`、旧 `PoliceView`/`StructureView` 等。

当前 `npm run test:game` 和 `npm run typecheck:game` 仍主要覆盖旧 `game` 纯逻辑。需要迁移或复用规则时，可以参考旧 `game`，但不要直接假设旧接口已经被 `game2` 调用。

## UI 和资源体系

`UIManager` 负责 Canvas 下的 UI 分层，层级来自 `EViewLayer`。打开 UI 时使用组件类：`gCtrl.ui.open(SomeComponent)`。组件类必须在 `assets/GScript/auto/PrefabCfg.ts` 中注册，`registerBUrlByCfg(PrefabsCfg)` 会建立类名到 bundle 路径的映射。

`ResConst.BL(path, bundleName)` 创建 bundle 资源地址。`ResManager` 包装 Cocos `assetManager`，常用调用是：

- `gCtrl.res.loadBundleAsync(bundleName)`：加载 Asset Bundle。
- `gCtrl.res.loadAssetAsync(bUrl, type)`：从 bundle 中加载指定类型资源。

新增需要通过 `gCtrl.ui.open(...)` 打开的 UI 预制体时，需要同步更新 `PrefabsCfg`。bundle 名称必须和目录 `.meta` 中的 bundle 名一致，例如 `GScriptBN`、`LoginBN`、`GameBN`。

## 平台适配

平台 API 统一经过 `assets/GScript/core/platform/PlatformAdapter.ts`。当前 `PlatformFactory` 对 `wx`、`tt`、`harmony` 和默认运行时都返回 `WebPlatformAdapter`，真实微信/抖音/Harmony 适配器尚未接入。

不要在游戏逻辑、控制器或视图中直接调用 `wx.*`、`tt.*`、Harmony API 或浏览器专有 API；需要平台能力时先扩展平台适配层。

## 编辑注意事项

- 修改 Cocos 资源时保留 `.meta` 文件，不要只移动 `.prefab`、图片或场景文件。
- 修改棋子 prefab 时，白块节点名、`Pieces.ts` 中的 `cells.name`、origin 索引和碰撞体需要一起核对。
- `game2` 仍未完成纯逻辑拆分；如果新增可测试规则，优先放在不依赖 Cocos 的文件中，并同步调整测试/类型检查配置。
- `typecheck:cocos` 依赖 Cocos Creator 生成的 `temp/tsconfig.cocos.json`；缺失时需要先用 Cocos Creator 打开项目。
- `npm install` 当前可能报告来自测试工具链依赖的中等漏洞，不要直接运行破坏性升级命令。