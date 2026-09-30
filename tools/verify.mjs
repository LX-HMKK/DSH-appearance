
import fs from 'node:fs';
import path from 'node:path';

const root = process.argv[2];
const client = fs.readFileSync(path.join(root, 'client.js'), 'utf8');
const host = fs.readFileSync(path.join(root, 'index.js'), 'utf8');
/* 安装包位置：第二个参数 > DSH_ASAR 环境变量 > 本机默认路径；找不到就明确失败，不静默跳过校验。 */
const archive = process.argv[3] || process.env.DSH_ASAR || 'D:/SoftwareOfStudy/DS_H/resources/app.asar';
if (!fs.existsSync(archive)) {
  console.log('ASAR NOT FOUND: ' + archive);
  console.log('  用 node tools/verify.mjs <插件目录> <app.asar 路径>，或设环境变量 DSH_ASAR。');
  process.exit(1);
}

/* ---- 1. 抽出插件用到的 token 名 ---- */
const TOKEN = "(--dsw-[a-z0-9-]+|--ds-[a-z0-9-]+|--shiki-[a-z0-9-]+)";
const used = new Set([...client.matchAll(new RegExp("'" + TOKEN + "'", 'g'))].map((m) => m[1]));
for (const m of client.matchAll(new RegExp('var\\(' + TOKEN, 'g'))) used.add(m[1]);
for (const m of host.matchAll(new RegExp("'" + TOKEN + "'", 'g'))) used.add(m[1]);

/* ---- 2. 从安装包里取权威 token 清单 ---- */
const fd = fs.openSync(archive, 'r');
const b = Buffer.alloc(16); fs.readSync(fd, b, 0, 16, 0);
const headerSize = b.readUInt32LE(4);
const payload = Buffer.alloc(headerSize); fs.readSync(fd, payload, 0, headerSize, 8);
const jsonLen = payload.readUInt32LE(4);
const header = JSON.parse(payload.subarray(8, 8 + jsonLen).toString('utf8'));
const base = 8 + headerSize;
function find(node, prefix, target) {
  for (const [name, child] of Object.entries(node.files || {})) {
    const p = prefix ? prefix + '/' + name : name;
    if (child.files) { const r = find(child, p, target); if (r) return r; }
    else if (p === target) return child;
  }
}
function read(target) {
  const f = find(header, '', target);
  const buf = Buffer.alloc(f.size); fs.readSync(fd, buf, 0, f.size, base + Number(f.offset));
  return buf.toString('utf8');
}
const themeCss = read('dsh/node_modules/@deepseek-ai/dsh-client-ui-theme/lib/client.js');
const known = new Set([...themeCss.matchAll(/--(?:dsw|ds|shiki)-[a-z0-9-]+/g)].map((m) => m[0]));
const missing = [...used].filter((name) => !known.has(name)).sort();
console.log('TOKENS USED: ' + used.size);
console.log(missing.length ? 'MISSING IN THEME BUNDLE: ' + missing.join(', ') : 'ALL TOKENS EXIST IN THEME BUNDLE: OK');

/* ---- 3. 对比度核对（WCAG 2.1） ---- */
const srgb = (c) => { const v = c / 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
const lum = (hex) => {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), bl = parseInt(h.slice(4, 6), 16);
  return 0.2126 * srgb(r) + 0.7152 * srgb(g) + 0.0722 * srgb(bl);
};
const ratio = (a, b) => { const l1 = lum(a), l2 = lum(b); const hi = Math.max(l1, l2), lo = Math.min(l1, l2); return (hi + 0.05) / (lo + 0.05); };

const presetSrc = client.slice(client.indexOf('const PRESETS = ['), client.indexOf('/* ---------------------------------------------------------------- 纯函数'));
const presets = [];
const re = /id: '([a-z]+)', key: '[^']+', swatch: '#[0-9A-Fa-f]+',\s*light: \{([^}]+)\},\s*dark: \{([^}]+)\},\s*\}/g;
let m;
while ((m = re.exec(presetSrc))) {
  const parse = (s) => Object.fromEntries([...s.matchAll(/([a-zA-Z0-9]+): '(#[0-9A-Fa-f]{3,8})'/g)].map((x) => [x[1], x[2]]));
  presets.push({ id: m[1], light: parse(m[2]), dark: parse(m[3]) });
}
let worst = { label: '', value: 99 };
let failures = 0;
/* 护栏：源码里带 light/dark 的预设条数必须与解析出的条数一致，否则格式一改就变成
   「0 套通过」——default 预设没有 light/dark，所以按 light: { 计数而不是按 id。 */
const declaredPresets = (presetSrc.match(/light: \{/g) || []).length;
if (declaredPresets !== presets.length) {
  failures++;
  console.log('  FAIL 预设解析数量不符：源码 ' + declaredPresets + ' 个，解析出 ' + presets.length + ' 个');
}
for (const p of presets) {
  for (const mode of ['light', 'dark']) {
    const t = p[mode];
    const checks = [
      ['ink/base', t.ink, t.base, 7],
      ['secondary/base', t.secondary, t.base, 4.5],
      ['accent/base', t.accent, t.base, 3],
      ['link/base', t.link, t.base, 3],
      ['ink/layer2', t.ink, t.layer2, 4.5],
      ['accent/layer2', t.accent, t.layer2, 3],
      // 第二批 token：只有当该预设声明了这些字段时才检查
      ['tertiary/base', t.labelTertiary, t.base, 4.5],
      ['caption/base', t.labelCaption, t.base, 3],
      ['link/base', t.link, t.base, 3],
      ['success/base', t.success, t.base, 3],
      ['warn/base', t.warn, t.base, 3],
      ['error/base', t.error, t.base, 3],
      ['code-fg/code', t.synForeground, t.codeBlock, 4.5],
      ['code-comment/code', t.synComment, t.codeBlock, 3],
      ['code-string/code', t.synString, t.codeBlock, 3],
      ['code-keyword/code', t.synKeyword, t.codeBlock, 3],
      ['code-constant/code', t.synConstant, t.codeBlock, 3],
      ['code-function/code', t.synFunction, t.codeBlock, 3],
    ];
    for (const [label, fg, bg, min] of checks) {
      if (!fg || !bg) continue;
      const r = ratio(fg, bg);
      if (r < worst.value) worst = { label: p.id + '/' + mode + ' ' + label + ' ' + fg + ' on ' + bg, value: r };
      if (r < min) { failures++; console.log('  FAIL ' + p.id + ' ' + mode + ' ' + label + ' = ' + r.toFixed(2) + ' (< ' + min + ')'); }
    }
  }
}
/* ---- 4. 字体目录规模（"多放点好看的字体"） ---- */
// 每个列表内部查重（跨列表重复是合理的：同一字体可以既是界面字体又是代码字体）
const listSource = (name) => {
  const start = client.indexOf('const ' + name + ' = [');
  if (start < 0) return '';
  const end = client.indexOf('\n    ]', start);
  return client.slice(start, end);
};
let curatedTotal = 0;
let duplicateTotal = 0;
for (const name of ['UI_FONTS', 'CODE_FONTS']) {
  const families = [...listSource(name).matchAll(/family: '([^']+)'/g)].map((m) => m[1]);
  const duplicates = families.filter((f, i) => families.indexOf(f) !== i);
  curatedTotal += families.length;
  duplicateTotal += duplicates.length;
  if (duplicates.length) console.log('  FAIL ' + name + ' 内有重复条目: ' + duplicates.join(', '));
}
console.log('FONT FAMILIES CURATED: ' + curatedTotal + (duplicateTotal ? '' : '  (each list has no duplicates)'));
if (curatedTotal < 40) console.log('  WARN 精选字体少于 40 个');

/* ---- 5. 外观细节的回归护栏 ---- */
const panelLine = (client.match(/pickerPanel: \{[^\n]*/) || [''])[0];
console.log('PICKER PANEL OPAQUE: ' + (!panelLine.includes('dsw-menu-surface-fill') ? 'yes' : 'NO'));
if (panelLine.includes('dsw-menu-surface-fill')) console.log('  FAIL 下拉面板不得使用半透明菜单材质（缺 backdrop blur 会透出背景）');
const groups = ['fontGroup.cjkSans', 'fontGroup.cjkSerif', 'fontGroup.latinSans', 'fontGroup.latinSerif', 'fontGroup.mono', 'fontGroup.localCjk', 'fontGroup.localLatin'];
const missingGroups = groups.filter((key) => !client.includes("'" + key + "'"));
console.log('FONT GROUPS: ' + (missingGroups.length === 0 ? 'cjk/latin/local split OK' : 'MISSING ' + missingGroups.join(', ')));
if (missingGroups.length) console.log('  FAIL 中英文字体分组缺失');

console.log('PRESET TOKEN COVERAGE: ' + presets.map((p) => p.id + '=' + Object.keys(p.dark || {}).length).join(', '));
console.log('PRESETS CHECKED: ' + presets.map((p) => p.id).join(', '));
console.log('CONTRAST FAILURES: ' + failures);
console.log('WORST RATIO: ' + worst.value.toFixed(2) + '  (' + worst.label + ')');