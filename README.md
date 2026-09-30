# dsh-appearance

给 DeepSeek Harness 桌面端 / Web 端加一组**外观设置**：字体、配色预设、强调色与文字色、正文字号。全部效果走官方主题 token（`--dsw-*` / `--shiki-*`），不修改 DSH 源码、不打包任何字体文件、零运行时依赖、零构建步骤。

和已有字体 / 主题插件的四点不同：

1. **5 套官方色板的整套预设**：One Dark Pro（Darker 档）、Dracula、Nord、GitHub、Catppuccin；浅色一侧分别是 One Light / Alucard / Nord Light / GitHub Light / Latte。
2. **每个预设覆盖 38 个主题 token**：底色、两级表面、四级文字、四档边框、品牌色、按钮、状态色、滚动条、代码块底 / 条幅 / 行内码、diff 增删，外加 shiki 的语法高亮变量——侧栏、菜单、状态色和代码块会一起换。
3. **字体只列本机已安装的**（Chromium Local Font Access），中英文分两个框选，英文不会被中文字形接管。
4. **有门槛的自动校验**：`npm run check` 核对每个 token 名是否真的存在于安装包里，并对 5 套预设 × 明暗两态逐组检查 WCAG 对比度（正文 7:1、次级 4.5:1、语法色 3:1），另有 54 项冒烟断言。

```
仓库根 = 插件包本体（awesome-dsh-plugin 的 CI 只从根 / packages / plugins / apps 读 package.json）
├─ package.json          dsh.bundle.patch + dsh.client 两半侧的声明，以及开发用 scripts
├─ cordis.patch.yml      组合包层：插入插件行（行 id = 设置命名空间）
├─ index.js              宿主半侧：Config schema + 首屏字体注入
├─ client.js             浏览器半侧：设置页 + token 覆盖层（无构建）
├─ locale/{zh,en}.json   插件卡片的显示名与描述
├─ icon.svg
├─ screenshots.json      插件市场详情页的截图清单
├─ assets/               截图与预览图
└─ tools/                开发工具（零依赖纯 Node）
   ├─ smoke-test.mjs     假 React + 假 ctx，把插件真跑一遍
   ├─ verify.mjs         token 名校验 + 配色对比度校验
   └─ asar.mjs           直接读取 DSH 的 app.asar（排查内部实现用）
```

## 安装

插件是一个**组合包（bundle）**：带 `dsh.bundle.patch` 的 npm 包。两种装法，任选其一。

**A. 界面安装（推荐，免命令行）**

DSH 左侧「Plugins」→「添加插件」，填入本仓库的绝对路径（仓库根就是插件包）：

```
D:\path\to\dsh-appearance
```

**B. 命令行安装**

```sh
# 本地目录
npx -y --package @deepseek-ai/dsh dsh plugin --profile desktop add D:\path\to\dsh-appearance
# 或直接从仓库装
npx -y --package @deepseek-ai/dsh dsh plugin --profile desktop add https://github.com/<owner>/dsh-appearance
```

装完会把这行追加进 profile 的 `dsh.profile.bundles`。**如果设置里没有出现「外观」，重启一次 DSH**（首次挂载新行需要加载新的配置层）。

### 手动 link 安装（无 dsh CLI 时，已实测）

在 `$DSH_HOME/profiles/<profile>/` 下做三件事：

1. `package.json`：`dependencies` 加 `"dsh-appearance": "link:<本仓库绝对路径>"`，`dsh.profile.bundles` 数组追加 `"dsh-appearance"`；
2. `node_modules/dsh-appearance` 建目录联接（junction / symlink）指向**本仓库根**；
3. **在仓库根补一个 peer 链接**：`node_modules/@deepseek-ai/schemastery` → `<profile>/node_modules/@deepseek-ai/schemastery`。
   少了第 3 步会踩坑：目录联接会让 Node 按**真实路径**（本仓库）向上找依赖，而 DSH 的运行时包在 profile 里，宿主半侧的 `import '@deepseek-ai/schemastery'` 会直接 ERR_MODULE_NOT_FOUND。

校验（在 profile 目录里跑，解析链与真实 loader 一致）：

```powershell
node -e "import('dsh-appearance').then(m => console.log(m.name, typeof m.apply, Object.keys(m.Config({}))))"
```

回滚：删掉上面的依赖与 bundles 条目、删掉两个链接即可（安装前请备份 `package.json`）。

到「设置 → 外观」即可使用。

### 里面有哪三块

- **字体**：界面与正文字体（西文 / 中文两个框分开选）、代码字体、正文字号。
- **配色**：配色预设（默认 / **One Dark Pro** / **Dracula** / **Nord** / **GitHub** / **Catppuccin**）+ 强调色、背景色、文字色，浅色与深色各一套。
- **高级**：手动编辑字体栈、导入 / 导出设置、重置全部（默认折叠）。

**覆盖范围**：每个预设都改 **38 个 token**（8 个基础语义 + 30 个外围与代码块），换主题时侧栏、菜单、状态色、代码块会一起换，不会只换一半。

**色板来源**：取各主题官方色值，不做主观发挥——One Dark Pro 深色用 Darker 档（`#23272E`，侧栏 `#1E2227`，正文 `#ABB2BF`，语法色取自扩展自带的 `OneDark-Pro-darker.json`），Dracula / Nord / GitHub Primer / Catppuccin 同理；浅色一侧分别是 One Light / Alucard / Nord Light / GitHub Light / Latte。只有两处最小偏离：主题没公布的第四级灰阶按自身灰阶插值；浅色档里对比度不达标的原版彩色会压暗（例如 Latte 的粉彩）。

**语法高亮**：DSH 的代码块走 shiki 的 CSS 变量主题（`--shiki-token-*`），插件直接覆盖这些变量，所以关键字/字符串/数字/注释都跟着主题走，且不牵连其它组件。组件级材质（菜单/浮层的模糊背板）与终端 ANSI 色不在覆盖范围内。明暗由「设置 → 通用」的外观切换决定，插件不另设开关。

## Config 字段

| 字段 | 默认 | 含义 |
|---|---|---|
| `preset` | `default` | 配色预设 id（`onedark` / `dracula` / `nord` / `github` / `catppuccin`） |
| `uiFont` | `''` | 界面与正文字体栈；空 = 跟随 DSH 默认 |
| `codeFont` | `''` | 代码字体栈；空 = 跟随 DSH 默认 |
| `accentLight` / `accentDark` | `''` | 强调色，按明暗档分别覆盖 |
| `surfaceLight` / `surfaceDark` | `''` | 背景色 |
| `inkLight` / `inkDark` | `''` | 文字色 |

手填值**逐档**合并：只填了深色档时，浅色档保留预设的值。

## 卸载

```sh
npx -y --package @deepseek-ai/dsh dsh plugin --profile desktop remove dsh-appearance
```

或在「Plugins → 已安装」里关掉 / 移除。卸载后本插件写入的 token 覆盖层与首屏样式都会一并回收。

## 开发

无构建步骤：改 `index.js` / `client.js` 直接生效。安装的是 **link 形式的 checkout**，所以改完文件由 HMR 重载；**替换版本号才需要重启**。

```sh
npm test          # 冒烟测试（54 项断言）
npm run verify    # token 名 + 配色对比度
npm run check     # 两个都跑
```

## 设计说明

### 为什么必须有宿主半侧

两件事只有宿主（Node）能做：

1. **设置命名空间**。DSH 的设置命名空间就是 **Loader 行的 id**，客户端插件无法自建。所以持久化必须由宿主半侧导出 `Config`（volatile 字段），浏览器半侧才能用 `ctx.configForms.get('dsh-appearance')` 读写。
2. **首屏注入**。`webserver/index-inject` 是宿主侧的扩展点；客户端 CSS 要等 JS 模块图加载完才到。没有这一步，每次刷新都会先看到默认字体、再跳成用户选的字体。

### 数据流

```
用户改动
  └─> ctx.configForms.get('dsh-appearance').set/unset
        └─> Host 校验 + 写入 profile 的 cordis.patch.yml（volatile 字段，带 revision）
              └─> 快照回流（subscribe）
                    ├─> 宿主：下次渲染 index 时把字体写进 <head>（首屏即正确）
                    └─> 客户端：ctx.theme.overrideTokens('dsh-appearance', {...})
                          └─> ui-layout 把 token 写成 body 内联样式，即时生效
```

### 三个关键取舍

| 决策 | 原因 |
|---|---|
| 字体/颜色统一走 `ctx.theme.overrideTokens` | 官方给第三方留的主题扩展点：自带明暗双态、可撤销、随 HMR / 禁用自动回收。自己写 CSS 变量会和 ui-theme 的样式表打级联架。 |
| 首屏样式用 `html:root` 而不是 `:root` | 该行被插在 `<head>` 最前面，而 ui-theme 的 base.css 也是 `:root`。`html:root` 特异度更高（0,1,1 > 0,1,0），才能在样式表加载后继续生效；插件加载后由 ui-layout 的 body 内联样式接管，两者不冲突。 |
| 字号直接复用 `ctx.theme.setFontSize` | `--dsh-content-font-size` 由 ui-layout 在**每次**主题快照时重写，插件自己设会被冲掉；而且组件高度是按该轴的阶梯（`calc(33px + var(--dsh-content-font-delta))`）推导的，绕过去会错位。 |

### 已知边界（v1 有意不做）

- **终端字体**：xterm 面板硬编码 `fontSize: 13` 与自己的字体名，并按自测字符宽度算 cols/rows；纯 CSS 改字体会让终端网格错位。
- **UI 全局字号**：组件高度由字号轴阶梯推导，整体缩放会错位；只做官方支持的对话字号（10–22 px）。
- **自带字体文件**：v1 只用系统已装字体 + 精选字体栈（零文件、零许可风险）。字体包与 `@font-face` 放在后续版本。
- **配色不做首屏注入**：配色是明暗双态的，需要把预设表同时给到两半侧；v1 只在插件加载后即时应用（会有极短的默认配色过渡）。

## 字体与许可

- 插件**不打包任何字体文件**，只是把字体栈字符串交给浏览器；找不到就回退，不会报错。
- 想自带字体（后续版本）时只收 OFL 授权的字体，并随包附带许可证——DSH 自己就是这么做的（`montserrat-*.woff2` 旁边就是 `Montserrat-OFL.txt`）。
- **不要**打包 SF Pro / SF Mono、Segoe UI、苹方、微软雅黑等系统字体：再分发属于侵权。把它们的名字写进 fallback 栈没问题，带文件不行。

## 路线

- **v0.2**：配色首屏注入（预设表下沉为两半侧共享的数据文件）、更多预设。
- **v0.3**：导入 Codex 的 `codex-theme-v1:` 主题串（字段映射到 `--dsw-*` token）。
- **v0.4**：自带字体（`@font-face` + 同源路由 + preload + `font-display: block` + 度量覆盖，避免会话滚动锚点抖动）。

## 许可

MIT。
