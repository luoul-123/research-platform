# Research Platform

一个**本地优先（local-first）的科研工作台**，使用原生 HTML / CSS / JavaScript 编写，无需后端、无需构建、无需安装依赖。双击 `index.html` 即可使用。

仓库中**不包含任何个人文献、研究心得、待办或个人信息**：初次打开时文献清单为空，所有数据只保存在你自己的浏览器里。

![Research Platform 界面预览](screenshot.png)

> 截图为示例数据；仓库默认文献为空。

## 功能

### 1. 文献阅读清单

- 文献分区（可新建 / 重命名 / 删除分区，分区可折叠）；
- 五星优先级（1–5 星）；
- 阅读状态（未读 / 已读）、年份、关注点、DOI 或原文链接；
- 搜索、按状态 / 星级筛选、按优先级 / 年份 / 标题排序；
- 每篇文献可打开**独立笔记小窗**，写长笔记；
- 阅读进度条。

### 2. 研究心得

- 左侧大编辑区 + 右侧心得列表的主从布局；
- 支持标题、正文、标签、置顶；
- 搜索、仅看置顶、按更新时间 / 创建时间 / 标题排序；
- 自动保存、字数统计、创建 / 更新时间；
- 可新建多条，选中即切换。

### 3. 待办

- 快速添加（回车即可）；
- 优先级（高 / 中 / 低）、截止日期（过期标红）、标签、备注；
- 完成勾选、自动沉底、清除已完成；
- 搜索、筛选（全部 / 未完成 / 已完成）、排序。

### 其他

- 顶部**常用网址**书签栏：可添加固定网址，点击在新标签页打开；
- 导出 / 导入 JSON（文献、心得、待办、书签一起备份）；
- 深色 / 浅色主题；
- 打印当前模块；
- 所有数据保存在浏览器 `localStorage`，不上传服务器。

## 快速开始

```text
1. 下载或克隆本仓库
2. 双击 index.html（推荐 Chrome / Edge）
3. 在「文献阅读清单」里点「＋ 添加文献」开始使用
```

不需要 `npm install`，也不需要启动本地服务器。

### 公开模式 / 私人模式

| 模式 | 打开方式 | 数据 |
| --- | --- | --- |
| 公开模式（默认） | 直接打开 `index.html`，或访问 GitHub Pages | 空数据；存储键 `research_platform_v1`；不加载 `assets/private/` |
| 私人模式（仅本机） | 在 `file://` 或 `localhost` 下打开 `index.html?private=1` | 加载 `assets/private/`；存储键 `reading_tracker_v1` |

私人模式只在本地生效；在 GitHub Pages 上即使带 `?private=1` 也不会加载私人文件。

> 注意：`index.html`、`notebook.html` 和 `assets/` 必须保持在同一目录，移动时请一起移动。

## 目录结构

```text
.
├── index.html                # 主页面（科研工作台）
├── notebook.html             # 单篇文献的独立笔记小窗
├── screenshot.png            # README 界面截图（示例数据）
├── tools/
│   └── make-private-state.js # 把导出 JSON 转成 assets/private/state.js
├── assets/
│   ├── app.js                # 主页面逻辑（文献 / 心得 / 待办 / 书签）
│   ├── style.css             # 主页面样式
│   ├── notebook.js           # 笔记小窗逻辑
│   ├── notebook.css          # 笔记小窗样式
│   ├── data.js               # 初始数据（默认空）
│   └── private/
│       ├── data.js           # 本地文献 seed（gitignore，可选）
│       └── state.js          # 本地完整状态（gitignore，可选）
└── README.md
```

## 数据与隐私

- 所有文献、心得、待办、书签都保存在**本机浏览器 localStorage**，不上传服务器；
- 公开默认模式使用空数据 + 独立存储键 `research_platform_v1`，**不会读取**你的私人数据；
- 仓库里的 `assets/data.js` 是空数据种子，不包含任何个人内容；
- 私人模式只在本机 `index.html?private=1` 下启用，使用旧存储键 `reading_tracker_v1` 和 `assets/private/` 下的文件；这些文件已被 `.gitignore` 忽略，不会被提交；
- 换电脑或清理浏览器前，请用私人模式的「导出」备份 JSON，再到新环境「导入」；
- 不同浏览器 / 不同文件路径的 localStorage 可能不共享，建议固定使用同一个浏览器与目录。

### 私人状态文件（心得 / 待办 / 书签）

`assets/private/data.js` 只包含**文献 seed**。心得、待办、书签默认存在浏览器 localStorage 中，不在 `data.js` 里。

如果想把它们也保存成文件：

1. 在本机用 `index.html?private=1` 打开私人模式，点右上角「导出」下载 JSON；
2. 在项目根目录运行：

   ```bash
   node tools/make-private-state.js "C:\path\to\research_workbench_YYYY-MM-DD.json"
   ```

3. 会生成 `assets/private/state.js`（已被 `.gitignore` 忽略），包含 `entries / memos / todos / bookmarks`。

私人模式只在 localStorage 为空时用 `state.js` 兜底；如果浏览器里已有数据，仍以 localStorage 为准。要强制从文件恢复，可用页面「导入」该 JSON，或清除该页面的本地存储后刷新。

## 自定义

- 想预置文献：公开模式编辑 `assets/data.js`；私人模式编辑 `assets/private/data.js`；
- 想改配色：编辑 `assets/style.css` 顶部的 CSS 变量；
- 想改标题：编辑 `index.html` 中的 `<title>` 与 `<h1>`。

## 说明

- 该项目是纯静态页面，适合用 GitHub Pages 直接托管（入口 `index.html`）；
- 笔记小窗通过 `window.open` 打开，浏览器如拦截弹窗，请允许本站点弹窗；
- 未附带开源许可证，如需再分发请自行添加 LICENSE。
