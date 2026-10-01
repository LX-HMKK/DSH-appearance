
const hex2rgb = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const rgb2hex = (r) => '#' + r.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0').toUpperCase()).join('');
const mix = (a, b, t) => { const A = hex2rgb(a), B = hex2rgb(b); return rgb2hex(A.map((v, i) => v + (B[i] - v) * t)); };
const srgb = (c) => { const v = c / 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
const lum = (h) => { const [r, g, b] = hex2rgb(h); return 0.2126 * srgb(r) + 0.7152 * srgb(g) + 0.0722 * srgb(b); };
const ratio = (a, b) => { const l1 = lum(a), l2 = lum(b); return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05); };

/* ---------- 主题色板：只声明"品味相关"的值，其余按角色推导 ---------- */
const THEMES = [
  {
    id: 'onedark', key: 'preset.onedark', swatch: '#61AFEF',
    light: {
      bg: '#FAFAFA', bg1: '#F0F0F1', bg2: '#E5E5E6', bg3: '#FFFFFF',
      fg: '#383A42', fg2: '#696C77', fg3: '#6F727A', fg4: '#8E8F96',
      border: '#D8D8DA', accent: '#4078F2', accentHover: '#2E62D9', link: '#4078F2',
      green: '#4A9A49', yellow: '#C18401', red: '#E45649', code: '#F0F0F1', banner: '#E5E5E6',
      syn: { comment: '#696C77', string: '#4A9A49', keyword: '#A626A4', constant: '#986801', fn: '#4078F2' },
    },
    dark: {
      bg: '#1E2227', bg1: '#23272E', bg2: '#2C313A', bg3: '#323842',
      fg: '#ABB2BF', fg2: '#9DA5B4', fg3: '#8B94A3', fg4: '#7F848E',
      border: '#3E4452', accent: '#61AFEF', accentHover: '#7BC0F5', link: '#61AFEF',
      green: '#98C379', yellow: '#E5C07B', red: '#E06C75', code: '#23272E', banner: '#2C313A',
      syn: { comment: '#7F848E', string: '#98C379', strExpr: '#ABB2BF', keyword: '#C678DD', constant: '#D19A66', fn: '#61AFEF' },
    },
  },
  {
    id: 'dracula', key: 'preset.dracula', swatch: '#BD93F9',
    light: {
      bg: '#FFFBEB', bg1: '#F4EFDC', bg2: '#E7E1CC', bg3: '#FFFFFF',
      fg: '#1F1F1F', fg2: '#6C664B', fg3: '#767051', fg4: '#8F8867',
      border: '#CFCFDE', accent: '#644AC9', accentHover: '#4E39A8', link: '#036A96',
      green: '#14710A', yellow: '#846E15', red: '#CB3A2A', code: '#F4EFDC', banner: '#E7E1CC',
      syn: { comment: '#7C7559', string: '#846E15', keyword: '#A3144D', constant: '#A34D14', fn: '#14710A' },
    },
    dark: {
      bg: '#21222C', bg1: '#282A36', bg2: '#343746', bg3: '#44475A',
      fg: '#F8F8F2', fg2: '#C3C7D1', fg3: '#9EA3B8', fg4: '#8A8FB0',
      border: '#44475A', accent: '#BD93F9', accentHover: '#CBA6FB', link: '#8BE9FD',
      green: '#50FA7B', yellow: '#F1FA8C', red: '#FF5555', code: '#282A36', banner: '#343746',
      syn: { comment: '#7B87B8', string: '#F1FA8C', strExpr: '#F8F8F2', keyword: '#FF79C6', constant: '#BD93F9', fn: '#50FA7B' },
    },
  },
  {
    id: 'nord', key: 'preset.nord', swatch: '#88C0D0',
    light: {
      bg: '#ECEFF4', bg1: '#E5E9F0', bg2: '#D8DEE9', bg3: '#FFFFFF',
      fg: '#2E3440', fg2: '#4C566A', fg3: '#5A6478', fg4: '#6C7689',
      border: '#C2CBD9', accent: '#4C6E95', accentHover: '#3F5C7D', link: '#4C6E95',
      green: '#4E7A3A', yellow: '#9A7B27', red: '#A54A52', code: '#E5E9F0', banner: '#D8DEE9',
      syn: { comment: '#5A6478', string: '#4E7A3A', keyword: '#4C6E95', constant: '#8A6BA8', fn: '#3E6E80' },
    },
    dark: {
      bg: '#2E3440', bg1: '#3B4252', bg2: '#434C5E', bg3: '#4C566A',
      fg: '#D8DEE9', fg2: '#AAB4C6', fg3: '#96A1B5', fg4: '#7B88A1',
      border: '#4C566A', accent: '#88C0D0', accentHover: '#9FCFDD', link: '#88C0D0',
      green: '#A3BE8C', yellow: '#EBCB8B', red: '#BF616A', code: '#3B4252', banner: '#434C5E',
      syn: { comment: '#8FA0B8', string: '#A3BE8C', strExpr: '#D8DEE9', keyword: '#81A1C1', constant: '#B48EAD', fn: '#88C0D0' },
    },
  },
  {
    id: 'github', key: 'preset.github', swatch: '#58A6FF',
    light: {
      bg: '#FFFFFF', bg1: '#F6F8FA', bg2: '#EAEEF2', bg3: '#FFFFFF',
      fg: '#1F2328', fg2: '#57606A', fg3: '#636C76', fg4: '#6E7781',
      border: '#D0D7DE', accent: '#0969DA', accentHover: '#0550AE', link: '#0969DA',
      green: '#1A7F37', yellow: '#9A6700', red: '#CF222E', code: '#F6F8FA', banner: '#EAEEF2',
      syn: { comment: '#6E7781', string: '#0A3069', keyword: '#CF222E', constant: '#0550AE', fn: '#8250DF' },
    },
    dark: {
      bg: '#0D1117', bg1: '#161B22', bg2: '#21262D', bg3: '#30363D',
      fg: '#E6EDF3', fg2: '#9198A1', fg3: '#848D97', fg4: '#6E7681',
      border: '#30363D', accent: '#58A6FF', accentHover: '#79C0FF', link: '#58A6FF',
      green: '#3FB950', yellow: '#D29922', red: '#F85149', code: '#161B22', banner: '#21262D',
      syn: { comment: '#8B949E', string: '#A5D6FF', strExpr: '#E6EDF3', keyword: '#FF7B72', constant: '#79C0FF', fn: '#D2A8FF' },
    },
  },
  {
    id: 'catppuccin', key: 'preset.catppuccin', swatch: '#89B4FA',
    light: {
      bg: '#EFF1F5', bg1: '#E6E9EF', bg2: '#DCE0E8', bg3: '#FFFFFF',
      fg: '#4C4F69', fg2: '#61647A', fg3: '#6A6D80', fg4: '#7C7F93',
      border: '#CCD0DA', accent: '#1E66F5', accentHover: '#0B4FD1', link: '#14708A',
      green: '#3A8F27', yellow: '#9A6410', red: '#D20F39', code: '#E6E9EF', banner: '#DCE0E8',
      syn: { comment: '#6A6D80', string: '#3A8F27', keyword: '#8839EF', constant: '#C24E00', fn: '#1E66F5' },
    },
    dark: {
      bg: '#1E1E2E', bg1: '#313244', bg2: '#45475A', bg3: '#585B70',
      fg: '#CDD6F4', fg2: '#A6ADC8', fg3: '#9399B2', fg4: '#7F849C',
      border: '#45475A', accent: '#89B4FA', accentHover: '#A3C7FB', link: '#74C7EC',
      green: '#A6E3A1', yellow: '#F9E2AF', red: '#F38BA8', code: '#181825', banner: '#1E1E2E',
      syn: { comment: '#7F849C', string: '#A6E3A1', strExpr: '#CDD6F4', keyword: '#CBA6F7', constant: '#FAB387', fn: '#89B4FA' },
    },
  },
];
const expand = (p, dark) => ({
  accent: p.accent, link: p.link, base: p.bg, layer1: p.bg1, layer2: p.bg2, layer3: p.bg3,
  ink: p.fg, secondary: p.fg2, border: p.border,
  labelTertiary: p.fg3 || mix(p.fg2, p.fg4, 0.5), labelCaption: p.fg4,
  borderL1: mix(p.border, p.bg, 0.55), borderL3: mix(p.border, p.fg, 0.14), borderL4: mix(p.border, p.fg, 0.28),
  brand: p.accent, buttonHover: p.accentHover || mix(p.accent, dark ? '#FFFFFF' : '#000000', dark ? 0.2 : 0.15), elevated: p.bg2,
  success: p.green, warn: p.yellow, error: p.red,
  codeBlock: p.code, codeBanner: p.banner || p.bg1, inlineCode: p.code,
  diffAdded: p.green + (dark ? '2E' : '26'), diffDeleted: p.red + (dark ? '2E' : '26'),
  scrollbar: mix(p.bg2, p.fg2, 0.3), scrollbarHover: mix(p.bg2, p.fg2, 0.5),
  synForeground: p.fg, synBackground: p.code, synComment: p.syn.comment, synString: p.syn.string,
  synStringExpr: p.syn.strExpr || p.syn.string, synKeyword: p.syn.keyword, synConstant: p.syn.constant,
  synFunction: p.syn.fn, synParameter: p.fg, synPunctuation: p.syn.punct || p.fg, synLink: p.link,
});
const ORDER = ['accent','link','base','layer1','layer2','layer3','ink','secondary','border','labelTertiary','labelCaption','borderL1','borderL3','borderL4','brand','buttonHover','elevated','success','warn','error','codeBlock','codeBanner','inlineCode','diffAdded','diffDeleted','scrollbar','scrollbarHover','synForeground','synBackground','synComment','synString','synStringExpr','synKeyword','synConstant','synFunction','synParameter','synPunctuation','synLink'];
let failures = 0;
for (const t of THEMES) {
  for (const mode of ['light', 'dark']) {
    const e = expand(t[mode], mode === 'dark');
    const checks = [
      ['ink/base', e.ink, e.base, 7], ['secondary/base', e.secondary, e.base, 4.5], ['tertiary/base', e.labelTertiary, e.base, 4.5],
      ['caption/base', e.labelCaption, e.base, 3], ['accent/base', e.accent, e.base, 3], ['link/base', e.link, e.base, 3],
      ['ink/layer2', e.ink, e.layer2, 4.5], ['accent/layer2', e.accent, e.layer2, 3],
      ['synFg/code', e.synForeground, e.codeBlock, 4.5], ['synComment/code', e.synComment, e.codeBlock, 3],
      ['synString/code', e.synString, e.codeBlock, 3], ['synKeyword/code', e.synKeyword, e.codeBlock, 3],
      ['synConstant/code', e.synConstant, e.codeBlock, 3], ['synFunction/code', e.synFunction, e.codeBlock, 3],
      ['success/base', e.success, e.base, 3], ['warn/base', e.warn, e.base, 3], ['error/base', e.error, e.base, 3],
    ];
    const bad = checks.filter(([, fg, bg, min]) => ratio(fg, bg) < min);
    if (bad.length) { failures += bad.length; console.log('FAIL ' + t.id + '/' + mode + ': ' + bad.map(([l, fg, bg, min]) => l + '=' + ratio(fg, bg).toFixed(2) + '<' + min).join(' ')); }
    const missing = ORDER.filter((k) => !e[k] || !/^#[0-9A-F]{6,8}$/.test(e[k]) || e[k].length !== 7 && e[k].length !== 9);
    if (missing.length) { failures++; console.log('BAD VALUE ' + t.id + '/' + mode + ': ' + missing.join(', ')); }
  }
}
console.log(failures ? 'TOTAL FAILURES: ' + failures : 'ALL PALETTES OK');
// emit literal preset entries
const fmt = (e) => {
  const lines = [];
  for (let i = 0; i < ORDER.length; i += 5) {
    lines.push('          ' + ORDER.slice(i, i + 5).map((k) => k + ": '" + e[k] + "'").join(', ') + ',');
  }
  return lines.join('\n').replace(/,$/, '');
};
const out = [];
for (const t of THEMES) {
  out.push("      {\n        id: '" + t.id + "', key: '" + t.key + "', swatch: '" + t.swatch + "',");
  out.push('        light: {\n' + fmt(expand(t.light, false)) + '\n        },');
  out.push('        dark: {\n' + fmt(expand(t.dark, true)) + '\n        },');
  out.push('      },');
}
const block = out.join('\n');
const jsonPath = process.argv[2] === '--json' ? process.argv[3] : null;
if (jsonPath) {
  require('fs').writeFileSync(jsonPath, JSON.stringify(THEMES.map((t) => ({ id: t.id, key: t.key, light: expand(t.light, false), dark: expand(t.dark, true) })), null, 1));
  console.log('wrote ' + jsonPath);
} else {
  console.log('');
  console.log('/* 把下面这段贴进 client.js 的 PRESETS 数组（default 那一行之后） */');
  console.log(block);
}
