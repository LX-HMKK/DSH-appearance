# 开发工具

三个脚本，都是零依赖的纯 Node（>= 20）。

| 脚本 | 作用 |
|---|---|
| `smoke-test.mjs` | 用**假 React + 假 ctx** 把插件真跑一遍：宿主半侧的首屏 CSS、模块注册契约、apply 装配、配置变化重放覆盖层、设置页渲染、导入导出。不需要浏览器，也不需要装进 DSH。 |
| `verify.mjs` | 静态校验：① 插件用到的每一个 `--dsw-*` / `--ds-*` token 都能在安装包的 ui-theme 里找到（防止写错 token 名）；② 6 套配色预设的 WCAG 对比度（正文 7:1、次级文字 4.5:1、强调色 3:1）。 |
| `asar.mjs` | DSH 的实现全部打包在 `app.asar` 里，这个脚本能直接读取：`node tools/asar.mjs <asar> ls <正则> | cat <路径> | grep <正则> <路径正则>`。 |

用法：

```sh
npm test          # 冒烟测试
npm run verify    # token + 对比度校验
npm run check     # 两个都跑
```

`verify.mjs` 默认读取 `D:/SoftwareOfStudy/DS_H/resources/app.asar`，也可以用第二个参数指定别的安装路径。
