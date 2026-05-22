# 警察抓小偷（Police-And-Thief）

基于 Cocos Creator 的益智解谜玩法骨架（TypeScript）。棋盘为多尺寸正方形网格，包含：
- 建筑：关卡预置，所在格不可通行
- 小偷：单格起点
- 警察：玩家放置，所在格不可通行

胜利条件：在四向走格规则下，小偷无法从当前位置经由可通行格连通到任何边界格（不存在走到棋盘外的路径）。

## 目录结构
- [assets/scripts/core](file:///workspace/assets/scripts/core)
  - 纯规则与数据结构（不依赖 Cocos 引擎 API）
  - 棋盘、关卡校验、逃脱判定（BFS/FloodFill）
- [assets/scripts/game](file:///workspace/assets/scripts/game)
  - 用例层：放置/移除警察、胜利判定、撤销重做、存档服务
- [assets/scripts/platform](file:///workspace/assets/scripts/platform)
  - 平台能力抽象 `IPlatformBridge` + web/微信/抖音/内存实现
- [assets/resources/levels](file:///workspace/assets/resources/levels)
  - 关卡 JSON 样例
- [tools/selftest.ts](file:///workspace/tools/selftest.ts)
  - Node 自测：验证关卡加载、逃脱判定、撤销重做、存档

## 本地验证（不依赖 Cocos）
```bash
npm install
npm run typecheck
npm run selftest
```

## 在 Cocos Creator 中接入（建议方式）
1. 创建 Cocos Creator 3.x TypeScript 项目
2. 将本仓库的 `assets/` 合并到你的 Creator 项目 `assets/` 下
3. 在 `boot` 场景中创建平台桥接并注入：
   - `createPlatformBridge()`：运行时自动选择 web/微信/抖音（在非浏览器环境可用内存实现）
4. 在 `gameplay` 场景中：
   - 读取关卡 JSON → `loadLevel(config)`
   - 创建 `GameSession` 并通过 UI 触发 `tryPlacePolice / tryRemovePolice`
   - 用 `checkWin()` 或操作返回值里的 `win` 更新胜负 UI

## 关键接口与入口
- 逃脱判定：[hasEscapePath](file:///workspace/assets/scripts/core/escape.ts)
- 关卡加载：[loadLevel](file:///workspace/assets/scripts/core/level.ts)
- 玩法会话：[GameSession](file:///workspace/assets/scripts/game/session.ts)
- 平台抽象：[IPlatformBridge](file:///workspace/assets/scripts/platform/bridge.ts)

## 多平台发布要点（微信 / 抖音 / 鸿蒙）
- 核心玩法完全位于 `core`/`game`，不直接调用平台 SDK
- 与平台相关的存档、提示、振动等通过 `IPlatformBridge` 统一封装
- 各平台构建差异集中在：
  - Creator 的构建目标与构建模板
  - `assets/scripts/platform/*` 的实现扩展（例如广告/分享/埋点）
