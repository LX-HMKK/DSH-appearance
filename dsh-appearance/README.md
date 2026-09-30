# dsh-appearance

更多字体、配色与字号选择，全部走官方主题 token。

在「设置 → 外观」里可以：

- 选 **界面与正文字体**（系统无衬线 / Inter / 思源黑体 / 霞鹜文楷 / 宋体 / 圆体），或直接手写任意已安装字体的字体栈；
- 选 **代码字体**（JetBrains Mono / Cascadia Code / Fira Code / 更纱黑体等）；
- 调 **正文字号**（10–22 px，与「设置 → 通用」同一个值）；
- 选 **配色预设**（石墨 / 深海 / 暖沙 / 森绿 / 高对比），并单独覆盖 **强调色、背景色、文字色**（浅色与深色分开设置）；
- **导入 / 导出**整套设置（`dsh-appearance-v1:{...}`，可备份可分享）。

所有改动即时生效，并持久化在本机 profile 的 `cordis.patch.yml` 里。

## 结构

| 文件 | 作用 |
|---|---|
| `index.js` | 宿主半侧：导出 `Config`（volatile 字段 = 可编辑项），并在服务端渲染 index 时注入首屏字体样式 |
| `client.js` | 浏览器半侧：一个 lazy-CJS factory，注册设置页并把配置翻译成 token 覆盖层 |
| `cordis.patch.yml` | 组合包层，插入 `id: dsh-appearance` 这一行（该 id 同时是设置命名空间） |
| `locale/*.json` | 插件管理卡片上的显示名与描述 |

## Config 字段

| 字段 | 默认 | 含义 |
|---|---|---|
| `preset` | `default` | 配色预设 id |
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

或在「Plugins → 已安装」里关掉/移除。卸载后本插件写入的 token 覆盖层与首屏样式都会一并回收。
