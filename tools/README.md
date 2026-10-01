# 开发工具

五个脚本，都是零依赖的纯 Node（>= 20）；仓库根就是插件包，命令都在仓库根跑。

| 脚本 | 作用 |
|---|---|
| `smoke-test.mjs` | 用**假 React + 假 ctx** 把插件真跑一遍：宿主半侧首屏 CSS、模块注册契约、apply 装配、配置变化重放覆盖层、设置页渲染、本机字体枚举、导入导出、候选去重、旧预设 id 兜底。不需要浏览器，也不需要装进 DSH。 |
| `verify.mjs` | 静态校验：① 插件用到的每个 `--dsw-*` / `--ds-*` / `--shiki-*` token 都能在安装包的 ui-theme 里找到；② 5 套预设 × 明暗两态 × 17 组 WCAG 对比度（正文 7:1、次级 4.5:1、说明文字 3:1、代码块前景 4.5:1、语法色 3:1）；③ 预设解析条数护栏（格式漂移时不会静默跳过）。 |
| `gen-presets.cjs` | 加主题/改色用：改里面的色板（只写官方色号），跑它打印 42 个 token 的字面量并自检对比度，贴回 `client.js` 的 `PRESETS`。`--json <路径>` 导出 JSON。 |
| `check-commit-msg.mjs` | Angular 提交规范校验，由 `commit-msg` 钩子调用。 |
| `install-hooks.mjs` | 安装 git 钩子（新克隆的仓库跑一次）。 |
| `asar.mjs` | DSH 的实现全部打包在 `app.asar` 里，这个脚本能直接读：`node tools/asar.mjs <asar> ls <正则> | cat <路径> | grep <正则> <路径正则>`。 |

用法：

```sh
npm test          # 冒烟测试
npm run verify    # token + 对比度校验
npm run check     # 两个都跑
npm run hooks:install
node tools/gen-presets.cjs   # 改完色板后重新生成预设字面量
```

`verify.mjs` 需要 DSH 的 `app.asar` 才能核对 token 名：默认读 `D:/SoftwareOfStudy/DS_H/resources/app.asar`，
换机器时用第二个参数或环境变量 `DSH_ASAR` 指定；**找不到会直接失败**，不会静默跳过校验。
