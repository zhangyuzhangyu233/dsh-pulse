<div align="center">

<img src="docs/banner-pulse.png" alt="Pulse — a Claude-inspired status layer for the DeepSeek Harness sidebar" width="100%" />

# Pulse

**给 DeepSeek Harness 侧边栏注入 Claude 的状态流。**

原生工作区树一行不动，状态表叠在它上面：谁在等你、谁在跑、谁刚完成——一眼到底。

> 名字取自「侧边栏的脉搏」：会话状态像心率一样实时起伏，你随时知道系统还在跳。

[![MIT](https://img.shields.io/badge/license-MIT-3fbf7f)](LICENSE)
[![DSH](https://img.shields.io/badge/DeepSeek%20Harness-plugin-5b8def)](https://github.com/zhangyuzhangyu233/dsh-pulse)
[![no deps](https://img.shields.io/badge/dependencies-0-e2a33c)](#)

</div>

---

## 为什么要它

DSH 的侧边栏擅长回答「我的会话放在哪个项目」，
但它不太回答「**现在**发生了什么」——哪个在等我批准、哪个在跑、哪个刚跑完我还没看。

Claude 的桌面端把这件事做得很好：agent 列表按状态分组、运行中的会话带实时动静、完成的会话留一个未读标记。
Pulse 把**这套状态语言**移植到 DSH：不是替换原生列表，而是在原生列表上方加一层实时状态表，让「项目结构」和「任务状态」同时可见。

![Pulse 在 DSH 中的实际效果](docs/screenshots/overview.png)

## 它能做什么

### 🧭 状态总表：叠在「工作区」上方，原生树不动

```
状态                                   ⌄
  › ● 需要输入                       2
  › ● 正在工作                       1
  › ● 未读                           3
  › ● 已完成                        12
────────────────────────────────────
工作区                                ← 原生列表，完全保留
  ▸ dsh-coderipper
  ▸ ...
```

- 状态分组、展开/折叠、折叠摘要都按 Claude 的语义组织；
- 原生工作区分组、搜索、拖拽、置顶、归档、右键菜单**一行没改**；
- 折叠总表时摘要行保留实时数字（正在工作 / 需要输入 / 未读），空分组自动隐藏箭头。

### 🗂 状态 → 项目 → 会话 → 执行步骤

展开任意状态，里面先按**项目选项卡**分栏（沿用原生 folder 图标与行规格），再是会话：

![状态表细节](docs/screenshots/status-table.png)

- 运行中的会话前面是**和原生列表一模一样的转圈图标**（同一套 SVG 几何 + 1.5s 呼吸节奏）；
- 会话下方显示**当前执行步骤**：来自 DSH 的 `todo` 投影里 `in_progress` 的条目；没写 todo 时回退到运行中的**子代理名称**，绝不编造；
- 步骤文字带**白色高光从左往右扫过**，字号/行距与会话行一致（14px / 20px / 32px 行高）；
- 点会话直接打开，点项目行收起该项目。

### 🎞 丝滑的状态切换

逆向自 Claude timeline 动画的运动参数，做了一套 FLIP 转场：

| 动作 | 动效 |
|---|---|
| 会话跨状态组移动 | 240ms `cubic-bezier(.3,.7,.4,1)` 平滑滑行 |
| 新出现 | 淡入 + 上移 6px，同曲线 |
| 消失 | 180ms ease-out 淡出 + 上浮 4px（幽灵行） |
| 流式更新 | rAF 合帧 + 内容签名去重，数据没变不重建 DOM，动画不被打断 |

系统「减少动态效果」时全部降级为静态。

### 🎛 可控、可演示

- 设置 → 通用里两个开关：**Claude 状态表**、**模拟状态数据（演示）**；
- 演示模式用脚本数据循环播放全部状态、项目分栏、执行步骤，不需要真的跑任务；
- 中英双语、明暗主题 token 自适应、侧栏折叠 rail 时自动隐藏。

## 安装

> 需要 DeepSeek Harness，且 Web UI 中安装过本地插件。

**方式 A（推荐）**：在 DSH 的「插件」面板里从**本地目录**安装本仓库根目录，
或调用 Harness 的 `plugin_manager` 工具：

```text
install_bundle  target = <本仓库绝对路径>
```

**方式 B（手工登记）**：

1. 把本仓库克隆到任意位置；
2. 在 profile 的 `node_modules` 下建软链指向仓库根目录（例如 `<profile>/node_modules/dsh-coderipper`）；
3. 在 profile 的 `cordis.yml` 插件列表里加一条：

```yaml
- id: dsh-coderipper
  name: dsh-coderipper
```

4. 重启 DSH，在插件面板确认 `Pulse · 状态栏脉搏` 已启用。

安装后：设置 → 通用 → 打开「Claude 状态表」。想先看看效果，再打开「模拟状态数据（演示）」。

## 设计来源（逆向笔记）

- **Claude 桌面端**（`Claude_2.42304`，`ion-dist` bundle）：
  - 侧边栏行状态只有四种：`blocked / review / working / unread`，文案 `Needs input / Ready for review / Working / Unread`；
  - 行状态色：warning 琥珀 / accent 蓝 / muted 灰；
  - 动画：`timeline-status-rise`（240ms `cubic-bezier(.3,.7,.4,1)`）、`timeline-status-fall`（180ms ease-out）、展开 200ms `cubic-bezier(.19,1,.22,1)`。
- **DSH 原生 UI**：行高 32px、标题 14px/20px、行间距 2px、section header 36px、`StateDot ongoing` 转圈几何，全部按原生 CSS 实测值对齐。
- 本项目**没有包含、复制或分发任何 Anthropic / DeepSeek 的代码或资源**；视觉与交互为独立重实现，与 Anthropic 无关联、未获其背书。

## 目录结构

| 路径 | 内容 |
|---|---|
| `package.json` / `client.js` / `index.js` | Pulse 插件本体（零依赖） |
| `locale/` | 中文 / English 界面文案 |
| `cordis.patch.yml` | Cordis 插件登记 |
| `docs/` | 宣传横幅与效果截图 |

## 姊妹项目

动态背景（代码涟漪）是独立项目：[**dsh-coderipple**](https://github.com/zhangyuzhangyu233/dsh-coderipple)。

## 已知限制与路线图

- `待审查（Ready for review）` 分组已预留：DSH 当前没有对应信号，计数为 0 时整组隐藏；
- 执行步骤依赖会话的 `todo` 投影，未写清单的长任务只显示转圈（+ 子代理名兜底）；
- 路线图：hover 卡片（最近活动/工作区）、右键菜单扩展（移动到工作区/分叉）、状态片段筛选。

## License

[MIT](LICENSE)。

---

**English** — Pulse is a Claude-inspired status layer for the DeepSeek Harness sidebar: a live state table (Needs input / Working / Unread / Completed) stacked above the untouched native workspace tree, expandable down to project tabs, sessions and their current run steps, with native-matching spinners, project folder icons, and FLIP state transitions. Zero dependencies, MIT licensed. Visual language and motion parameters are reverse-engineered for parity; no Anthropic or DeepSeek code/assets are included, and there is no affiliation.
