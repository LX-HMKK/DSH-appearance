# dsh-appearance

给 DeepSeek Harness 桌面端 / Web 端加一组**外观设置**：更多字体、配色预设、强调色与文字色。

全部效果都走官方主题 token（`--dsw-*` / `--ds-*`），不注入补丁、不修改 DSH 源码、不打包任何字体或第三方依赖。

```
.
├─ dsh-appearance/          插件包本体（可直接作为 bundle 安装）
│  ├─ package.json          dsh.bundle.patch + dsh.client 两半侧的声明
│  ├─ cordis.patch.yml      组合包层：插入插件行（行 id = 设置命名空间）
│  ├─ index.js              宿主半侧：Config schema + 首屏字体注入
│  ├─ client.js             浏览器半侧：设置页 + token 覆盖层（无构建）
│  ├─ locale/{zh,en}.json   插件卡片的显示名与描述
│  └─ icon.svg
└─ tools/                   开发工具（零依赖纯 Node）
   ├─ smoke-test.mjs        假 React + 假 ctx，把插件真跑一遍
   ├─ verify.mjs            token 名校验 + 配色对比度校验
   └─ asar.mjs              直接读取 DSH 的 app.asar（排查内部实现用）
```

## 安装

插件是一个**组合包（bundle）**：带 `dsh.bundle.patch` 的 npm 包。两种装法，任选其一。

**A. 界面安装（推荐，免命令行）**

DSH 左侧「Plugins」→「添加插件」，填入本目录的绝对路径：

```
D:\StudyWorks\4.1\DSH_WS\dsh-appearance
```

**B. 命令行安装**

```sh
npx -y --package @deepseek-ai/dsh dsh plugin --profile desktop add D:\StudyWorks\4.1\DSH_WS\dsh-appearance
```

装完会把这行追加进 profile 的 `dsh.profile.bundles`。**如果设置里没有出现「外观」，重启一次 DSH**（首次挂载新行需要加载新的配置层）。

到「设置 → 外观」即可使用。

## 开发

无构建步骤：改 `index.js` / `client.js` 直接生效。安装的是 **link 形式的 checkout**，所以改完文件由 HMR 重载；**替换版本号才需要重启**。

```sh
npm test          # 冒烟测试（25 项断言）
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
