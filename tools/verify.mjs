
import fs from 'node:fs';
import path from 'node:path';

const root = process.argv[2];
const client = fs.readFileSync(path.join(root, 'client.js'), 'utf8');
const host = fs.readFileSync(path.join(root, 'index.js'), 'utf8');
const archive = process.argv[3] || 'D:/SoftwareOfStudy/DS_H/resources/app.asar';

/* ---- 1. 抽出插件用到的 token 名 ---- */
const used = new Set([...client.matchAll(/'(--dsw-[a-z0-9-]+|--ds-[a-z0-9-]+)'/g)].map((m) => m[1]));
for (const m of client.matchAll(/var\((--dsw-[a-z0-9-]+|--ds-[a-z0-9-]+)/g)) used.add(m[1]);
for (const m of host.matchAll(/'(--dsw-[a-z0-9-]+|--ds-[a-z0-9-]+)'/g)) used.add(m[1]);

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
const known = new Set([...themeCss.matchAll(/--(?:dsw|ds)-[a-z0-9-]+/g)].map((m) => m[0]));
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
  const parse = (s) => Object.fromEntries([...s.matchAll(/([a-zA-Z0-9]+): '(#[0-9A-Fa-f]{3,6})'/g)].map((x) => [x[1], x[2]]));
  presets.push({ id: m[1], light: parse(m[2]), dark: parse(m[3]) });
}
let worst = { label: '', value: 99 };
let failures = 0;
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
const families = [...client.matchAll(/\{ (?:key: '[^']+', )?family: '([^']+)'/g)].map((m) => m[1]);
const curated = families.filter((f) => f !== '');
const duplicates = curated.filter((f, i) => curated.indexOf(f) !== i);
console.log('FONT FAMILIES CURATED: ' + curated.length + (duplicates.length ? '  DUPLICATES: ' + duplicates.join(', ') : '  (no duplicates)'));
if (curated.length < 40) console.log('  WARN 精选字体少于 40 个');
if (duplicates.length) console.log('  FAIL 字体目录有重复条目');

/* ---- 5. 外观细节的回归护栏 ---- */
const panelLine = (client.match(/pickerPanel: \{[^\n]*/) || [''])[0];
console.log('PICKER PANEL OPAQUE: ' + (!panelLine.includes('dsw-menu-surface-fill') ? 'yes' : 'NO'));
if (panelLine.includes('dsw-menu-surface-fill')) console.log('  FAIL 下拉面板不得使用半透明菜单材质（缺 backdrop blur 会透出背景）');
const groups = ['fontGroup.cjkSans', 'fontGroup.cjkSerif', 'fontGroup.latinSans', 'fontGroup.latinSerif', 'fontGroup.mono', 'fontGroup.localCjk', 'fontGroup.localLatin'];
const missingGroups = groups.filter((key) => !client.includes("'" + key + "'"));
console.log('FONT GROUPS: ' + (missingGroups.length === 0 ? 'cjk/latin/local split OK' : 'MISSING ' + missingGroups.join(', ')));
if (missingGroups.length) console.log('  FAIL 中英文字体分组缺失');

console.log('PRESETS CHECKED: ' + presets.map((p) => p.id).join(', '));
console.log('CONTRAST FAILURES: ' + failures);
console.log('WORST RATIO: ' + worst.value.toFixed(2) + '  (' + worst.label + ')');