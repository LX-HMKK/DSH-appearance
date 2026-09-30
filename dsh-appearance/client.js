/**
 * dsh-appearance —— 浏览器半侧（客户端模块系统要求的 lazy-CJS factory，无构建）
 *
 * 数据流：
 *   用户的每一次改动 -> ctx.configForms.get('dsh-appearance').set/unset
 *                    -> Host 校验并写进 profile 的 cordis.patch.yml（volatile 字段）
 *                    -> 快照回流 -> 我们重放一层 token 覆盖（ctx.theme.overrideTokens）
 *                    -> ui-layout 把 token 写成 body 内联样式
 *
 * 为什么用 overrideTokens 而不是自己写 CSS 变量：
 *   它是官方给第三方留的主题扩展点，天然明暗双态、可撤销、随 HMR/禁用自动回收。
 */
window.__ModuleLoader__.load({
  id: 'dsh-appearance',
  factory(require) {
    'use strict'
    const React = require('react')
    const h = React.createElement
    const { useEffect, useRef, useState, useSyncExternalStore } = React

    /** = profile 里的 Loader 行 id = 设置命名空间 */
    const ENTRY_ID = 'dsh-appearance'
    /** 覆盖层的 source 标识：同名再调用即"整层替换并置顶" */
    const OVERRIDE_SOURCE = 'dsh-appearance'
    const LOCALE_NS = 'appearance'
    const FONT_SIZE_MIN = 10
    const FONT_SIZE_MAX = 22
    const EXPORT_PREFIX = 'dsh-appearance-v1:'

    /** 与宿主 Config 的字段一一对应 */
    const FIELDS = [
      'preset', 'uiFont', 'codeFont',
      'accentLight', 'accentDark',
      'surfaceLight', 'surfaceDark',
      'inkLight', 'inkDark',
    ]

    /** 预设字段 -> 官方 token 名 */
    const TOKEN = {
      accent: '--dsw-alias-state-business-primary',
      link: '--dsw-alias-link',
      base: '--dsw-alias-bg-base',
      layer1: '--dsw-alias-bg-layer-1',
      layer2: '--dsw-alias-bg-layer-2',
      ink: '--dsw-alias-label-primary',
      secondary: '--dsw-alias-label-secondary',
      border: '--dsw-alias-border-l2',
    }

    /** 找不到字形时兜底的字体栈；用户选的家族一律挂在它前面 */
    const UI_FALLBACK = '-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Helvetica Neue", Arial, sans-serif'
    const CODE_FALLBACK = '"SF Mono", "JetBrains Mono", "Fira Code", Consolas, "Liberation Mono", Menlo, Courier, "PingFang SC", "Microsoft YaHei"'

    /**
     * 字体选项 = 「家族名 + 内部拼好的栈」。
     * 用户只看到 family，字体栈是插件自己拼的实现细节（高级里仍可手写）。
     */
    const UI_FONTS = [
      // 推荐
      { key: 'font.follow', family: '', stack: '', group: 'fontGroup.recommended' },
      { key: 'font.system', family: '', stack: UI_FALLBACK, group: 'fontGroup.recommended' },
      // 中文黑体
      { key: 'font.noto', family: 'Noto Sans SC', group: 'fontGroup.cjkSans', script: 'cjk', pick: true },
      { key: 'font.harmony', family: 'HarmonyOS Sans SC', group: 'fontGroup.cjkSans', script: 'cjk', pick: true },
      { key: 'font.misans', family: 'MiSans', group: 'fontGroup.cjkSans', script: 'cjk' },
      { key: 'font.puhuiti', family: 'Alibaba PuHuiTi 3.0', group: 'fontGroup.cjkSans', script: 'cjk' },
      { key: 'font.pingfang', family: 'PingFang SC', group: 'fontGroup.cjkSans', script: 'cjk', pick: true },
      { key: 'font.yahei', family: 'Microsoft YaHei', group: 'fontGroup.cjkSans', script: 'cjk', pick: true },
      { key: 'font.sarasaGothic', family: 'Sarasa Gothic SC', group: 'fontGroup.cjkSans', script: 'cjk' },
      // 中文宋楷
      { key: 'font.notoSerif', family: 'Noto Serif SC', group: 'fontGroup.cjkSerif', script: 'cjk', pick: true },
      { key: 'font.lxgw', family: 'LXGW WenKai', group: 'fontGroup.cjkSerif', script: 'cjk', pick: true },
      { key: 'font.lxgwScreen', family: 'LXGW WenKai Screen', group: 'fontGroup.cjkSerif', script: 'cjk' },
      { key: 'font.serif', family: 'Songti SC', group: 'fontGroup.cjkSerif', script: 'cjk' },
      { key: 'font.simsun', family: 'SimSun', group: 'fontGroup.cjkSerif', script: 'cjk' },
      { key: 'font.kaiti', family: 'Kaiti SC', group: 'fontGroup.cjkSerif', script: 'cjk' },
      // 西文无衬线
      { family: 'Cascadia Mono', group: 'fontGroup.latinSans', pick: true },
      { family: 'Inter', group: 'fontGroup.latinSans', pick: true },
      { family: 'Roboto', group: 'fontGroup.latinSans' },
      { family: 'Open Sans', group: 'fontGroup.latinSans' },
      { family: 'Lato', group: 'fontGroup.latinSans' },
      { family: 'Poppins', group: 'fontGroup.latinSans' },
      { family: 'Montserrat', group: 'fontGroup.latinSans' },
      { family: 'Nunito', group: 'fontGroup.latinSans' },
      { family: 'Work Sans', group: 'fontGroup.latinSans' },
      { family: 'IBM Plex Sans', group: 'fontGroup.latinSans' },
      { family: 'Source Sans 3', group: 'fontGroup.latinSans' },
      { family: 'Manrope', group: 'fontGroup.latinSans' },
      { family: 'DM Sans', group: 'fontGroup.latinSans' },
      { family: 'Plus Jakarta Sans', group: 'fontGroup.latinSans' },
      { family: 'Outfit', group: 'fontGroup.latinSans' },
      { family: 'Figtree', group: 'fontGroup.latinSans' },
      { family: 'Mulish', group: 'fontGroup.latinSans' },
      // 西文衬线
      { family: 'Playfair Display', group: 'fontGroup.latinSerif' },
      { family: 'Merriweather', group: 'fontGroup.latinSerif' },
      { family: 'Lora', group: 'fontGroup.latinSerif' },
      { family: 'Source Serif 4', group: 'fontGroup.latinSerif' },
      { family: 'EB Garamond', group: 'fontGroup.latinSerif' },
      { family: 'Libre Baskerville', group: 'fontGroup.latinSerif' },
      { family: 'Crimson Pro', group: 'fontGroup.latinSerif' },
      { family: 'Noto Serif', group: 'fontGroup.latinSerif' },
      // 展示与圆体
      { key: 'font.smiley', family: 'Smiley Sans', group: 'fontGroup.display', script: 'cjk', pick: true },
      { key: 'font.rounded', family: 'Yuanti SC', group: 'fontGroup.display', script: 'cjk' },
      { key: 'font.youyuan', family: 'YouYuan', group: 'fontGroup.display', script: 'cjk' },
      { family: 'Quicksand', group: 'fontGroup.display' },
      { family: 'Comfortaa', group: 'fontGroup.display' },
      { family: 'Varela Round', group: 'fontGroup.display' },
      { family: 'Baloo 2', group: 'fontGroup.display' },
      { family: 'Fredoka', group: 'fontGroup.display' },
    ]

    const CODE_FONTS = [
      { key: 'code.follow', family: '', stack: '', group: 'fontGroup.recommended' },
      { key: 'code.default', family: '', stack: CODE_FALLBACK, group: 'fontGroup.recommended' },
      { family: 'JetBrains Mono', group: 'fontGroup.mono', pick: true },
      { family: 'Fira Code', group: 'fontGroup.mono', pick: true },
      { family: 'Cascadia Code', group: 'fontGroup.mono', pick: true },
      { family: 'Cascadia Mono', group: 'fontGroup.mono' },
      { family: 'Source Code Pro', group: 'fontGroup.mono' },
      { family: 'IBM Plex Mono', group: 'fontGroup.mono' },
      { family: 'Roboto Mono', group: 'fontGroup.mono' },
      { family: 'Victor Mono', group: 'fontGroup.mono' },
      { family: 'Iosevka', group: 'fontGroup.mono' },
      { family: 'Maple Mono', group: 'fontGroup.mono' },
      { family: 'Recursive Mono', group: 'fontGroup.mono' },
      { family: 'Inconsolata', group: 'fontGroup.mono' },
      { family: 'Hack', group: 'fontGroup.mono' },
      { family: 'Ubuntu Mono', group: 'fontGroup.mono' },
      { family: 'Noto Sans Mono', group: 'fontGroup.mono' },
      { key: 'code.sarasa', family: 'Sarasa Mono SC', group: 'fontGroup.mono', pick: true },
      { family: 'Menlo', group: 'fontGroup.mono' },
      { family: 'Consolas', group: 'fontGroup.mono', pick: true },
      { family: 'SF Mono', group: 'fontGroup.mono' },
    ]

    /**
     * 猜一个家族是不是中文字体（用于把"本机已安装"再分成中/西文两组）。
     * 名字里带汉字，或命中常见中文字体命名规律，就算中文。
     */
    function isCjkFamily(name) {
      if (/[\u3400-\u4dbf\u4e00-\u9fff]/.test(name)) return true
      return /(hei|song|kai|ming|yahei|pingfang|hiragino|source han|sarasa|wenkai|misans|harmonyos|puhuiti|simsun|simhei|fangsong|yuanti|youyuan|dengxian|jhenghei|meiryo|malgun|noto sans (sc|tc|jp|kr)|noto serif (sc|tc|jp|kr)|source han (sans|serif))/i.test(name)
    }

    /** 通用族名（不是真字体），拆栈时要跳过 */
    const GENERIC_FAMILIES = /^(sans-serif|serif|monospace|system-ui|ui-sans-serif|ui-serif|ui-monospace|-apple-system|blinkmacsystemfont|inherit|emoji|math)$/i

    function cleanFamily(part) {
      return String(part || '').trim().replace(/^["']|["']$/g, '').trim()
    }

    /** 取字体栈里的第一个家族名（对比"当前值"、判断家族是否已列出都用它） */
    function headFamily(stack) {
      return cleanFamily(String(stack || '').split(',')[0])
    }

    /** 把一条已有的字体栈拆成"英文字体 + 中文字体"两个家族名 */
    function splitStack(stack) {
      const parts = String(stack || '').split(',').map(cleanFamily).filter(function (part) {
        return part && !GENERIC_FAMILIES.test(part)
      })
      const result = { latin: '', cjk: '' }
      for (const part of parts) {
        if (isCjkFamily(part)) { if (!result.cjk) result.cjk = part }
        else if (!result.latin) result.latin = part
      }
      return result
    }

    /**
     * 合成界面字体栈：**英文字体在前、中文字体在后**。
     * 顺序很关键——中文字体基本都自带西文字形，若排在前面，英文也会用中文字体渲染。
     * 两者都为空则返回空串（= 跟随 DSH 默认）。
     */
    function composeUiStack(latin, cjk) {
      const parts = []
      if (latin) parts.push('"' + cleanFamily(latin).replace(/"/g, '') + '"')
      if (cjk) parts.push('"' + cleanFamily(cjk).replace(/"/g, '') + '"')
      if (parts.length === 0) return ''
      parts.push(UI_FALLBACK)
      return parts.join(', ')
    }

    /** 把家族名安全地拼成字体栈（引号、逗号等一律清洗掉） */
    function stackOf(family, fallback) {
      const clean = String(family || '').replace(/["']/g, '').trim()
      if (!clean) return fallback
      return '"' + clean + '", ' + fallback
    }

    /** 本机字体枚举（Chromium 的 Local Font Access）：惰性、失败即静默降级 */
    const localFonts = { status: 'idle', families: [] }

    /** 家族名（小写）-> 精选条目，用来给本机字体配上中文名与字形归类 */
    function curatedIndex(kind) {
      const list = kind === 'code' ? CODE_FONTS : UI_FONTS
      const index = {}
      for (const item of list) if (item.family) index[item.family.toLowerCase()] = item
      return index
    }

    /** 状态：跟随默认 / 系统默认 这两条与是否读到本机字体无关，永远在最上面 */
    function baseFontOptions(kind, t) {
      const list = kind === 'code' ? CODE_FONTS : UI_FONTS
      return list.filter(function (item) { return item.family === '' }).map(function (item) {
        return { id: item.key, label: t(item.key), family: '', stack: item.stack, groupKey: item.group, script: 'latin' }
      })
    }

    /**
     * 组装选择器的选项。
     *
     * 原则：**只列本机真实存在的字体**——列出来的每一个都真的能用，不再拿"名字"
     * 充当选项（没装的字体渲染出来和默认一模一样，只会让人误判）。
     * 精选表只做三件事：给已知家族配中文名与字形归类、读不到本机字体时兜底、
     * 以及在面板底部提示"这些推荐的没装"。
     */
    function fontOptions(kind, t, currentValue, filter) {
      const mode = filter || 'all'
      /** 拆开选（中文/英文各一个框）时，选项的值是"家族名"，整条栈由插件合成 */
      const pair = mode === 'latin' || mode === 'cjk'
      const fallback = kind === 'code' ? CODE_FALLBACK : UI_FALLBACK
      const curated = kind === 'code' ? CODE_FONTS : UI_FONTS
      const index = curatedIndex(kind)
      const base = pair
        ? [{ id: 'none:' + mode, label: t('font.notSet'), family: '', stack: '', preview: 'inherit', script: mode, groupKey: 'fontGroup.recommended' }]
        : baseFontOptions(kind, t)
      const picks = base.slice()
      const all = base.slice()
      const missing = []

      const familyEntry = function (family) {
        const known = index[family.toLowerCase()]
        const cjk = known ? known.script === 'cjk' : isCjkFamily(family)
        return {
          id: 'family:' + family,
          // 注意 known.key 可能不存在（西文字体只用家族名作标签），不能直接 t(known.key)
          label: known && known.key ? t(known.key) : family,
          family: family,
          stack: pair ? family : stackOf(family, fallback),
          preview: stackOf(family, fallback),
          groupKey: cjk ? 'fontGroup.localCjk' : 'fontGroup.localLatin',
          script: cjk ? 'cjk' : 'latin',
        }
      }
      const keep = function (script) { return !pair || script === mode }
      const pushTo = function (list, option) {
        if (!list.some(function (item) { return item.id === option.id })) list.push(option)
      }
      /**
       * 同一家族只留第一行。候选有三个来源（精选表、本机枚举、当前值），
       * 它们指向同一个家族时必须合并，否则下拉里会出现两行同名。
       */
      const dedupe = function (list) {
        const seen = {}
        const out = []
        for (const option of list) {
          const key = option.family ? 'family:' + option.family.trim().toLowerCase() : 'id:' + option.id
          if (seen[key]) continue
          seen[key] = true
          out.push(option)
        }
        return out
      }

      if (localFonts.status === 'ready') {
        const installed = {}
        for (const family of localFonts.families) installed[family.toLowerCase()] = family
        // 默认短名单：精选表里标了 pick、本机确实装了、且字形与当前框匹配
        for (const item of curated) {
          if (!item.family || !item.pick) continue
          const actual = installed[item.family.toLowerCase()]
          if (!actual || !keep(item.script === 'cjk' ? 'cjk' : 'latin')) continue
          pushTo(picks, familyEntry(actual))
        }
        // 「全部」：本机装了什么就列什么
        for (const family of localFonts.families) {
          if (!keep(isCjkFamily(family) ? 'cjk' : 'latin')) continue
          pushTo(all, familyEntry(family))
        }
        // 推荐但没装：只提示 pick 的那几个，不要一次抛五十个名字
        for (const item of curated) {
          if (!item.family || !item.pick || !item.key) continue
          if (!keep(item.script === 'cjk' ? 'cjk' : 'latin')) continue
          if (!installed[item.family.toLowerCase()]) missing.push(t(item.key))
        }
      } else if (localFonts.status === 'unavailable') {
        // 读不到本机字体（无此 API 或权限被拒）：退回精选表，并在面板上说明
        for (const item of curated) {
          if (!item.family) continue
          if (!keep(item.script === 'cjk' ? 'cjk' : 'latin')) continue
          pushTo(all, familyEntry(item.family))
        }
        for (const option of all.slice()) pushTo(picks, option)
      }

      // 当前选中的字体必须始终可见（导入的配置、或枚举不到的家族）。
      // 判重只能按**家族名**：等宽选项的栈里带着整条兜底链，拿整条栈跟家族名比永远
      // 不相等，于是同一个家族会被追加第二行——用户看到的就是"两行 Consolas + 两个勾"。
      if (currentValue) {
        const value = pair ? currentValue : headFamily(currentValue)
        const lower = String(value).trim().toLowerCase()
        const present = all.some(function (option) {
          return (option.family && option.family.trim().toLowerCase() === lower) ||
            String(option.stack || '').toLowerCase() === lower
        })
        if (value && !present) {
          const option = pair
            ? familyEntry(value)
            : { id: 'current', label: value, family: value, stack: currentValue, preview: currentValue, script: 'latin', groupKey: 'fontGroup.localLatin' }
          pushTo(picks, option)
          pushTo(all, option)
        }
      }

      return { options: dedupe(picks), allOptions: dedupe(all), missing: missing }
    }

    /**
     * 把已保存的值映射回选项：先精确匹配字体栈，再退回"栈以该家族开头"，
     * 这样旧版本保存的栈（多了几个中间家族）也能认出来，不会显示成"自定义"。
     */
    function matchFont(options, stack) {
      if (!stack) return options.find(function (option) { return option.stack === '' }) || null
      const exact = options.find(function (option) { return option.stack === stack })
      if (exact) return exact
      const lower = String(stack).toLowerCase()
      const insensitive = options.find(function (option) { return option.stack.toLowerCase() === lower })
      if (insensitive) return insensitive
      const head = headFamily(stack).toLowerCase()
      if (!head) return null
      return options.find(function (option) { return option.family && option.family.toLowerCase() === head }) || null
    }

    /** 配色预设：每种给出浅色/深色两套 token 值；default 不覆盖任何 token */
    const PRESETS = [
      { id: 'default', key: 'preset.default', swatch: '#4176E6' },
      {
        id: 'graphite', key: 'preset.graphite', swatch: '#4A5568',
        light: { accent: '#4A5568', link: '#2F6FEB', base: '#FFFFFF', layer1: '#F6F7F8', layer2: '#EEF0F2', ink: '#16181D', secondary: '#5B6472', border: '#E3E6EA' },
        dark: { accent: '#9AA6B8', link: '#7AA7FF', base: '#17181B', layer1: '#1D1F23', layer2: '#24262B', ink: '#F2F4F7', secondary: '#A8B0BD', border: '#2E3238' },
      },
      {
        id: 'deepsea', key: 'preset.deepsea', swatch: '#1F6FEB',
        light: { accent: '#1F6FEB', link: '#1A66D6', base: '#FFFFFF', layer1: '#F5F8FD', layer2: '#EAF1FB', ink: '#10203A', secondary: '#47607F', border: '#DBE6F5' },
        dark: { accent: '#61A8FF', link: '#7CBCFF', base: '#0F1620', layer1: '#141D29', layer2: '#1B2634', ink: '#E8F0FB', secondary: '#9DB4D0', border: '#24354A' },
      },
      {
        id: 'sand', key: 'preset.sand', swatch: '#B45309',
        light: { accent: '#B45309', link: '#9A5B1A', base: '#FDFCFA', layer1: '#F7F5F1', layer2: '#EFECE6', ink: '#2B2724', secondary: '#6B6259', border: '#E6E1D8' },
        dark: { accent: '#E0A35C', link: '#E8B878', base: '#1A1815', layer1: '#211E1A', layer2: '#2A2621', ink: '#F5F1EA', secondary: '#B8AE9F', border: '#38332C' },
      },
      {
        id: 'forest', key: 'preset.forest', swatch: '#18794E',
        light: { accent: '#18794E', link: '#15703F', base: '#FFFFFF', layer1: '#F4F9F4', layer2: '#E9F2E9', ink: '#14261A', secondary: '#4A6350', border: '#D8E6D9' },
        dark: { accent: '#5CC98D', link: '#6FD79C', base: '#101713', layer1: '#16201A', layer2: '#1D2A21', ink: '#E9F2EC', secondary: '#A3B8A9', border: '#26362C' },
      },
      {
        id: 'contrast', key: 'preset.contrast', swatch: '#0B57D0',
        light: { accent: '#0B57D0', link: '#0B57D0', base: '#FFFFFF', layer1: '#FFFFFF', layer2: '#F2F2F2', ink: '#000000', secondary: '#3D3D3D', border: '#767676' },
        dark: { accent: '#8AB4F8', link: '#8AB4F8', base: '#000000', layer1: '#0A0A0A', layer2: '#141414', ink: '#FFFFFF', secondary: '#D0D0D0', border: '#8A8A8A' },
      },
    ]

    /* ---------------------------------------------------------------- 纯函数 */

    function normalize(value) {
      const source = value && typeof value === 'object' ? value : {}
      const out = {}
      for (const field of FIELDS) {
        out[field] = typeof source[field] === 'string' ? source[field] : ''
      }
      return out
    }

    /** 组装覆盖层：预设先铺，用户手填的 accent/surface/ink 再盖在上面 */
    function buildTokens(values) {
      const pairs = {}
      const put = (name, light, dark) => {
        if (!light && !dark) return
        pairs[name] = { light: light || dark, dark: dark || light }
      }
      /**
       * 用户手填的值盖在预设之上，且**逐档**合并：
       * 只填了深色档时，浅色档保留预设的值，而不是被用户值顶掉；
       * 没有预设时（默认预设）才退化为"一个值两档通用"。
       */
      const override = (name, light, dark) => {
        if (!light && !dark) return
        const base = pairs[name] || {}
        pairs[name] = { light: light || base.light || dark, dark: dark || base.dark || light }
      }
      const preset = PRESETS.find((item) => item.id === values.preset)
      if (preset && preset.light) {
        for (const key of Object.keys(TOKEN)) {
          put(TOKEN[key], preset.light[key], preset.dark[key])
        }
      }
      if (values.uiFont) put('--dsw-font-family', values.uiFont, values.uiFont)
      if (values.codeFont) put('--ds-font-family-code', values.codeFont, values.codeFont)
      override(TOKEN.accent, values.accentLight, values.accentDark)
      override(TOKEN.base, values.surfaceLight, values.surfaceDark)
      override(TOKEN.ink, values.inkLight, values.inkDark)
      return pairs
    }

    function isHex(text) {
      return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(String(text || '').trim())
    }

    function safeHex(text, fallback) {
      return isHex(text) ? String(text).trim() : fallback
    }

    function createStore(read) {
      let snapshot = read()
      const listeners = new Set()
      return {
        get: function () { return snapshot },
        peek: function () { return snapshot },
        subscribe: function (listener) {
          listeners.add(listener)
          return function () { listeners.delete(listener) }
        },
        refresh: function () {
          snapshot = read()
          for (const listener of Array.from(listeners)) listener()
        },
      }
    }

    /* ---------------------------------------------------------------- 文案 */

    const ZH = {
      nav: '外观',
      title: '外观增强',
      subtitle: '字体、配色与字号。改动即时生效，并保存在本机 profile 配置里。',
      fonts: '字体',
      uiFont: '界面与正文字体',
      uiFontPairHint: '中英文字体分开选：西文用英文字体，中文自动回退到中文字体。留空则跟随默认。',
      latinFont: '英文字体',
      cjkFont: '中文字体',
      'font.notSet': '不指定（跟随默认）',
      codeFont: '代码字体',
      codeFontHint: '用于代码块、JSON 与 diff，同样是推荐优先。',
      fontSize: '正文字号',
      fontSizeHint: '与「设置 → 通用」的字号是同一个值（10–22 px）。',
      colors: '配色',
      preset: '配色预设',
      presetHint: '预设是一层 token 覆盖，随时可以切回默认。',
      variant: '正在编辑',
      light: '浅色',
      dark: '深色',
      accent: '强调色',
      accentHint: '按钮、选中态与焦点环。',
      surface: '背景色',
      surfaceHint: '主内容区背景。',
      ink: '文字色',
      inkHint: '正文文字颜色。',
      followPreset: '跟随预设',
      advancedFonts: '手动编辑字体栈',
      advancedFontsHint: '选择器覆盖不到时才需要',
      uiFontStack: '界面与正文',
      codeFontStack: '代码',
      reset: '重置',
      advanced: '高级',
      io: '导入 / 导出设置',
      ioHint: '备份、分享或换机迁移',
      exportBtn: '导出到文本框',
      importBtn: '应用文本框',
      resetAll: '重置全部设置',
      rejected: '部署没有接受这次修改（可能被更高优先级的补丁层覆盖）。',
      memoryMode: '当前页面不是本机回环地址，改动只在本次会话生效。',
      applied: '已应用。',
      badJson: '文本无法解析，请检查格式。',
      'fontGroup.recommended': '推荐',
      'fontGroup.cjkSans': '中文 · 黑体',
      'fontGroup.cjkSerif': '中文 · 宋楷',
      'fontGroup.latinSans': '英文 · 无衬线',
      'fontGroup.latinSerif': '英文 · 衬线',
      'fontGroup.display': '英文 · 展示与圆体',
      'fontGroup.mono': '等宽 · 中英通用',
      'fontGroup.localCjk': '本机已安装 · 中文',
      'fontGroup.localLatin': '本机已安装 · 西文',
      'font.follow': '跟随 DSH 默认',
      'font.system': '系统无衬线',
      'font.noto': '思源黑体',
      'font.harmony': '鸿蒙 Sans',
      'font.misans': 'MiSans 小米',
      'font.puhuiti': '阿里巴巴普惠体',
      'font.pingfang': '苹方',
      'font.yahei': '微软雅黑',
      'font.sarasaGothic': '更纱黑体',
      'font.notoSerif': '思源宋体',
      'font.lxgw': '霞鹜文楷',
      'font.lxgwScreen': '霞鹜文楷（屏幕版）',
      'font.serif': '宋体',
      'font.simsun': '中易宋体',
      'font.kaiti': '楷体',
      'font.smiley': '得意黑',
      'font.rounded': '圆体',
      'font.youyuan': '幼圆',
      'font.customName': '自定义',
      'font.search': '搜索字体…',
      'font.empty': '没有匹配的字体',
      'font.loading': '正在读取本机字体…',
      'font.noLocal': '读不到本机字体列表（字体权限不可用）。下面是常见字体，未安装的会回退到默认。',
      'font.missingHint': '本机未安装的推荐字体：',
      'font.missingMore': ' 等 {n} 款',
      'font.missingTail': '。装好后重新打开即可选用。',
      'font.showAll': '显示本机全部字体（共 {n}）',
      'font.showPick': '只看推荐字体',
      'code.follow': '跟随 DSH 默认',
      'code.default': '默认等宽栈',
      'code.sarasa': '更纱黑体等宽',
      'preset.default': '默认',
      'preset.graphite': '石墨',
      'preset.deepsea': '深海',
      'preset.sand': '暖沙',
      'preset.forest': '森绿',
      'preset.contrast': '高对比',
    }

    const EN = {
      nav: 'Appearance',
      title: 'Appearance+',
      subtitle: 'Fonts, palettes and text size. Changes apply instantly and persist in this profile.',
      fonts: 'Fonts',
      uiFont: 'Interface and body font',
      uiFontPairHint: 'Pick the Latin and Chinese families separately; Latin text uses the first, Chinese falls back to the second.',
      latinFont: 'Latin font',
      cjkFont: 'Chinese font',
      'font.notSet': 'Not set (use default)',
      codeFont: 'Code font',
      codeFontHint: 'Used for code blocks, JSON and diffs; recommended first.',
      fontSize: 'Body text size',
      fontSizeHint: 'The same value as Settings - General (10-22 px).',
      colors: 'Colors',
      preset: 'Palette preset',
      presetHint: 'A preset is one token layer; switch back to Default at any time.',
      variant: 'Editing',
      light: 'Light',
      dark: 'Dark',
      accent: 'Accent',
      accentHint: 'Buttons, selection and focus ring.',
      surface: 'Surface',
      surfaceHint: 'Main content background.',
      ink: 'Ink',
      inkHint: 'Body text color.',
      followPreset: 'Follow preset',
      advancedFonts: 'Edit font stacks manually',
      advancedFontsHint: 'only when the pickers cannot express it',
      uiFontStack: 'Interface and body',
      codeFontStack: 'Code',
      reset: 'Reset',
      advanced: 'Advanced',
      io: 'Import / export settings',
      ioHint: 'back up, share or migrate',
      exportBtn: 'Export to box',
      importBtn: 'Apply text',
      resetAll: 'Reset everything',
      rejected: 'The deployment did not accept this change (a higher-priority patch layer may win).',
      memoryMode: 'This page is not on a loopback origin, so changes live only in this session.',
      applied: 'Applied.',
      badJson: 'Could not parse that text.',
      'fontGroup.recommended': 'Recommended',
      'fontGroup.cjkSans': 'Chinese · Sans',
      'fontGroup.cjkSerif': 'Chinese · Serif',
      'fontGroup.latinSans': 'Latin · Sans',
      'fontGroup.latinSerif': 'Latin · Serif',
      'fontGroup.display': 'Latin · Display & rounded',
      'fontGroup.mono': 'Monospace · CJK + Latin',
      'fontGroup.localCjk': 'Installed · Chinese',
      'fontGroup.localLatin': 'Installed · Latin',
      'font.follow': 'Follow DSH default',
      'font.system': 'System sans',
      'font.noto': 'Noto Sans SC',
      'font.harmony': 'HarmonyOS Sans',
      'font.misans': 'MiSans',
      'font.puhuiti': 'Alibaba PuHuiTi',
      'font.pingfang': 'PingFang SC',
      'font.yahei': 'Microsoft YaHei',
      'font.sarasaGothic': 'Sarasa Gothic',
      'font.notoSerif': 'Noto Serif SC',
      'font.lxgw': 'LXGW WenKai',
      'font.lxgwScreen': 'LXGW WenKai Screen',
      'font.serif': 'Songti',
      'font.simsun': 'SimSun',
      'font.kaiti': 'Kaiti',
      'font.smiley': 'Smiley Sans',
      'font.rounded': 'Rounded',
      'font.youyuan': 'YouYuan',
      'font.customName': 'Custom',
      'font.search': 'Search fonts…',
      'font.empty': 'No matching font',
      'font.loading': 'Reading installed fonts…',
      'font.noLocal': 'Cannot read installed fonts (font permission unavailable). Common families are listed; missing ones fall back to the default.',
      'font.missingHint': 'Recommended, not installed: ',
      'font.missingMore': ' and {n} more',
      'font.missingTail': '. They appear here once installed.',
      'font.showAll': 'Show all installed fonts ({n})',
      'font.showPick': 'Recommended only',
      'code.follow': 'Follow DSH default',
      'code.default': 'Default mono stack',
      'code.sarasa': 'Sarasa Mono SC',
      'preset.default': 'Default',
      'preset.graphite': 'Graphite',
      'preset.deepsea': 'Deep Sea',
      'preset.sand': 'Warm Sand',
      'preset.forest': 'Forest',
      'preset.contrast': 'High Contrast',
    }

    /* ---------------------------------------------------------------- 样式 */

    const S = {
      page: { maxWidth: 720, margin: '0 auto', padding: '4px 0 56px', display: 'flex', flexDirection: 'column', gap: 20, color: 'var(--dsw-alias-label-primary)', fontSize: 14, lineHeight: 1.6 },
      h1: { margin: '0 0 4px', fontSize: 18, fontWeight: 600 },
      lead: { margin: 0, color: 'var(--dsw-alias-label-tertiary)', fontSize: 13 },
      notice: { margin: '8px 0 0', fontSize: 12, color: 'var(--dsw-alias-state-warn-primary, var(--dsw-alias-label-secondary))' },
      card: { border: '1px solid var(--dsw-alias-border-l2)', background: 'var(--dsw-alias-settings-card-fill, var(--dsw-alias-bg-layer-2))', borderRadius: 'var(--dsw-radius-lg, 12px)', padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 16 },
      h2: { margin: 0, fontSize: 14, fontWeight: 600 },
      row: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 20 },
      rowText: { minWidth: 0, flex: '1 1 auto' },
      rowControl: { flex: '0 0 auto', display: 'flex', alignItems: 'center', gap: 8 },
      label: { fontSize: 13, fontWeight: 500 },
      hint: { fontSize: 12, color: 'var(--dsw-alias-label-tertiary)', marginTop: 2 },
      control: { background: 'var(--dsw-alias-bg-layer-1)', color: 'var(--dsw-alias-label-primary)', border: '1px solid var(--dsw-alias-border-l2)', borderRadius: 'var(--dsw-radius-sm, 8px)', padding: '5px 8px', fontSize: 13, fontFamily: 'inherit', minWidth: 160 },
      mono: { fontFamily: 'var(--ds-font-family-code)', fontSize: 12 },
      btn: { background: 'var(--dsw-alias-bg-layer-1)', color: 'var(--dsw-alias-label-primary)', border: '1px solid var(--dsw-alias-border-l2)', borderRadius: 'var(--dsw-radius-sm, 8px)', padding: '5px 10px', fontSize: 13, cursor: 'pointer' },
      stepBtn: { width: 28, height: 26, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'var(--dsw-alias-bg-layer-1)', color: 'var(--dsw-alias-label-primary)', border: '1px solid var(--dsw-alias-border-l2)', borderRadius: 'var(--dsw-radius-sm, 8px)', cursor: 'pointer', fontSize: 15, lineHeight: 1 },
      stepValue: { minWidth: 56, textAlign: 'center', fontVariantNumeric: 'tabular-nums', fontSize: 13 },
      grid: { display: 'flex', flexWrap: 'wrap', gap: 10 },
      swatchBtn: { display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'stretch', background: 'var(--dsw-alias-bg-layer-1)', border: '1px solid var(--dsw-alias-border-l2)', borderRadius: 'var(--dsw-radius-md, 10px)', padding: 8, cursor: 'pointer', minWidth: 92 },
      swatchBtnOn: { borderColor: 'var(--dsw-alias-state-business-primary)', boxShadow: '0 0 0 1px var(--dsw-alias-state-business-primary)' },
      swatchBar: { display: 'flex', height: 18, borderRadius: 4, overflow: 'hidden', border: '1px solid var(--dsw-alias-border-l1)' },
      swatchName: { fontSize: 12, color: 'var(--dsw-alias-label-secondary)', textAlign: 'left' },
      seg: { display: 'inline-flex', border: '1px solid var(--dsw-alias-border-l2)', borderRadius: 'var(--dsw-radius-sm, 8px)', overflow: 'hidden' },
      segBtn: { padding: '4px 10px', fontSize: 12, background: 'transparent', color: 'var(--dsw-alias-label-secondary)', border: 'none', cursor: 'pointer' },
      segBtnOn: { background: 'var(--dsw-alias-bg-layer-1)', color: 'var(--dsw-alias-label-primary)' },
      textarea: { width: '100%', boxSizing: 'border-box', minHeight: 104, resize: 'vertical', background: 'var(--dsw-alias-bg-layer-1)', color: 'var(--dsw-alias-label-primary)', border: '1px solid var(--dsw-alias-border-l2)', borderRadius: 'var(--dsw-radius-sm, 8px)', padding: 10, fontSize: 12, lineHeight: 1.55, fontFamily: 'var(--ds-font-family-code)' },
      btnRowEnd: { display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'flex-end' },
      block: { display: 'flex', flexDirection: 'column', gap: 4 },
      field: { display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 },
      fieldLabel: { fontSize: 12, fontWeight: 500, color: 'var(--dsw-alias-label-secondary)' },
      // 高级项每块自带边框：标题一行（说明右对齐），展开后是分隔线下的面板，
      // 比"裸控件浮在卡片里"整齐，也一眼能看出当前收起了几块。
      advancedList: { display: 'flex', flexDirection: 'column', gap: 10 },
      disclosure: { display: 'flex', flexDirection: 'column', border: '1px solid var(--dsw-alias-border-l2)', borderRadius: 'var(--dsw-radius-md, 10px)', overflow: 'hidden' },
      disclosureHead: { display: 'flex', alignItems: 'center', gap: 10, width: '100%', boxSizing: 'border-box', padding: '10px 12px', background: 'transparent', border: 'none', color: 'var(--dsw-alias-label-primary)', fontFamily: 'inherit', fontSize: 13, textAlign: 'left', cursor: 'pointer' },
      disclosureCaret: { flex: '0 0 auto', width: 10, color: 'var(--dsw-alias-label-tertiary)', fontSize: 10, lineHeight: 1 },
      disclosureTitle: { flex: '0 0 auto', fontWeight: 500 },
      disclosureHint: { flex: '1 1 auto', minWidth: 0, textAlign: 'right', color: 'var(--dsw-alias-label-tertiary)', fontSize: 12 },
      disclosureBody: { display: 'flex', flexDirection: 'column', gap: 12, padding: '12px 12px 14px', borderTop: '1px solid var(--dsw-alias-border-l1)' },
      cardFooter: { display: 'flex', justifyContent: 'flex-end', marginTop: 6, paddingTop: 12, borderTop: '1px solid var(--dsw-alias-border-l1)' },
      dangerBtn: { background: 'transparent', color: 'var(--dsw-alias-state-error-primary)', border: '1px solid var(--dsw-alias-border-l2)', borderRadius: 'var(--dsw-radius-sm, 8px)', padding: '5px 12px', fontSize: 13, fontFamily: 'inherit', cursor: 'pointer' },
      pairGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 8 },
      pairCell: { display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 },
      pairCaption: { fontSize: 12, color: 'var(--dsw-alias-label-secondary)' },
      pickerTriggerBlock: { width: '100%', maxWidth: 'none', minWidth: 0, boxSizing: 'border-box' },
      pickerRoot: { position: 'relative', display: 'block' },
      pickerTrigger: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, minWidth: 208, maxWidth: 268, padding: '6px 10px', background: 'var(--dsw-alias-bg-layer-1)', color: 'var(--dsw-alias-label-primary)', border: '1px solid var(--dsw-alias-border-l2)', borderRadius: 'var(--dsw-radius-sm, 8px)', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' },
      pickerCaret: { color: 'var(--dsw-alias-label-tertiary)', fontSize: 10, flex: '0 0 auto' },
      // 面板用不透明的 layer-2：宿主的 --dsw-menu-surface-fill 是半透明材质，
      // 必须配 --dsw-menu-backdrop-filter 才好看，这里干脆用实色，长时间看不累。
      pickerPanel: { position: 'absolute', top: 'calc(100% + 6px)', right: 0, zIndex: 40, display: 'flex', flexDirection: 'column', minWidth: 330, maxWidth: 396, padding: 6, background: 'var(--dsw-alias-bg-layer-2, #1c1c1e)', border: '1px solid var(--dsw-alias-border-l3)', borderRadius: 'var(--dsw-radius-md, 10px)', boxShadow: '0 14px 36px rgba(0, 0, 0, .26), 0 3px 8px rgba(0, 0, 0, .14)', outline: 'none' },
      pickerSearch: { width: '100%', boxSizing: 'border-box', marginBottom: 6, padding: '7px 9px', background: 'var(--dsw-alias-bg-layer-1)', color: 'var(--dsw-alias-label-primary)', border: '1px solid var(--dsw-alias-border-l2)', borderRadius: 'var(--dsw-radius-sm, 8px)', fontSize: 13, fontFamily: 'inherit' },
      pickerList: { overflowY: 'auto', maxHeight: 296, display: 'flex', flexDirection: 'column' },
      pickerGroup: { position: 'sticky', top: 0, zIndex: 1, padding: '9px 4px 5px', background: 'var(--dsw-alias-bg-layer-2, #1c1c1e)', borderTop: '1px solid var(--dsw-alias-border-l1)', fontSize: 11, fontWeight: 600, color: 'var(--dsw-alias-label-tertiary)' },
      pickerItem: { display: 'flex', alignItems: 'center', gap: 10, width: '100%', boxSizing: 'border-box', padding: '7px 10px', background: 'transparent', border: 'none', borderRadius: 'var(--dsw-radius-sm, 8px)', color: 'var(--dsw-alias-label-primary)', fontSize: 14, textAlign: 'left', cursor: 'pointer' },
      pickerItemOn: { background: 'var(--dsw-alias-interactive-bg-hover)' },
      pickerItemSelected: { background: 'var(--dsw-alias-interactive-bg-active)' },
      pickerName: { flex: '1 1 auto', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
      pickerSample: { flex: '0 0 auto', fontSize: 12, color: 'var(--dsw-alias-label-caption)', whiteSpace: 'nowrap' },
      pickerCheck: { flex: '0 0 auto', color: 'var(--dsw-alias-state-business-primary)', fontSize: 13, width: 12, textAlign: 'right' },
      pickerEmpty: { padding: 10, fontSize: 12, color: 'var(--dsw-alias-label-tertiary)' },
      pickerHint: { flex: '0 0 auto', marginTop: 6, padding: '8px 4px 2px', borderTop: '1px solid var(--dsw-alias-border-l1)', fontSize: 11, lineHeight: 1.55, color: 'var(--dsw-alias-label-tertiary)' },
      pickerToggle: { flex: '0 0 auto', marginTop: 6, padding: '7px 8px', background: 'transparent', border: 'none', borderTop: '1px solid var(--dsw-alias-border-l1)', color: 'var(--dsw-alias-state-business-primary)', fontSize: 12, textAlign: 'left', cursor: 'pointer', borderRadius: 'var(--dsw-radius-sm, 8px)' },
    }

    /* ---------------------------------------------------------------- 控件 */

    function Card(props) {
      return h('section', { style: S.card }, props.title ? h('h2', { style: S.h2 }, props.title) : null, props.children)
    }

    function Row(props) {
      return h('div', { style: S.row },
        h('div', { style: S.rowText },
          h('div', { style: S.label }, props.title),
          props.hint ? h('div', { style: S.hint }, props.hint) : null),
        h('div', { style: S.rowControl }, props.children))
    }

    /**
     * 字体选择器：外观与宿主一致（token 上色 + 自绘面板），
     * 每个选项用**它自己的字体**渲染名字，选中的打勾。
     */
    function FontPicker(props) {
      const t = props.t
      const options = props.options
      const [open, setOpen] = useState(false)
      const [query, setQuery] = useState('')
      const [active, setActive] = useState(0)
      const [showAll, setShowAll] = useState(false)
      const rootRef = useRef(null)

      useEffect(function () {
        if (!open) return undefined
        const onPointerDown = function (event) {
          if (rootRef.current && !rootRef.current.contains(event.target)) setOpen(false)
        }
        const onKeyDown = function (event) { if (event.key === 'Escape') setOpen(false) }
        document.addEventListener('mousedown', onPointerDown)
        document.addEventListener('keydown', onKeyDown)
        return function () {
          document.removeEventListener('mousedown', onPointerDown)
          document.removeEventListener('keydown', onKeyDown)
        }
      }, [open])

      const triggerStyle = props.triggerStyle ? Object.assign({}, S.pickerTrigger, props.triggerStyle) : S.pickerTrigger
      const panelStyle = props.panelAlign === 'left'
        ? Object.assign({}, S.pickerPanel, { left: 0, right: 'auto' })
        : S.pickerPanel
      const all = props.allOptions || options
      const hasMore = all.length > options.length + 1
      const list = showAll ? all : options
      const current = matchFont(list, props.value) || matchFont(options, props.value)
      /** 选中态按"匹配到的那一项"判定，同一家族即使有多行也不会同时打勾 */
      const isSelected = function (option) {
        if (!current) return false
        if (option.id === current.id) return true
        return !!option.family && !!current.family && option.family.toLowerCase() === current.family.toLowerCase()
      }
      const keyword = query.trim().toLowerCase()
      const visible = keyword
        ? list.filter(function (option) { return (option.label + ' ' + option.family).toLowerCase().indexOf(keyword) >= 0 })
        : list

      const choose = function (option) {
        if (!option) return
        setOpen(false)
        setQuery('')
        props.onChange(option.stack)
      }

      return h('div', { ref: rootRef, style: S.pickerRoot },
        h('button', {
          type: 'button',
          'aria-haspopup': 'listbox',
          'aria-expanded': open ? 'true' : 'false',
          onClick: function () {
            const next = !open
            setOpen(next)
            setQuery('')
            setActive(0)
            if (next) { setShowAll(false); props.onOpen() }
          },
          style: triggerStyle,
        },
          h('span', { style: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, current ? current.label : t('font.customName')),
          h('span', { style: S.pickerCaret }, open ? '\u25B4' : '\u25BE')),
        open
          ? h('div', {
              role: 'listbox',
              tabIndex: 0,
              style: panelStyle,
              onKeyDown: function (event) {
                if (event.key === 'ArrowDown') { event.preventDefault(); setActive(Math.min(active + 1, visible.length - 1)) }
                else if (event.key === 'ArrowUp') { event.preventDefault(); setActive(Math.max(active - 1, 0)) }
                else if (event.key === 'Enter') { event.preventDefault(); choose(visible[active]) }
              },
            },
            visible.length > 12
              ? h('input', {
                  type: 'text', value: query, spellCheck: false, placeholder: t('font.search'),
                  onChange: function (event) { setQuery(event.target.value); setActive(0) },
                  style: S.pickerSearch,
                })
              : null,
            h('div', { style: S.pickerList },
              visible.length === 0 ? h('div', { style: S.pickerEmpty }, t('font.empty')) : null,
              visible.map(function (option, index) {
                const selected = isSelected(option)
                const preview = option.preview || option.stack || 'inherit'
                const header = index === 0 || visible[index - 1].groupKey !== option.groupKey
                  ? h('div', { key: 'g:' + option.groupKey + ':' + index, style: S.pickerGroup }, t(option.groupKey))
                  : null
                return h('div', { key: option.id },
                  header,
                  h('button', {
                    type: 'button',
                    role: 'option',
                    'aria-selected': selected ? 'true' : 'false',
                    onMouseEnter: function () { setActive(index) },
                    onClick: function () { choose(option) },
                    style: Object.assign({}, S.pickerItem, selected ? S.pickerItemSelected : null, index === active ? S.pickerItemOn : null),
                  },
                    h('span', { style: Object.assign({}, S.pickerName, { fontFamily: preview }) }, option.label),
                    h('span', { style: Object.assign({}, S.pickerSample, { fontFamily: preview }) }, option.script === 'cjk' ? '\u6c38\u548c\u4e5d\u5e74' : 'Aa Bb 123'),
                    h('span', { style: S.pickerCheck }, selected ? '\u2713' : '')))
              })),
            hasMore
              ? h('button', {
                  type: 'button',
                  style: S.pickerToggle,
                  onClick: function () { setShowAll(!showAll); setQuery(''); setActive(0) },
                }, showAll
                  ? t('font.showPick')
                  : t('font.showAll').replace('{n}', String(all.length)))
              : null,
            props.localStatus === 'idle' || props.localStatus === 'loading'
              ? h('div', { style: S.pickerHint }, t('font.loading'))
              : props.localStatus === 'unavailable'
                ? h('div', { style: S.pickerHint }, t('font.noLocal'))
                : props.missing && props.missing.length > 0
                  ? h('div', { style: S.pickerHint },
                      t('font.missingHint') + props.missing.slice(0, 6).join('、') +
                      (props.missing.length > 6 ? t('font.missingMore').replace('{n}', String(props.missing.length)) : '') +
                      t('font.missingTail'))
                  : null)
          : null)
    }

    function StackInput(props) {
      const [draft, setDraft] = useState(props.value)
      useEffect(function () { setDraft(props.value) }, [props.value])
      return h('input', {
        type: 'text',
        value: draft,
        spellCheck: false,
        placeholder: props.placeholder || '',
        onChange: function (event) { setDraft(event.target.value) },
        onBlur: function () { if (draft !== props.value) props.onCommit(draft) },
        onKeyDown: function (event) {
          if (event.key === 'Enter') { event.preventDefault(); if (draft !== props.value) props.onCommit(draft) }
        },
        style: Object.assign({}, S.control, S.mono, { width: '100%', boxSizing: 'border-box', minWidth: 0 }),
      })
    }

    /** 折叠区块：标题一行，内容展开才渲染（默认收起，避免高级项占版面） */
    function Disclosure(props) {
      const [open, setOpen] = useState(false)
      return h('div', { style: S.disclosure },
        h('button', {
          type: 'button',
          'aria-expanded': open ? 'true' : 'false',
          style: S.disclosureHead,
          onClick: function () { setOpen(!open) },
        },
          h('span', { style: S.disclosureCaret }, open ? '\u25BE' : '\u25B8'),
          h('span', { style: S.disclosureTitle }, props.title),
          props.hint ? h('span', { style: S.disclosureHint }, props.hint) : null),
        open ? h('div', { style: S.disclosureBody }, props.children) : null)
    }

    function Stepper(props) {
      return h('div', { style: { display: 'flex', alignItems: 'center', gap: 8 } },
        h('button', {
          style: S.stepBtn, type: 'button', disabled: props.value <= props.min,
          onClick: function () { props.onChange(props.value - 1) },
        }, '-'),
        h('span', { style: S.stepValue }, props.value + ' px'),
        h('button', {
          style: S.stepBtn, type: 'button', disabled: props.value >= props.max,
          onClick: function () { props.onChange(props.value + 1) },
        }, '+'))
    }

    function ColorField(props) {
      const [draft, setDraft] = useState(props.value)
      useEffect(function () { setDraft(props.value) }, [props.value])
      const commit = function (next) {
        const text = String(next || '').trim()
        if (text === props.value) return
        if (text === '' || isHex(text)) props.onCommit(text)
      }
      return h('div', { style: S.row },
        h('div', { style: S.rowText },
          h('div', { style: S.label }, props.label),
          props.hint ? h('div', { style: S.hint }, props.hint) : null),
        h('div', { style: S.rowControl },
          h('input', {
            type: 'color',
            value: safeHex(props.value, safeHex(props.fallback, '#000000')),
            onChange: function (event) { setDraft(event.target.value); props.onCommit(event.target.value) },
            title: props.label,
            style: { width: 34, height: 26, padding: 0, border: '1px solid var(--dsw-alias-border-l2)', borderRadius: 6, background: 'transparent', cursor: 'pointer' },
          }),
          h('input', {
            type: 'text',
            value: draft,
            spellCheck: false,
            placeholder: props.fallback || props.followLabel,
            onChange: function (event) { setDraft(event.target.value) },
            onBlur: function () { commit(draft) },
            onKeyDown: function (event) { if (event.key === 'Enter') { event.preventDefault(); commit(draft) } },
            style: Object.assign({}, S.control, S.mono, { width: 96, minWidth: 96, textAlign: 'center' }),
          }),
          props.value
            ? h('button', { type: 'button', style: S.btn, onClick: function () { props.onCommit('') } }, props.resetLabel)
            : h('span', { style: Object.assign({}, S.hint, { marginTop: 0, minWidth: 40 }) }, props.followLabel)))
    }

    /* ---------------------------------------------------------------- 页面 */

    function AppearancePage(props) {
      const store = props.store
      const actions = props.actions
      const t = props.t
      const snapshot = useSyncExternalStore(store.subscribe, store.get)
      const values = snapshot.values
      const [io, setIo] = useState('')
      const [notice, setNotice] = useState('')
      const [variant, setVariant] = useState('light')

      const commit = function (field, value) {
        Promise.resolve(actions.write(field, value)).then(function (ok) {
          setNotice(ok ? '' : t('rejected'))
        })
      }
      const uiParts = splitStack(values.uiFont)
      const uiLatinFonts = fontOptions('ui', t, uiParts.latin, 'latin')
      const uiCjkFonts = fontOptions('ui', t, uiParts.cjk, 'cjk')
      const codeFonts = fontOptions('code', t, values.codeFont, 'all')
      const localStatus = localFonts.status
      /** 改动其中一个框：交给 actions 按最新已存值合成（避免连续改动互相覆盖） */
      const setUiPart = function (part, family) {
        Promise.resolve(actions.setUiFontPart(part, family)).then(function (ok) {
          setNotice(ok ? '' : t('rejected'))
        })
      }
      const preset = PRESETS.find(function (item) { return item.id === values.preset }) || PRESETS[0]
      const presetValues = (variant === 'light' ? preset.light : preset.dark) || {}
      const suffix = variant === 'light' ? 'Light' : 'Dark'

      return h('div', { style: S.page },
        h('header', null,
          h('h1', { style: S.h1 }, t('title')),
          h('p', { style: S.lead }, t('subtitle')),
          notice ? h('p', { style: S.notice }, notice) : null,
          snapshot.mode === 'memory' ? h('p', { style: S.notice }, t('memoryMode')) : null),

        h(Card, { title: t('fonts') },
          h('div', { style: S.block },
            h('div', { style: S.label }, t('uiFont')),
            h('div', { style: S.hint }, t('uiFontPairHint')),
            h('div', { style: S.pairGrid },
              h('div', { style: S.pairCell },
                h('div', { style: S.pairCaption }, t('latinFont')),
                h(FontPicker, {
                  value: uiParts.latin,
                  options: uiLatinFonts.options,
                  allOptions: uiLatinFonts.allOptions,
                  missing: uiLatinFonts.missing,
                  localStatus: localStatus,
                  t: t,
                  triggerStyle: S.pickerTriggerBlock,
                  panelAlign: 'left',
                  onOpen: actions.loadLocalFonts,
                  onChange: function (family) { setUiPart('latin', family) },
                })),
              h('div', { style: S.pairCell },
                h('div', { style: S.pairCaption }, t('cjkFont')),
                h(FontPicker, {
                  value: uiParts.cjk,
                  options: uiCjkFonts.options,
                  allOptions: uiCjkFonts.allOptions,
                  missing: uiCjkFonts.missing,
                  localStatus: localStatus,
                  t: t,
                  triggerStyle: S.pickerTriggerBlock,
                  panelAlign: 'right',
                  onOpen: actions.loadLocalFonts,
                  onChange: function (family) { setUiPart('cjk', family) },
                })))),
          h(Row, { title: t('codeFont'), hint: t('codeFontHint') },
            h(FontPicker, {
              value: values.codeFont,
              options: codeFonts.options,
              allOptions: codeFonts.allOptions,
              missing: codeFonts.missing,
              localStatus: localStatus,
              t: t,
              onOpen: actions.loadLocalFonts,
              onChange: function (stack) { commit('codeFont', stack) },
            })),
          h(Row, { title: t('fontSize'), hint: t('fontSizeHint') },
            h(Stepper, {
              value: snapshot.fontSize, min: FONT_SIZE_MIN, max: FONT_SIZE_MAX,
              onChange: function (next) { actions.setFontSize(Math.min(FONT_SIZE_MAX, Math.max(FONT_SIZE_MIN, next))) },
            }))),

        h(Card, { title: t('colors') },
          h('div', null,
            h('div', { style: S.label }, t('preset')),
            h('div', { style: S.hint }, t('presetHint'))),
          h('div', { style: S.grid }, PRESETS.map(function (item) {
            const palette = item.dark || {}
            const on = values.preset === item.id
            return h('button', {
              key: item.id, type: 'button',
              style: Object.assign({}, S.swatchBtn, on ? S.swatchBtnOn : null),
              onClick: function () { commit('preset', item.id) },
            },
              h('span', { style: S.swatchBar },
                h('span', { style: { flex: 2, background: palette.base || '#888' } }),
                h('span', { style: { flex: 2, background: palette.layer2 || '#aaa' } }),
                h('span', { style: { flex: 1, background: item.swatch } })),
              h('span', { style: S.swatchName }, t(item.key)))
          }), null),
          h('div', { style: S.row },
            h('div', { style: S.rowText }, h('div', { style: S.label }, t('variant'))),
            h('div', { style: S.seg },
              h('button', {
                type: 'button',
                style: Object.assign({}, S.segBtn, variant === 'light' ? S.segBtnOn : null),
                onClick: function () { setVariant('light') },
              }, t('light')),
              h('button', {
                type: 'button',
                style: Object.assign({}, S.segBtn, variant === 'dark' ? S.segBtnOn : null),
                onClick: function () { setVariant('dark') },
              }, t('dark')))),
          h(ColorField, {
            label: t('accent'), hint: t('accentHint'),
            value: values['accent' + suffix],
            fallback: presetValues.accent,
            followLabel: t('followPreset'), resetLabel: t('reset'),
            onCommit: function (value) { commit('accent' + suffix, value) },
          }),
          h(ColorField, {
            label: t('surface'), hint: t('surfaceHint'),
            value: values['surface' + suffix],
            fallback: presetValues.base,
            followLabel: t('followPreset'), resetLabel: t('reset'),
            onCommit: function (value) { commit('surface' + suffix, value) },
          }),
          h(ColorField, {
            label: t('ink'), hint: t('inkHint'),
            value: values['ink' + suffix],
            fallback: presetValues.ink,
            followLabel: t('followPreset'), resetLabel: t('reset'),
            onCommit: function (value) { commit('ink' + suffix, value) },
          })),

        h(Card, { title: t('advanced') },
          h('div', { style: S.advancedList },
            h(Disclosure, { title: t('advancedFonts'), hint: t('advancedFontsHint') },
              h('div', { style: S.field },
                h('div', { style: S.fieldLabel }, t('uiFontStack')),
                h(StackInput, {
                  value: values.uiFont,
                  placeholder: '"Inter", "Microsoft YaHei", sans-serif',
                  onCommit: function (next) { commit('uiFont', next.trim()) },
                })),
              h('div', { style: S.field },
                h('div', { style: S.fieldLabel }, t('codeFontStack')),
                h(StackInput, {
                  value: values.codeFont,
                  placeholder: '"JetBrains Mono", Consolas, monospace',
                  onCommit: function (next) { commit('codeFont', next.trim()) },
                }))),
            h(Disclosure, { title: t('io'), hint: t('ioHint') },
              h('textarea', {
                value: io, spellCheck: false, rows: 5,
                placeholder: EXPORT_PREFIX + '{}',
                onChange: function (event) { setIo(event.target.value) },
                style: S.textarea,
              }),
              h('div', { style: S.btnRowEnd },
                h('button', {
                  type: 'button', style: S.btn,
                  onClick: function () { setIo(actions.exportText()) },
                }, t('exportBtn')),
                h('button', {
                  type: 'button', style: S.btn,
                  onClick: function () {
                    Promise.resolve(actions.applyImport(io)).then(function (ok) {
                      setNotice(ok ? t('applied') : t('badJson'))
                    })
                  },
                }, t('importBtn'))),
            h('div', { style: S.cardFooter },
              h('button', {
                type: 'button', style: S.dangerBtn,
                onClick: function () {
                  Promise.resolve(actions.resetAll()).then(function (ok) {
                    setNotice(ok ? t('applied') : t('rejected'))
                  })
                },
              }, t('resetAll')))))))
    }

    /* ---------------------------------------------------------------- 装配 */

    function apply(ctx) {
      const scope = ctx.configForms.get(ENTRY_ID)
      const t = ctx.locale.bind(LOCALE_NS)

      ctx.effect(function () {
        return ctx.locale.register(LOCALE_NS, { zh: ZH, en: EN })
      }, 'dsh-appearance: dictionaries')

      const store = createStore(function () {
        const snapshot = scope.getSnapshot()
        return {
          values: normalize(snapshot.value),
          status: snapshot.status,
          mode: snapshot.mode,
          writable: snapshot.writable,
          fontSize: ctx.theme.getTheme().fontSize,
          localFonts: localFonts.status + ':' + localFonts.families.length,
        }
      })

      // 每次快照变化就重放一次覆盖层；同 source 再调用 = 整层替换，不会叠加。
      // 注意：这里必须直接读宿主快照，不能读 store 的缓存——缓存要等 refresh 之后
      // 才是新值，先用缓存会导致"改完第一次不生效、再改一次才跟上"。
      const sync = function () {
        const values = normalize(scope.getSnapshot().value)
        try {
          ctx.theme.overrideTokens(OVERRIDE_SOURCE, buildTokens(values))
        } catch (error) {
          console.warn('[dsh-appearance] overlay failed', error)
        }
        store.refresh()
      }

      ctx.effect(function () {
        sync()
        return scope.subscribe(sync)
      }, 'dsh-appearance: token overrides')

      ctx.effect(function () {
        return ctx.on('theme/change', function () { store.refresh() })
      }, 'dsh-appearance: font size mirror')

      const actions = {
        /** 空值 = 取消覆盖（unset），让该字段回到继承/默认 */
        write: async function (field, value) {
          const text = typeof value === 'string' ? value.trim() : value
          if (text === '' || text === null || text === undefined) {
            if (typeof scope.unset === 'function') return await scope.unset(field)
            return await scope.set(field, '')
          }
          return await scope.set(field, text)
        },
        /**
         * 首次打开选择器时枚举本机字体（Chromium Local Font Access）。
         * 惰性：不在插件加载时弹权限；不可用或拒绝时静默降级为精选列表。
         */
        loadLocalFonts: function () {
          if (localFonts.status !== 'idle') return
          const api = typeof window !== 'undefined' && typeof window.queryLocalFonts === 'function'
            ? window.queryLocalFonts
            : null
          if (!api) {
            localFonts.status = 'unavailable'
            store.refresh()
            return
          }
          localFonts.status = 'loading'
          Promise.resolve(api.call(window)).then(function (fonts) {
            const seen = {}
            for (const font of fonts || []) {
              const family = font && font.family
              if (family && !seen[family]) seen[family] = true
            }
            localFonts.families = Object.keys(seen).sort(function (a, b) { return a.localeCompare(b) })
            localFonts.status = 'ready'
            store.refresh()
          }).catch(function (error) {
            localFonts.status = 'unavailable'
            localFonts.error = String((error && error.message) || error)
            store.refresh()
          })
        },
        /**
         * 改动"英文字体 / 中文字体"其中一个框：先读**最新已存值**再合成整条栈。
         * 不能用渲染时的快照合成——连续改两个框时，第二次会拿旧值把第一次的选择覆盖掉。
         */
        setUiFontPart: async function (part, family) {
          const parts = splitStack(normalize(scope.getSnapshot().value).uiFont)
          parts[part] = family
          return await actions.write('uiFont', composeUiStack(parts.latin, parts.cjk))
        },
        setFontSize: function (px) {
          try {
            ctx.theme.setFontSize(px)
            return true
          } catch (error) {
            console.warn('[dsh-appearance] setFontSize rejected', error)
            return false
          }
        },
        exportText: function () {
          return EXPORT_PREFIX + JSON.stringify(normalize(scope.getSnapshot().value), null, 2)
        },
        applyImport: async function (text) {
          let raw = String(text || '').trim()
          if (!raw) return false
          if (raw.indexOf(EXPORT_PREFIX) === 0) raw = raw.slice(EXPORT_PREFIX.length)
          let parsed
          try {
            parsed = JSON.parse(raw)
          } catch (error) {
            return false
          }
          if (!parsed || typeof parsed !== 'object') return false
          const operations = []
          for (const field of FIELDS) {
            if (!Object.prototype.hasOwnProperty.call(parsed, field)) continue
            const value = parsed[field]
            if (typeof value === 'string' && value !== '') operations.push({ op: 'set', path: [field], value: value })
            else operations.push({ op: 'unset', path: [field] })
          }
          if (operations.length === 0) return false
          if (typeof scope.mutate === 'function') return await scope.mutate(operations)
          let ok = true
          for (const operation of operations) {
            ok = operation.op === 'set'
              ? await scope.set(operation.path[0], operation.value)
              : await (typeof scope.unset === 'function' ? scope.unset(operation.path[0]) : scope.set(operation.path[0], ''))
            if (!ok) break
          }
          return ok
        },
        resetAll: async function () {
          if (typeof scope.mutate === 'function') {
            return await scope.mutate(FIELDS.map(function (field) { return { op: 'unset', path: [field] } }))
          }
          let ok = true
          for (const field of FIELDS) {
            ok = typeof scope.unset === 'function' ? await scope.unset(field) : await scope.set(field, '')
            if (!ok) break
          }
          return ok
        },
      }

      ctx.effect(function () {
        return ctx.configForms.whileServed([ENTRY_ID], function () {
          return ctx.slots.inject('settings.section', function () {
            return ctx.slots.register({
              name: 'settings.section',
              id: 'appearance',
              order: 12,
              label: function () { return t('nav') },
              locale: LOCALE_NS,
              inject: function () { return { store: store, actions: actions, t: t } },
            }, AppearancePage)
          })
        })
      }, 'dsh-appearance: settings page')
    }

    return {
      name: 'appearance',
      inject: ['slots', 'locale', 'theme', 'configForms'],
      apply: apply,
    }
  },
})
