# AGENTS.md

给在本仓库工作的 AI / 协作者的说明书。**动手前先读这一页**，尤其是"硬约束"和"提交规范"两节。

## 这是什么

`dsh-appearance` —— DeepSeek Harness（DSH）桌面端 / Web 端的外观增强插件：更多字体、配色预设、强调色与文字色。

全部效果都通过官方主题 token（`--dsw-*` / `--ds-*`）实现：**不修改 DSH 源码、不打包字体文件、零运行时依赖、零构建步骤**。

## 目录

```
仓库根 = 插件包本体（bundle：带 dsh.bundle.patch 的 npm 包）。
**根就是包**是刻意为之：awesome-dsh-plugin 的 CI 只从根 / packages / plugins / apps
读 package.json，放在自建子目录里会被判为「没有 bundle 清单」。

package.json             两半侧声明（dsh.bundle.patch + dsh.client）+ 开发 scripts
cordis.patch.yml         组合包层：insert 一行（行 id = 设置命名空间）
index.js                 宿主半侧：Config(volatile) + webserver/index-inject 首屏注入
client.js                浏览器半侧：lazy-CJS factory + 设置页 + token 覆盖层
locale/{zh,en}.json      插件管理卡片的显示名/描述
screenshots.json         插件市场详情页的截图清单（相对路径，指向 assets/）
assets/                  截图与配色预览图
tools/                   零依赖开发工具
  smoke-test.mjs         假 React + 假 ctx，把插件真跑一遍
  verify.mjs             token 名校验 + 配色对比度校验
  check-commit-msg.mjs   Angular 提交规范校验（commit-msg 钩子调用）
  install-hooks.mjs      安装 git 钩子
  asar.mjs               读取 DSH 的 app.asar（排查 DSH 内部实现）
```

## 常用命令

```sh
npm run check            # = test + verify，提交前必跑
npm test                 # 冒烟测试（51 项断言）
npm run verify           # token 名 + WCAG 对比度
npm run hooks:install    # 安装 commit-msg 钩子（新克隆的仓库跑一次）
```

安装到 DSH（开发时用 link 形式）：

```sh
npx -y --package @deepseek-ai/dsh dsh plugin --profile desktop add <本仓库绝对路径>
```

没有 `dsh` CLI 时见 README「手动 link 安装」——**务必别漏掉仓库根里的
`node_modules/@deepseek-ai/schemastery` peer 链接**，否则宿主半侧会 ERR_MODULE_NOT_FOUND。
另外：桌面端不会因 profile 文件变化而热重载，装完要重启应用才会出现「外观」页。

## 硬约束（改代码前必须知道）

1. **宿主半侧不可省**。两个理由：① 设置命名空间 = Loader 行 id，客户端插件无法自建，持久化必须由宿主侧 `Config`（`.volatile()`）提供；② `webserver/index-inject` 只有宿主侧能订阅，没有它刷新时字体会先闪一下。
2. **客户端入口是 lazy-CJS factory，不是 ESM**：`window.__ModuleLoader__.load({ id: '<包名>', factory })`；`id` 必须等于包名；工厂里用 `require('react')`；`inject` 数组写的是 **cordis 服务名**（`slots`/`locale`/`theme`/`configForms`），而 `package.json` 里 `dsh.client.inject` 写的是**包名**（加载顺序）。
3. **不要 `require` 任何 DSH 客户端包**（含 `dsh-client-ui-primitives`）：官方明确要求，它们随时会变，且组件抛错会让整个插槽空白。样式只用 `--dsw-alias-*` 等语义 token。
4. **颜色只能来自 token**，不要写死颜色值；新增/修改 token 后必须跑 `npm run verify`（它会拿安装包里的 ui-theme 逐个核对 token 名是否存在）。
5. **一切都要注册进 `ctx.effect` 并返回清理函数**，否则 HMR / 禁用插件会留下残留（监听器、样式、订阅）。
6. **字体与颜色统一走 `ctx.theme.overrideTokens(source, { token: { light, dark } })`**：值必须是成对字符串（传裸字符串会抛错）；同 source 再次调用即整层替换。不要去和 ui-theme 的样式表抢级联。
7. **字号只走 `ctx.theme.setFontSize(10..22)`**：`--dsh-content-font-size` 由 ui-layout 在每次主题快照时重写，自己设会被冲掉，且组件高度按该轴阶梯推导。
8. **首屏样式的选择器用 `html:root`**（特异度 0,1,1），不要用 `:root`（0,1,0）：注入行位于 `<head>` 最前面，只有特异度更高才能在 base.css 之后继续生效。
9. **`peerDependencies` 只声明 `@deepseek-ai/cordis`**：DSH 会在安装前校验每一个已声明的 `@deepseek-ai/dsh-*` 版本范围，写多了会直接装不上。
10. **配色预设必须用主题官方色值**，不要凭感觉配：五套预设分别取自 One Dark Pro（Darker 档，色值在 `~/.vscode/extensions/zhuangtongfa.material-theme*/themes/OneDark-Pro-darker.json`）、Dracula / Alucard、Nord、GitHub Primer、Catppuccin Mocha / Latte。只有主题未公布的灰阶才允许按自身灰阶插值，浅色档对比度不足的原版彩色可以压暗，二者都要在 README 里说明；改完必须跑 `npm run check`（38 个 token 的对比度门槛在 `tools/verify.mjs`）。

## 提交规范

**Angular 提交规范 + 中文描述**，由 `commit-msg` 钩子强制校验。

```
<type>(<scope>): <中文简述>

<可选正文：说明为什么这么改，每行不超过 100 字符>

<可选 footer：BREAKING CHANGE / 关联 issue>
```

- **type**（必填，小写）：`build` `ci` `docs` `feat` `fix` `perf` `refactor` `revert` `style` `test` `chore`
- **scope**（可选，小写）：本仓库用 `appearance`（插件本体）、`tools`（开发工具）、`repo`（仓库级配置/文档）
- **subject**（必填）：**必须包含中文**，不加句号，整行不超过 100 字符
- 破坏性变更：`feat(appearance)!: ...`，并在 footer 写 `BREAKING CHANGE: ...`
- 允许放行：`Merge ...` / `Revert ...` / `fixup!` / `squash!`

示例：

```
feat(appearance): 新增配色预设与强调色取色器
fix(appearance): 修正覆盖层滞后一帧的问题

覆盖层原先读的是 store 缓存，缓存要等 refresh 之后才是新值，
导致改完第一次不生效。改为直接读宿主快照。

test(tools): 冒烟测试补上宿主半侧首屏 CSS 用例
docs(repo): 补充字体许可说明
```

新克隆仓库后先跑一次 `npm run hooks:install` 安装钩子（钩子不在版本控制里）。紧急情况可 `git commit --no-verify` 跳过。

## 已知边界（不要顺手"修"）

- **终端（xterm）字体**：面板硬编码字号与字体名，并按自测字符宽度算 cols/rows；纯 CSS 改字体会让网格错位。
- **UI 全局字号**：组件高度由 `calc(... + var(--dsh-content-font-delta))` 阶梯推导，整体缩放会错位。
- **自带字体文件**：只允许 OFL 授权字体并随包附许可证；**禁止**打包 SF Pro / Segoe UI / 苹方 / 微软雅黑等系统字体。
- **配色首屏注入**：预设表目前只在 `client.js` 里，宿主注入不了，所以加载瞬间有一帧默认配色。要修就得把预设下沉成两半侧共享的数据文件。

## 发布注意

- 改动插件代码后，link 安装的 checkout 由 HMR 自动重载；**替换版本号必须重启 DSH**。
- 改 `cordis.patch.yml` 的行 id 等于改设置命名空间，会丢用户已保存的配置。
