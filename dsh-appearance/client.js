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
    const { useEffect, useState, useSyncExternalStore } = React

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

    const UI_FONTS = [
      { key: 'font.follow', stack: '' },
      { key: 'font.system', stack: '-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Helvetica Neue", Arial, sans-serif' },
      { key: 'font.inter', stack: 'Inter, "Helvetica Neue", Arial, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif' },
      { key: 'font.noto', stack: '"Noto Sans SC", "Source Han Sans SC", "Source Han Sans CN", "PingFang SC", "Microsoft YaHei", sans-serif' },
      { key: 'font.lxgw', stack: '"LXGW WenKai", "LXGW WenKai Screen", "Kaiti SC", "KaiTi", "STKaiti", serif' },
      { key: 'font.serif', stack: '"Songti SC", "SimSun", "Noto Serif SC", Georgia, "Times New Roman", serif' },
      { key: 'font.rounded', stack: '"Yuanti SC", "YouYuan", Quicksand, "Varela Round", "PingFang SC", sans-serif' },
    ]

    const CODE_FONTS = [
      { key: 'code.follow', stack: '' },
      { key: 'code.default', stack: '"SF Mono", "JetBrains Mono", "Fira Code", Consolas, "Liberation Mono", Menlo, Courier, "PingFang SC", "Microsoft YaHei"' },
      { key: 'code.jetbrains', stack: '"JetBrains Mono", "Cascadia Code", Consolas, "Courier New", monospace' },
      { key: 'code.cascadia', stack: '"Cascadia Code", "Cascadia Mono", Consolas, "Courier New", monospace' },
      { key: 'code.fira', stack: '"Fira Code", "Fira Mono", Consolas, monospace' },
      { key: 'code.sarasa', stack: '"Sarasa Mono SC", "Sarasa Fixed SC", "Sarasa Term SC", "Noto Sans Mono CJK SC", monospace' },
      { key: 'code.menlo', stack: 'Menlo, Monaco, Consolas, "DejaVu Sans Mono", monospace' },
    ]

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

    function fontIdOf(list, stack) {
      const found = list.find((item) => item.stack === stack)
      return found ? found.stack : '__custom__'
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
      customStack: '字体栈（可直接写任意已安装字体）',
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
      custom: '自定义…',
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
      'font.follow': '跟随 DSH 默认',
      'font.system': '系统无衬线（默认栈）',
      'font.inter': 'Inter（几何无衬线）',
      'font.noto': '思源黑体 / Noto Sans SC',
      'font.lxgw': '霞鹜文楷（楷体）',
      'font.serif': '宋体 / 衬线',
      'font.rounded': '圆体',
      'code.follow': '跟随 DSH 默认',
      'code.default': '默认等宽栈（SF Mono / JetBrains / Fira）',
      'code.jetbrains': 'JetBrains Mono',
      'code.cascadia': 'Cascadia Code',
      'code.fira': 'Fira Code',
      'code.sarasa': '更纱黑体等宽 Sarasa Mono SC',
      'code.menlo': 'Menlo / Consolas',
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
      customStack: 'Font stack (any installed family)',
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
      custom: 'Custom…',
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
      'font.follow': 'Follow DSH default',
      'font.system': 'System sans (default stack)',
      'font.inter': 'Inter (geometric sans)',
      'font.noto': 'Noto Sans SC',
      'font.lxgw': 'LXGW WenKai',
      'font.serif': 'Serif',
      'font.rounded': 'Rounded',
      'code.follow': 'Follow DSH default',
      'code.default': 'Default mono stack (SF Mono / JetBrains / Fira)',
      'code.jetbrains': 'JetBrains Mono',
      'code.cascadia': 'Cascadia Code',
      'code.fira': 'Fira Code',
      'code.sarasa': 'Sarasa Mono SC',
      'code.menlo': 'Menlo / Consolas',
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

    function Select(props) {
      return h('select', {
        value: props.value,
        onChange: function (event) { props.onChange(event.target.value) },
        style: Object.assign({}, S.control, props.style),
      }, props.options.map(function (option) {
        return h('option', { key: option.value, value: option.value }, option.label)
      }))
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
            h(Select, {
              value: fontIdOf(UI_FONTS, values.uiFont),
              options: UI_FONTS.map(function (item) { return { value: item.stack, label: t(item.key) } })
                .concat([{ value: '__custom__', label: t('custom') }]),
              onChange: function (stack) { if (stack !== '__custom__') commit('uiFont', stack) },
            })),
          h(StackInput, {
            value: values.uiFont,
            placeholder: t('customStack'),
            onCommit: function (next) { commit('uiFont', next.trim()) },
          }),
          h(Row, { title: t('codeFont'), hint: t('codeFontHint') },
            h(Select, {
              value: fontIdOf(CODE_FONTS, values.codeFont),
              options: CODE_FONTS.map(function (item) { return { value: item.stack, label: t(item.key) } })
                .concat([{ value: '__custom__', label: t('custom') }]),
              onChange: function (stack) { if (stack !== '__custom__') commit('codeFont', stack) },
            })),
          h(StackInput, {
            value: values.codeFont,
            placeholder: t('customStack'),
            onCommit: function (next) { commit('codeFont', next.trim()) },
          }),
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
