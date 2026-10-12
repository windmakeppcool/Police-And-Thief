# 《警察抓小偷》游戏设计审查报告

- 审查日期：2026-10-12
- 项目：Cocos Creator 3.8.8 + TypeScript（`assets/GScript`），Vitest 纯逻辑测试
- 审查范围：玩法逻辑、代码架构、资源生命周期、交互、UI/UX、平台适配、测试用例、关卡数据与关卡设计器
- 现状基线：`npm test` 通过，9 个测试文件 / 79 个用例全绿；实际关卡 3 个（`level_01` ~ `level_03`）

---

## 0. 总体评价

项目分层清晰，是最大的优点：

- 纯逻辑层（`game/common`、`game/rules`、`game/level`）零 `cc` 依赖，Node 下可直接测试；
- 旋转数学、占用表、合法性四要素、围住判定经逐项核对**未发现会导致错判胜负的高危 bug**；
- `LevelParser` 两阶段校验、错误一次性收集并按 JSON 坐标报告，配关体验好；
- 扫盘测试把求解器解回放到真实 `GameSession` 并断言 `won=true`，有效防止求解器与规则漂移。

**核心问题不在"算错"，而集中在三处：**

1. UI 大量"设计稿假数据 / 死按钮 / 未接线"功能（下一关不切换、关卡名写死、进度不存档等）；
2. 资源引用计数与异步生命周期管理（addRef 无 decRef、async start 无销毁保护）；
3. 关卡内容仅 3 关、无难度档案，且没有任何关卡设计器/生成工具。

---

## 1. 玩法与逻辑漏洞

### 1.1【高】旋转不进撤销栈，托盘预转向会被 undo 静默清掉

位置：`assets/GScript/game/common/GameSession.ts:136-170`

- `rotate()`（场上旋转）不 push 历史。若旋转是玩家的最后一步（例如用旋转完成最后堵截），这步旋转永远无法撤销——undo 栈顶是更早的 place/move。
- 可复现的状态不一致：
  1. `rotateInTray(A)` 预转向 90° → 2. `place(A, 某格)`（历史 prev=null）→ 3. `undo()`
  2. 棋子回到托盘，但朝向被无条件重置为初始 0°，第 1 步的预转向被吞掉。
- "place → remove（保留朝向）→ rotateInTray → place → undo" 同样会把撤下时保留的朝向重置，与 `remove()` "撤下保留当前朝向"的注释承诺矛盾。
- 根因：`HistoryEntry` 只有 `prev: PiecePlacement | null`，`rotations` 表把"场上朝向"和"托盘朝向"混在同一个 Map。

**建议**：`HistoryEntry` 增加 `prevRotation` 字段，rotate/rotateInTray 各自入栈、undo 只回退朝向不动 anchor；或明确"撤销只回退位置操作，回托盘即恢复初始朝向"的语义并修正注释/文档。当前是"代码一套行为、注释另一套承诺"。

### 1.2【高】place/remove/rotate 不校验棋子类型，建筑可被当警察操作

位置：`assets/GScript/game/common/GameSession.ts:103-143`

- 仅 `rotateInTray`（:149-155）有 `PieceType.Police` 守卫。
- `place("Structure-001", ...)` 会把建筑写进 `placements`：该建筑在 `occupancy()` 中被计算两次（level.buildings + placements），`moveCount`（= placements.size）虚高，HUD"已部署 N"被污染（`deployed` 因 id 不在 policeIds 中不受影响）。
- 目前只靠表现层"只拖警察"的约定兜底，纯逻辑层没有自防。

**建议**：三个入口统一加 PieceType 校验，非 Police 一律返回 false，并补三条测试。

### 1.3【中】buildOccupancy 同格冲突静默覆盖

位置：`assets/GScript/game/rules/BoardOccupancy.ts:11-18`

- `map.set(key, owner)` 后写覆盖先写，不检测同格多主；而 `canPlace` 对片内重复 cell 有 `seen` 拦截，两边严格度不对称。
- `GameSession` 构造函数只校验建筑 id 存在，不校验类型/越界/重叠。程序化构造的非法 `LevelData`（测试、未来编辑器、绕过 parser 的热更 JSON）会悄悄丢 owner 信息。

**建议**：GameSession 构造复用 parser 的几何校验，把"进入 session 的 LevelData 一定合法"集中为一处不变量；或在 debug 模式对同键不同 owner 抛错。

### 1.4【低】其他逻辑层问题

| 位置 | 问题 | 建议 |
|---|---|---|
| `PlacementValidator.ts:16-32` | `ignoreOwner` 字段是死参数，生产代码走的是 `occupancy(ignorePieceId)`，两套"忽略自身"机制并存 | 二选一，避免误用 |
| `PlacementValidator.ts:5-8` | `isInBoard` 隐含 gridSize 为偶数，奇数时半整数边界；只靠 parser 保证 | GameTypes 注释或构造函数显式校验偶数 |
| `LevelParser.ts:101-102` | id 只判非空，`" "` 纯空白可通过 | `trim().length > 0` |
| `LevelParser.ts:49-56` | coord 含未知字段（如 z）时报"必须是 {x,y}"，与严格模式风格不统一 | 单独报"未知字段" |
| `LevelParser.ts:211-231` | 建筑自身 cells 重复时提示"与 buildings[i] 重叠"（i 为自身），文案误导 | 区分自身重复与互相重叠 |
| `LevelParser.ts` | 同一 pieceId 在 buildings 出现两次无拦截 | 明确禁止或显式允许 |
| `GameTypes.ts:20` | Readonly 只到第一层，cells 内部对象/数组可变 | 需要严格时用 `ReadonlyArray<Readonly<...>>` |
| `GameSession.ts:54-56` | `getPoliceIds()` 返回内部数组同一引用 | 返回拷贝或冻结 |
| `GameSession.ts:190-191` | 两行重复 JSDoc | 清理 |
| `level/LevelSelection.ts` | 模块级可变单例，selectLevel 不校验关卡存在；多实例无隔离 | 当前单局模型可接受，记录为隐患 |

### 1.5 已核对正确的规则数学（无需修改）

- 旋转 `(x,y) -> (-y,x)`：先减 origin、循环旋转、再加回；steps 用 `((steps % 4)+4)%4` 兜负数，四档验证正确；与 `pieceLayout.ts` 不用 `node.angle` 的约定一致。
- `"x,y"` 格子键：整数坐标无歧义；合法性四要素（棋盘内 / 不踩小偷 / 片内去重 / 占用冲突且非忽略者）完整；托盘棋子不误传 ignore。
- 围住判定只枚举棋盘内四个正交邻居（贴边小偷可用少于 4 子围住），不认斜角，正确。
- 坐标换算 `x'=x-n/2`、`y'=n/2-1-y` 正反映射互逆，错误消息用 JSON 坐标报告。
- moveCount 语义（移动不增、撤下减、挪位不变）、原地放回不污染历史、`deployed` 要求 policeIds 非空，均正确。

---

## 2. 资源与生命周期

### 2.1【高】设计稿帧 addRef 后全局永不 decRef

位置：`assets/GScript/game/ui/DesignAssets.ts:156`

- `loadDesignFrames()` 对每个 SpriteFrame `addRef()`，全工程无对应 `decRef()`。
- Menu/Result/Game 三个控制器每次 open 都重新加载一次，bundle 缓存返回同一批资源 → 每进一次页面引用计数 +1 且永不回落，约 60+ 帧无法被引擎回收，随页面跳转累积泄漏。

**建议**：启动阶段加载一次、由单一持有者（如 GCtrl）统一管理并在退出时 decRef；或改为随页面加载并在控制器 onDestroy 中 decRef。

### 2.2【高】async start() 多段 await 期间无"节点已销毁"保护

位置：`GameController.ts:59-85`；`MenuController.ts:46-66`；`ResultController.ts:28-59`

- 加载途中玩家返回/节点被销毁后，续段仍会 `createNode`/`addComponent`/`schedule`，产生报错或孤儿节点。

**建议**：每次 await 后判 `if (!this.isValid || !this.node.isValid) return;`，或用 destroyed 标志。

### 2.3【高】棋盘 prefab 加载失败进入"无棋盘死局"

位置：`GameController.ts:107-120`

- 失败仅 `console.error` + return，但开始卡片照常弹出、可点"开始"，玩家进入没有棋盘/棋子、无法操作也无法获胜的局；建筑/警察单个 prefab 失败也是静默 `continue`，形成残缺局。

**建议**：关键资源失败阻断进入并提供"重试/返回菜单"，与关卡解析失败（:63-68 destroy 回菜单）的策略对齐。

### 2.4【中】其他资源/生命周期问题

- 对局内 prefab/JSON 由控制器直接 `loadAssetAsync` 加载，脱离 UIManager/ResLoader 的自动释放体系（`GameController.ts:107,132,157`；`LevelRepository.ts`）。建议与 GameController 同生命周期统一释放，或注释明确"GameBN 常驻刻意不释放"。
- tween 未保存引用、销毁/复位不 stop：`DraggablePiece.ts:368-375`（playShake，连触叠加且与拖拽 setPosition 打架）、`BoardGrid.ts:145-149`。对比 `MenuWidgets.makeButton` 已有正确的 stop 模式，应统一。
- `AudioManager.ts:15-25`：用 `new` 构造 Component（应 addComponent）、持有切场景后失效的 Canvas/AudioSource；`playMusic` 不判空 clip、无 stop/暂停/音量/SFX（playOneShot）、AudioClip 不 decRef。
- `ResManager.ts:53` 每次加载成功 console.log，发布包日志刷屏，建议加日志等级开关。

---

## 3. 交互（拖拽）问题

### 3.1【高】落点预览每帧销毁重建节点，无对象池

位置：`DraggablePiece.ts:261-276` → `BoardGrid.ts:102-119`

- touch-move 高频触发，每次都 destroy 旧 ghost 并新建最多 4 个 `Node+Sprite`，每秒数十次实例化/销毁，GC 压力与低端机掉帧风险。

**建议**：4 个可复用 ghost 节点池，showGhost 只更新位置/SpriteFrame/active。

### 3.2【高】hitTest 忽略节点 scale，托盘命中盒仍是全尺寸

位置：`DraggablePiece.ts:353-366`（缩放 :338，约 0.62）

- 视觉缩小但命中盒不缩，相邻槽位命中区重叠，可能误抓旁边棋子或点视觉空白仍响应。

**建议**：改用 `UITransform.getBoundingBoxToWorld()` 世界 AABB，或本地距离阈值乘以 scale。

### 3.3【中】多点触控与命中仲裁

- `onTouchStart/Move/End` 不区分 `event.getID()`（:122-138），仅靠静态 `activePiece` 单锁，多指交替可能错杀拖拽。建议记录 touch ID 并只处理匹配事件。
- `isTopHitPiece` 只在同父兄弟内仲裁（:341-350），托盘 6 子分属 6 个 slot 父节点，跨槽位重叠退化为"谁先注册监听谁拿锁"。建议在统一管理层做全局命中排序，或拖拽时提升到同一 dragLayer。
- 全屏监听 + 无 BlockInputEvents：6 子共 24 个全局 input 监听；模态期间靠 `setPiecesInteractable(false)` 业务标志兜底，新弹层漏处理即触摸穿透。建议遮罩节点挂 `BlockInputEvents`，监听收敛为拖拽层代理。（正面：onDestroy 的 off 与静态锁清理完整，无监听泄漏。）
- 8px 拖拽阈值硬编码（`DraggablePiece.ts:140`），应入 `Layout.ts` 交互常量。

---

## 4. UI / UX 问题（玩家可直接感知，优先级最高）

### 4.1 功能性错误 / 假数据

| 严重度 | 问题 | 位置 |
|---|---|---|
| 高 | **"下一关，出发"不切换关卡**：onNext 未调 `selectLevel(nextId)`，永远重玩当前关；onReplay 与 onNext 完全相同；无"已是最后一关"处理 | `ui/ResultController.ts:46-53` |
| 高 | **HUD 关卡牌永远显示"第 1 关"**，真实关卡序号从未传入 | `ui/GameHudView.ts:37` |
| 高 | **无任何进度持久化**：storage API 已实现但全工程零调用；星数写死 128；unlocked=关卡总数（一开始全解锁）；选关页 TOTAL=24 写死（实际 3 关，21 个死格）；个人中心 7/18/1280 全假；重开游戏一切归零 | `ui/MenuController.ts:84,123`、`ui/LevelsView.ts:14,90,94`、`ui/ProfileView.ts:89-91`、`core/platform/WebPlatformAdapter.ts:19-35` |
| 高 | **设置页底部主按钮"设置好了，回小镇"是死按钮**（只有左上角小箭头绑了 onBack） | `ui/SettingsView.ts:113-116` |
| 中 | 音效/振动开关仅切 spriteFrame，65% 音量条不可拖，隐私/协议/关于三行无绑定，"清除本机游戏记录"无 handler；所有设置刷新即失 | `ui/SettingsView.ts:68-129` |
| 中 | **菜单/结算/对局层级堆叠**：进对局不销毁菜单，结算"返回主菜单"又新开一个 MenuController，旧菜单残留，boot 动画/资源重复 | `MenuController.ts:114`、`ResultController.ts:55-58` |
| 中 | 结算票据"第 08 关 / 1,280 分 / 3 步 / 00:42"全为假数据，但规则上不计分不计时 | `ui/ResultView.ts:45,83,88-89` |
| 低 | 主菜单硬编码"第 08 关·薄荷街角"、24 | `ui/MenuHomeView.ts:65,88` |
| 低 | 分享为空实现（平台 share 也未接入） | `ResultController.ts:54` |

### 4.2 缺失的游戏功能

- **游戏内无暂停 / 返回菜单入口**：对局中无法主动退出，警灯/警车/小偷定时器无法暂停；重开按钮立即生效无二次确认，误触丢局。
- **新手引导严重不足**：仅有一条首次放置后的"点棋子可转向"气泡（`GameController.ts:281-288`，2.2s 自动消失）。核心规则——怎么拖拽、拖出棋盘可撤回、围住小偷、必须 6 枚全部上场才赢——全部没有教学。建议第 1 关做分步遮罩引导（托盘→拖放→点击转向→围堵），可复用现有 coachBubble 素材。
- **游戏内零音效零振动**：落子、转向、非法抖动、撤销、胜利、按钮点击全静默；LoginBN 只有一首登录 BGM，且启动即播可能被浏览器自动播放策略拦截（未处理 play reject）。需补 AudioManager 的 playOneShot/开关/音量与音效资源。
- 撤销按钮禁用态只改透明度（opacity 110），仍可点击，靠 `session.undo()` 返回 false 静默拦截，无原因提示（`GameHudView.ts:82-85`）。
- 选关 ScrollView 直接用 TOUCH_END，未区分滚动与点击，滚动松手停在格子上可能误进关（`LevelsView.ts:109`）。
- `canvas-resize` 事件无人监听（`UIManager.ts:17`），旋转屏幕后已打开页面不重排；竖屏设计稿嵌在横屏 FIXED_HEIGHT 世界中超宽屏两侧留白偏大（属刻意设计，记录观感）。

---

## 5. 架构问题

### 5.1【中】UIManager：类名为 key、不支持传参、无单开/去重/关闭管理

位置：`core/ui/UIManager.ts:47-73`

- open 无法传参，逼出 `LevelSelection` 模块级隐式状态：任何地方都能改、open 顺序决定内容、无法同时开两局。
- open 无去重（菜单堆叠的直接原因），无 close/top 查询，导航靠各控制器自己 `node.destroy()`。
- `instantiate` 中双重 `as any`（:73），类名/路径/`@ccclass` 名配置错误要到运行时才暴露。

**建议**：`open(cls, payload?)` 支持载荷以替代模块状态；维护已打开实例表支持单开/复用/关闭；收窄 instantiate 类型。

### 5.2【中】平台适配是"假适配"

位置：`core/platform/PlatformFactory.ts:7-16`

- wx/tt/harmony/默认四个分支全部返回 WebPlatformAdapter：localStorage 在小游戏环境可能不存在（静默降级内存 Map，重开丢档）、`navigator.share` 强转在无 navigator 时跳过、登录永远 `web-anonymous`、广告/上报为空。
- 风险是上架小游戏后存储/分享/登录/广告**静默失效**而非显式报错。

**建议**：未实现分支显式告警/上报"适配缺失"；Web 存储 `JSON.parse` 与 `setItem` 加 try/catch，脏数据回退 null、配额失败降级内存。
- 另：登录是 `LoginCtrl.ts:23-27` 的 setTimeout 假登录，平台 `login()` 完全没被调用。

### 5.3【低】其他

- `void gCtrl.ui.open(...)` 普遍无 catch（Menu/Game/Result 共 6 处），instantiate 抛错变 unhandled rejection，玩家停在原页面无提示。建议统一 openOrToast。
- `globalThis.gCtrl` 为 any（`GCtrl.ts:26,53`）、登录回调用 `Function`（:24）、`boost.ts` 用字符串 `addComponent("GCtrl")`——全局入口失去类型保护与重构保障。
- `LevelRepository` 索引加载失败静默退化为只有 level_01，菜单仍按 levelIds 渲染，应给错误页/重试。
- 视图构造函数偏长（ResultView 137 行几乎全在构造函数）；BoardGrid 同时保留 `@property SpriteFrame` 与代码注入两套素材来源，运行只用后者，建议确认后移除以免编辑器残留误引用。
- 魔法数字散落：64px 格尺寸（DraggablePiece:55 / BoardGrid:16）、0.62 托盘缩放、20/16 padding、0.7s 胜利延时、2.2s 引导等，违反"常量集中 Layout.ts"的约定；`BoardGrid.isValidCoord`（:35-38）重复实现了规则层 `isInBoard`。

---

## 6. 测试与求解器

### 6.1【高】LevelData 最少步数测试用错棋子目录

位置：`tests/game2/LevelData.test.ts:53`

- `enumeratePlacements(BoardPieces, ...)` 把 4 个 Structure 建筑也当成可落子；而 `LevelJson.test.ts:23-25` 明确过滤 POLICE_ONLY 并注明"建筑是固定路障"。
- 两处口径不一致，"level_01 最少两步"可能借助了建筑形状，不能严格证明"警察棋子最少两步"。

**建议**：统一改用 POLICE_ONLY（helper 导出共用）。

### 6.2【高】求解器预算耗尽与"无解"不可区分

位置：`tests/game2/helpers/levelSolver.ts:134,158`

- DFS 超 30 万节点静默返回 null，与穷尽无解同值。当前 3 关预算充裕，但关卡变密后会出现"实际有解却扫盘报不可解"的假阴性，且无法排查是数据坏还是算力不够。

**建议**：三态返回 `solved | unsat | unknown`（或外带 `nodes/budgetExceeded`），扫盘对 unknown 失败并提示提预算；可加 `nodes < budget*0.5` 预警。

### 6.3【中】枚举存在大量等价重复落点

位置：`levelSolver.ts:60-78`

- 横条（PoliceUI-003）旋转 0/180 占格完全相同；PoliceUI-002 与 004 几何同形（只差被求解器正确忽略的 policeAt）。同组 cellKeys 以不同 rotation/id 重复进搜索。

**建议**：按 cellKeys 去重（同形保留一个 rotation），预计节点数降一个数量级，同时缓解预算风险。

### 6.4 测试覆盖盲区清单

GameSession：

- 【高】对建筑 id 调 place/remove/rotate 应返回 false 且状态不变（现有 :126 的 false 只是因自身占用，属偶然通过）；
- 【中】已上场棋子旋转撞上**其他棋子**的拒绝（现只测了转出棋盘）；
- 【中】已上场棋子挪到非法位：返回 false、anchor/rotation 保留、undoCount 不增；
- 【中】"旋转不入栈"契约没有显式测试（place 后连转两次再 undo、move 后只旋转再 undo）；
- 【低】构造期未知建筑抛错（:34-36）、requirePiece 抛错（:206-209）；reset 后建筑占用保留、胜利后 reset 归零；先挪位后撤下再 undo 的 prev 链；rotateInTray 的 270→0 在 session 层未覆盖。

规则层：

- 【中】`canPlace` 空 cells 数组 vacuous true 未钉语义；
- 【低】负向越界（-4）、四角贴边合法值；斜向占用不影响围住；WinCondition `exits.length===0` 防御分支。

LevelParser（错误消息是配关者主要交互界面，值得逐分支钉）：

- 【中】thief 形状合法但坐标越界（阶段二最高频错误）零覆盖；
- 【中】`parseLevel(null/42/"x")`、buildings 元素为非对象；
- 【低】pieceId 为数字/缺失、anchor null/小数/缺字段、rotation 非法字符串；gridSize 非法时阶段二整体跳过；gridSize 非 6 的坐标换算。

求解器：

- 【中】`minMovesToCapture`（:81-108）只有 level_01 两个点间接支撑，应用单格棋子构造最小用例独立测试；
- 【低】`isCaptured`（:110-114）重复实现了生产代码 `WinCondition`，测试侧应直接复用。

### 6.5 值得保留的好设计

- 扫盘断言 levels.json 与文件双向一一对应、文件名=内部 id、开局未围死、满编可解；
- 求解器解经真实 GameSession 回放并断言 won（LevelJson.test.ts:67-74），防止 solver 与规则漂移；
- MRV 剪枝（对候选最少的出口枚举覆盖者）经分析是完备的，静态拼放与落子顺序无关，不漏解；容量剪枝是安全松弛；
- 操作可达性成立：`rotateInTray` 允许托盘无校验预转任意朝向，求解器枚举到的每个朝向玩家都能做到。

---

## 7. 关卡数据与关卡设计器

### 7.1 关卡现状（实际仅 3 关）

| 关卡 | 小偷(JSON) | 小偷(内部) | 出口数 | 建筑数/占格 | 形状组合 |
|---|---|---|---|---|---|
| level_01 | (4,1) | (1,1) | 4 | 2 / 6 | 竖条(横放) + 小L |
| level_02 | (3,2) | (0,0) | 4 | 2 / 7 | 大L + 小L |
| level_03 | (2,3) | (-1,-1) | 4 | 2 / 7 | 大L + 竖条 |

- level_01 教学合格（居中、少障碍、最少 2 步可围但必须摆满 6 子才赢，GameSession.test.ts:143-157 锁定了这个核心教学点）；三关形状引入有序。
- 【中】**无量化难度曲线，且与规划文档漂移**：`docs/superpowers/plans/2026-10-09-level-json-config.md` 规划 level_02/03 为 2 出口边缘小偷、level_01 最少 3 步；实际三关全是 4 出口内部小偷、level_01 断言最少 2 步。除 level_01 外没有任何步数/解数断言，level_02/03 的难度无人知晓。
- 题型缺失：三关都只有 2 栋建筑、≤7 格障碍；边缘/角落小偷、建筑高密度、多建筑联动均未出现。
- 【低】`Structure-002` 与 001 几何完全相同且无任何关卡引用，是死目录项（视觉上也削弱形状多样性）。
- 【低】无 D4 对称去重、满编解数量、唯一解/多解、最少步数区间等质量断言；当前三关人工核对互不等价但无机器保护。
- JSON schema 严格拒绝未知字段，没有引导/提示/parMoves 等教学元数据字段。
- level_01 参考解硬编码共享夹具（levelFixtures.ts:20-27）被多个测试引用，是有意的"金样例"回归钉，脆弱但合理；注意最少步数值依赖求解口径（见 6.1）。

### 7.2 关卡设计器现状

**仓库内没有任何关卡编辑器/生成器**：`tools/` 下仅有 `asset-gen/`（Python/Pillow 美术管线）；设计文档无编辑器规划；规划文档明确写过 `expectedMinMoves` 等字段 YAGNI。

当前工作流是纯手写 JSON：配关者要心算"左上原点列/行 ↔ 内部中心原点 y 向上"两套坐标、手算大 L/竖条旋转占格，可解性只能存盘后跑 `npm test`，迭代环很长。

### 7.3 设计器建议（按优先级）

有利条件：LevelParser、PieceGeometry、PlacementValidator、WinCondition、levelSolver **全部无 cc 依赖**，设计器内核已近乎现成。

1. 【高】**最小可用设计器**：单页 HTML + ESM（仿 `design/pocket-patrol.html`）或 Vite 小应用，不进 Cocos 编辑器：
   - 6×6 网格点选小偷、从目录拖入建筑（复用 pieces.ts 的 cells/origin，旋转调 pieceCells，与 pieceLayout 同口径，所见即所算）；
   - 每次编辑实时跑 parseLevel（原样展示中文 errors）、开局围死检查、findFullSquadSolution、minMovesToCapture、解计数；
   - 导出时用 toJsonCoord 反算，直接产出符合严格 schema 的 level_XX.json 并更新 levels.json；`.meta` 交 Cocos Creator 刷新自动生成（CLI/CI 则需照 `.creator/default-meta.json` 模板补 meta）。
2. 【中】**质量门禁可视化**（与扫盘测试共用同一份评估代码，事前筛选 + 事后回归）：最少围堵步数、满编解总数区间、每枚警察棋子的合法落点数（防"某子只剩一两个落点"的假可解）、D4 归一化与已有关卡查重、前 N 个解差异度。
3. 【中】**自动生成 + 人工筛选流水线**（放 `tools/`，纯 TS）：枚举空间很小（小偷 36 位 × 每建筑 36 anchor × 4 向 × 4 形状），批量生成构型 → solver 打标（可解性、步数桶、建筑密度、对称性）→ 按难度桶人工挑选 → 产物必须再过 LevelJson 扫盘，形成"生成→评估→人工选→扫盘"闭环，支撑扩到 24 关。
4. 【低】schema 扩展走正式流程：需要教学步骤/parMoves/难度标签时在 LevelParser 显式加字段（严格模式会拒绝未知字段），扫盘同时校验 parMoves 与 solver 一致，不要在工具里维护旁路元数据。

---

## 8. 修复路线图（按收益排序）

**第一批：玩家可直接感知的功能错误（改动小、收益大）**

1. "下一关"推进关卡 + 最后一关处理（ResultController/LevelSelection）；
2. HUD/菜单/结算显示真实关卡序号，移除/接通假分数假用时；
3. 设置页底部死按钮绑定 onBack；
4. 菜单堆叠修复（UIManager 单开/复用 或 导航栈显式销毁）；
5. 进度持久化：通关 id、星数、解锁进度、音效设置接入 storage；选关页 TOTAL 取 levels.json 实际长度。

**第二批：逻辑自防**

6. GameSession place/remove/rotate 加警察类型守卫 + 补测试；
7. 统一"旋转与撤销"语义（旋转入栈或改注释）并补契约测试。

**第三批：稳定性**

8. DesignAssets addRef/decRef 归属治理；
9. 三个控制器 async start 的销毁竞态保护；
10. 棋盘资源加载失败阻断与提示。

**第四批：手感与表现**

11. ghost 对象池、命中盒 scale 修正、touch ID、模态 BlockInputEvents；
12. 补游戏音效/振动与 AudioManager 能力、音效设置接线；
13. 第 1 关分步新手引导；暂停/返回菜单、重开确认。

**第五批：工具链与内容**

14. 修 LevelData 测试口径；solver 三态返回 + 落点去重；
15. 补测试盲区（约 15 条，见第 6 节）；
16. 关卡设计器 MVP → 自动生成流水线 → 扩充到 24 关并建立每关难度档案（步数/解数区间/查重）；
17. 平台适配缺失显式告警，排期真实 wx/tt 适配器。

---

## 附：本次审查涉及的关键文件索引

- 逻辑层：`assets/GScript/game/common/GameSession.ts`、`game/rules/*`、`game/level/*`
- 表现层：`game/GameController.ts`、`game/LevelRepository.ts`、`game/piece/*`
- UI：`game/ui/*`（Hud/Overlay/Tray/Levels/Menu*/Result*/Settings/Profile/DesignAssets/Layout）
- 基础设施：`core/ui/UIManager.ts`、`core/res/*`、`core/audio/AudioManager.ts`、`core/platform/*`
- 测试：`tests/game2/*`、`tests/game2/helpers/levelSolver.ts`
- 关卡：`assets/Game/levels/levels.json`、`level_01.json` ~ `level_03.json`
