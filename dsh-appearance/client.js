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
      { key: 'font.noto', family: 'Noto Sans SC', group: 'fontGroup.cjkSans', script: 'cjk' },
      { key: 'font.harmony', family: 'HarmonyOS Sans SC', group: 'fontGroup.cjkSans', script: 'cjk' },
      { key: 'font.misans', family: 'MiSans', group: 'fontGroup.cjkSans', script: 'cjk' },
      { key: 'font.puhuiti', family: 'Alibaba PuHuiTi 3.0', group: 'fontGroup.cjkSans', script: 'cjk' },
      { key: 'font.pingfang', family: 'PingFang SC', group: 'fontGroup.cjkSans', script: 'cjk' },
      { key: 'font.yahei', family: 'Microsoft YaHei', group: 'fontGroup.cjkSans', script: 'cjk' },
      { key: 'font.sarasaGothic', family: 'Sarasa Gothic SC', group: 'fontGroup.cjkSans', script: 'cjk' },
      // 中文宋楷
      { key: 'font.notoSerif', family: 'Noto Serif SC', group: 'fontGroup.cjkSerif', script: 'cjk' },
      { key: 'font.lxgw', family: 'LXGW WenKai', group: 'fontGroup.cjkSerif', script: 'cjk' },
      { key: 'font.lxgwScreen', family: 'LXGW WenKai Screen', group: 'fontGroup.cjkSerif', script: 'cjk' },
      { key: 'font.serif', family: 'Songti SC', group: 'fontGroup.cjkSerif', script: 'cjk' },
      { key: 'font.simsun', family: 'SimSun', group: 'fontGroup.cjkSerif', script: 'cjk' },
      { key: 'font.kaiti', family: 'Kaiti SC', group: 'fontGroup.cjkSerif', script: 'cjk' },
      // 西文无衬线
      { family: 'Inter', group: 'fontGroup.latinSans' },
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
      { key: 'font.smiley', family: 'Smiley Sans', group: 'fontGroup.display', script: 'cjk' },
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
      { family: 'JetBrains Mono', group: 'fontGroup.mono' },
      { family: 'Fira Code', group: 'fontGroup.mono' },
      { family: 'Cascadia Code', group: 'fontGroup.mono' },
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
      { key: 'code.sarasa', family: 'Sarasa Mono SC', group: 'fontGroup.mono' },
      { family: 'Menlo', group: 'fontGroup.mono' },
      { family: 'Consolas', group: 'fontGroup.mono' },
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

    /** 把家族名安全地拼成字体栈（引号、逗号等一律清洗掉） */
    function stackOf(family, fallback) {
      const clean = String(family || '').replace(/["']/g, '').trim()
      if (!clean) return fallback
      return '"' + clean + '", ' + fallback
    }

    /** 本机字体枚举（Chromium 的 Local Font Access）：惰性、失败即静默降级 */
    const localFonts = { status: 'idle', families: [] }

    /**
     * 组装某个选择器的全部选项：精选家族 + 本机已安装家族。
     * 字体栈在这里自动生成，条目只需声明家族名。
     */
    function fontOptions(kind, t) {
      const fallback = kind === 'code' ? CODE_FALLBACK : UI_FALLBACK
      const curated = kind === 'code' ? CODE_FONTS : UI_FONTS
      const options = curated.map(function (item) {
        return {
          id: item.key || 'family:' + item.family,
          label: item.key ? t(item.key) : item.family,
          family: item.family,
          stack: item.stack !== undefined ? item.stack : stackOf(item.family, fallback),
          groupKey: item.group,
          script: item.script || 'latin',
        }
      })
      const curatedFamilies = {}
      for (const item of curated) if (item.family) curatedFamilies[item.family.toLowerCase()] = true
      let added = 0
      for (const family of localFonts.families) {
        if (added >= 300) break
        if (curatedFamilies[family.toLowerCase()]) continue
        added += 1
        const cjk = isCjkFamily(family)
        options.push({
          id: 'local:' + family,
          label: family,
          family: family,
          stack: stackOf(family, fallback),
          groupKey: cjk ? 'fontGroup.localCjk' : 'fontGroup.localLatin',
          script: cjk ? 'cjk' : 'latin',
        })
      }
      return options
    }

    /**
     * 把已保存的值映射回选项：先精确匹配字体栈，再退回"栈以该家族开头"，
     * 这样旧版本保存的栈（多了几个中间家族）也能认出来，不会显示成"自定义"。
     */
    function matchFont(options, stack) {
      if (!stack) return options.find(function (option) { return option.stack === '' }) || null
      const exact = options.find(function (option) { return option.stack === stack })
      if (exact) return exact
      const head = stack.split(',')[0].trim().replace(/^["']|["']$/g, '').toLowerCase()
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
      uiFontHint: '影响整个界面与会话文字，留空表示跟随 DSH 默认。',
      codeFont: '代码字体',
      codeFontHint: '影响代码块、JSON 与 diff 等等宽区域。',
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
      advancedFonts: '自定义字体栈',
      advancedFontsHint: '需要精确控制时直接写 CSS font-family；留空表示跟随默认。上面的选择器与这里同步。',
      uiFontStack: '界面与正文',
      codeFontStack: '代码',
      reset: '重置',
      advanced: '高级',
      io: '导入 / 导出',
      ioHint: '复制这段文本即可备份或分享；粘贴后点「应用」还原。',
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
      uiFontHint: 'Applies to the whole interface and conversation text. Empty follows the DSH default.',
      codeFont: 'Code font',
      codeFontHint: 'Applies to code blocks, JSON and diffs.',
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
      advancedFonts: 'Custom font stacks',
      advancedFontsHint: 'Write a raw CSS font-family when you need exact control. Empty follows the default; the pickers above stay in sync.',
      uiFontStack: 'Interface and body',
      codeFontStack: 'Code',
      reset: 'Reset',
      advanced: 'Advanced',
      io: 'Import / Export',
      ioHint: 'Copy this text to back up or share; paste it back and press Apply.',
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
      textarea: { width: '100%', boxSizing: 'border-box', minHeight: 120, resize: 'vertical', background: 'var(--dsw-alias-bg-layer-1)', color: 'var(--dsw-alias-label-primary)', border: '1px solid var(--dsw-alias-border-l2)', borderRadius: 'var(--dsw-radius-sm, 8px)', padding: 8, fontSize: 12, fontFamily: 'var(--ds-font-family-code)' },
      btnRow: { display: 'flex', flexWrap: 'wrap', gap: 8 },
      pickerRoot: { position: 'relative', display: 'inline-block' },
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

      const current = matchFont(options, props.value)
      const keyword = query.trim().toLowerCase()
      const visible = keyword
        ? options.filter(function (option) { return (option.label + ' ' + option.family).toLowerCase().indexOf(keyword) >= 0 })
        : options

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
          onClick: function () { setOpen(!open); if (!open) props.onOpen() },
          style: S.pickerTrigger,
        },
          h('span', { style: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, current ? current.label : t('font.customName')),
          h('span', { style: S.pickerCaret }, open ? '\u25B4' : '\u25BE')),
        open
          ? h('div', {
              role: 'listbox',
              tabIndex: 0,
              style: S.pickerPanel,
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
                const selected = option.stack === props.value
                const preview = option.stack || 'inherit'
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
              })
            ))
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
        style: Object.assign({}, S.control, S.mono, { width: '100%', boxSizing: 'border-box', marginTop: 8 }),
      })
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
          h(Row, { title: t('uiFont'), hint: t('uiFontHint') },
            h(FontPicker, {
              value: values.uiFont,
              options: fontOptions('ui', t),
              t: t,
              onOpen: actions.loadLocalFonts,
              onChange: function (stack) { commit('uiFont', stack) },
            })),
          h(Row, { title: t('codeFont'), hint: t('codeFontHint') },
            h(FontPicker, {
              value: values.codeFont,
              options: fontOptions('code', t),
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
          h('div', null,
            h('div', { style: S.label }, t('advancedFonts')),
            h('div', { style: S.hint }, t('advancedFontsHint'))),
          h(StackInput, {
            value: values.uiFont,
            placeholder: t('uiFontStack'),
            onCommit: function (next) { commit('uiFont', next.trim()) },
          }),
          h(StackInput, {
            value: values.codeFont,
            placeholder: t('codeFontStack'),
            onCommit: function (next) { commit('codeFont', next.trim()) },
          }),
          h('div', null,
            h('div', { style: S.label }, t('io')),
            h('div', { style: S.hint }, t('ioHint'))),
          h('textarea', {
            value: io, spellCheck: false, rows: 6,
            placeholder: EXPORT_PREFIX + '{}',
            onChange: function (event) { setIo(event.target.value) },
            style: S.textarea,
          }),
          h('div', { style: S.btnRow },
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
            }, t('importBtn')),
            h('button', {
              type: 'button', style: S.btn,
              onClick: function () {
                Promise.resolve(actions.resetAll()).then(function (ok) {
                  setNotice(ok ? t('applied') : t('rejected'))
                })
              },
            }, t('resetAll')))))
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
