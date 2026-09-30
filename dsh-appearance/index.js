/**
 * dsh-appearance —— 宿主（Node）半侧
 *
 * 只做两件事：
 *  1. 声明可编辑的 Config。volatile 字段可被设置页读写，并持久化进
 *     profile 的 cordis.patch.yml；命名空间就是本插件的 Loader 行 id。
 *  2. 在服务端渲染 index 时注入一行首屏样式，让用户选的字体在**第一次绘制**
 *     就生效（否则要等浏览器半侧加载完，会看到字体闪一下）。
 */
import Schema from '@deepseek-ai/schemastery'

export const name = 'dsh-appearance'

/**
 * 全部字段都是 volatile：只有 volatile 字段才会进入设置表单并可被用户修改。
 * 空字符串表示"不使用本插件的覆盖，跟随 DSH 默认"。
 */
export const Config = Schema.object({
  /** 配色预设 id（client.js 的 PRESETS 表） */
  preset: Schema.string().default('default').volatile(),
  /** UI/正文 字体栈 */
  uiFont: Schema.string().default('').volatile(),
  /** 代码/等宽 字体栈 */
  codeFont: Schema.string().default('').volatile(),
  /** 强调色（浅色模式） */
  accentLight: Schema.string().default('').volatile(),
  /** 强调色（深色模式） */
  accentDark: Schema.string().default('').volatile(),
  /** 背景色（浅色模式） */
  surfaceLight: Schema.string().default('').volatile(),
  /** 背景色（深色模式） */
  surfaceDark: Schema.string().default('').volatile(),
  /** 文字色（浅色模式） */
  inkLight: Schema.string().default('').volatile(),
  /** 文字色（深色模式） */
  inkDark: Schema.string().default('').volatile(),
})

/** volatile 字段在宿主侧是引用对象，用 .get() 读快照；非 volatile 直接是值。 */
function readField(value) {
  if (value && typeof value.get === 'function') {
    try {
      return value.get()
    } catch {
      return undefined
    }
  }
  return value
}

/**
 * 生成首屏字体样式。
 *
 * 选择器用 `html:root`（特异度 0,1,1）而不是 `:root`（0,1,0）：
 * ui-theme 的 base.css 也是 :root，而本行样式被插在 <head> 最前面，
 * 靠特异度胜出才能在样式表加载后继续生效。
 * 插件加载完成后，ui-layout 会把 token 写成 body 的内联样式（优先级更高），
 * 由它接管，二者不会互相打架。
 */
export function bootFontCss(config) {
  const uiFont = String(readField(config?.uiFont) ?? '').trim()
  const codeFont = String(readField(config?.codeFont) ?? '').trim()
  const declarations = []
  if (uiFont) declarations.push('--dsw-font-family:' + uiFont)
  if (codeFont) declarations.push('--ds-font-family-code:' + codeFont)
  if (declarations.length === 0) return ''
  return 'html:root{' + declarations.join(';') + '}'
}

export function apply(ctx, config) {
  // 本插件自带设置页，关掉自动表单，避免同一批字段在"内置插件"里渲染两遍。
  //（该策略只影响表单生成，不影响读写。）
  ctx.inject(['settings'], (child) => {
    child.effect(
      () => child.settings.configure({ auto: false }, ctx.fiber),
      'dsh-appearance: settings page policy',
    )
  })

  ctx.on(
    'webserver/index-inject',
    (table) => {
      const css = bootFontCss(config)
      if (css) table.push({ kind: 'style', placement: 'head', text: css })
    },
    { prepend: true },
  )
}
