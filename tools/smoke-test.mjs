
/**
 * dsh-appearance 冒烟测试：不依赖浏览器，用假 React + 假 ctx 把
 * 「注册 -> apply -> 用户改配置 -> 覆盖层重放 -> 页面渲染 -> 导入导出」跑通。
 * 用法: node tools/smoke-test.mjs <插件目录>
 */
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = process.argv[2];
let failures = 0;
const ok = (label, cond, extra) => {
  if (cond) console.log('  PASS  ' + label);
  else { failures++; console.log('  FAIL  ' + label + (extra ? '  -> ' + extra : '')); }
};

/* ---------------- 假 React ---------------- */
const createElement = (type, props, ...children) => ({ type, props: props || {}, children: children.flat(Infinity).filter((c) => c !== null && c !== undefined && c !== false) });
const React = {
  createElement,
  useState: (init) => [typeof init === 'function' ? init() : init, () => {}],
  useEffect: () => {},
  useSyncExternalStore: (_sub, get) => get(),
};
const requireStub = (id) => { if (id === 'react') return React; throw new Error('unexpected require: ' + id); };

/* ---------------- 捕获注册 ---------------- */
let registration = null;
globalThis.window = { __ModuleLoader__: { load: (info) => { registration = info; } } };
await import(pathToFileURL(path.join(root, 'client.js')).href);

/* ---------------- 宿主半侧（剥掉 schemastery 依赖后加载） ---------------- */
console.log('SECTION 0: 宿主半侧 bootFontCss');
const hostSrc = fs.readFileSync(path.join(root, 'index.js'), 'utf8');
const schemaStub = [
  '/* schemastery stub: object(shape) -> shape, everything else chains back to itself */',
  'const Schema = new Proxy({}, { get: (_t, key) => (key === "object" ? (shape) => shape : () => Schema) });',
].join('\n');
const hostBody = hostSrc.replace(/^import .*$/gm, schemaStub);
const hostTmp = path.join(path.dirname(new URL(import.meta.url).pathname.replace(/^\//, '')), '.host-under-test.mjs');
fs.writeFileSync(hostTmp, hostBody);
const host = await import(pathToFileURL(hostTmp).href + '?t=' + Date.now());
const ref = (value) => ({ get: () => value });
ok('空配置不注入任何样式', host.bootFontCss({ uiFont: ref(''), codeFont: ref('') }) === '', JSON.stringify(host.bootFontCss({ uiFont: ref(''), codeFont: ref('') })));
const css = host.bootFontCss({ uiFont: ref('Inter, sans-serif'), codeFont: ref('"JetBrains Mono", monospace') });
ok('注入两个字体 token', css.includes('--dsw-font-family:Inter, sans-serif') && css.includes('--ds-font-family-code:"JetBrains Mono", monospace'), css);
ok('用 html:root 提高特异度（压过 base.css 的 :root）', css.startsWith('html:root{') && !css.includes('!important'), css.slice(0, 20));
ok('非 volatile 的裸值也能读', host.bootFontCss({ uiFont: 'X', codeFont: '' }) === 'html:root{--dsw-font-family:X}', host.bootFontCss({ uiFont: 'X', codeFont: '' }));

console.log('SECTION 1: 模块契约');
ok('注册了模块且 id 正确', registration && registration.id === 'dsh-appearance', registration && registration.id);
const exported = registration.factory(requireStub);
ok('导出 name', exported.name === 'appearance', exported.name);
ok('声明了四个服务依赖', JSON.stringify(exported.inject) === JSON.stringify(['slots', 'locale', 'theme', 'configForms']), JSON.stringify(exported.inject));

/* ---------------- 假 ctx ---------------- */
const zhDict = {};
const calls = { whileServed: [], slots: [], overrides: [], fontSize: [] };
let snapshot = { status: 'ready', value: {}, mode: 'host', writable: true, revision: 1 };
let subscriber = null;
const patch = (fn) => { const next = Object.assign({}, snapshot.value || {}); fn(next); snapshot = Object.assign({}, snapshot, { value: next, revision: snapshot.revision + 1 }); if (subscriber) subscriber(); };
const scope = {
  getSnapshot: () => snapshot,
  subscribe: (fn) => { subscriber = fn; return () => { subscriber = null; }; },
  set: async (field, value) => { patch((next) => { if (value === '' || value === undefined) delete next[field]; else next[field] = value; }); return true; },
  unset: async (field) => { patch((next) => { delete next[field]; }); return true; },
  mutate: async (ops) => { patch((next) => { for (const op of ops) { if (op.op === 'set') next[op.path[0]] = op.value; else delete next[op.path[0]]; } }); return true; },
};
const ctx = {
  effect: (fn) => { const d = fn(); return () => { if (typeof d === 'function') d(); }; },
  on: () => () => {},
  locale: {
    register: (ns, dict) => { Object.assign(zhDict, dict.zh); calls.localeNs = ns; return () => {}; },
    bind: (ns) => (key) => (ns === 'appearance' && Object.prototype.hasOwnProperty.call(zhDict, key) ? zhDict[key] : key),
  },
  configForms: {
    get: (id) => { calls.entryId = id; return scope; },
    whileServed: (ns, cb) => { calls.whileServed.push(ns); cb(); return () => {}; },
  },
  slots: {
    inject: (_key, cb) => { const d = cb(); return () => { if (typeof d === 'function') d(); }; },
    register: (opts, component) => { calls.slots.push({ opts, component }); return () => {}; },
  },
  theme: {
    getTheme: () => ({ fontSize: 14 }),
    overrideTokens: (source, tokens) => { calls.overrides.push({ source, tokens }); return () => {}; },
    setFontSize: (px) => { calls.fontSize.push(px); },
  },
};

console.log('SECTION 2: apply 装配');
exported.apply(ctx);
ok('命名空间取自 Loader 行 id', calls.entryId === 'dsh-appearance', calls.entryId);
ok('注册了中英文字典', calls.localeNs === 'appearance' && Object.keys(zhDict).length > 30, String(Object.keys(zhDict).length) + ' keys');
ok('等待自己的命名空间被服务', Array.isArray(calls.whileServed[0]) && calls.whileServed[0].includes('dsh-appearance'), JSON.stringify(calls.whileServed));
const slot = calls.slots[0];
ok('注册进 settings.section', slot && slot.opts.name === 'settings.section' && slot.opts.id === 'appearance', slot && JSON.stringify(slot.opts));
ok('起始覆盖层为空（默认配置不覆盖任何 token）', Object.keys(calls.overrides[0].tokens).length === 0, JSON.stringify(calls.overrides[0].tokens));

console.log('SECTION 3: 配置变化 -> 覆盖层重放');
await scope.set('preset', 'forest');
let last = calls.overrides[calls.overrides.length - 1];
ok('预设写入后出现强调色覆盖', last.tokens['--dsw-alias-state-business-primary'] && last.tokens['--dsw-alias-state-business-primary'].light === '#18794E', JSON.stringify(last.tokens['--dsw-alias-state-business-primary']));
ok('覆盖层是 {light,dark} 成对结构', Object.values(last.tokens).every((v) => typeof v.light === 'string' && typeof v.dark === 'string'));
await scope.set('uiFont', 'Inter, sans-serif');
last = calls.overrides[calls.overrides.length - 1];
ok('字体写入后出现 --dsw-font-family', last.tokens['--dsw-font-family'] && last.tokens['--dsw-font-family'].light === 'Inter, sans-serif', JSON.stringify(last.tokens['--dsw-font-family']));
await scope.set('accentDark', '#00FF00');
last = calls.overrides[calls.overrides.length - 1];
ok('手填强调色盖过预设（深色档）', last.tokens['--dsw-alias-state-business-primary'].dark === '#00FF00' && last.tokens['--dsw-alias-state-business-primary'].light === '#18794E', JSON.stringify(last.tokens['--dsw-alias-state-business-primary']));
ok('同一 source 复用（层叠语义：整层替换）', new Set(calls.overrides.map((o) => o.source)).size === 1, JSON.stringify([...new Set(calls.overrides.map((o) => o.source))]));

console.log('SECTION 4: 页面渲染');
const store = {
  get: () => ({ values: Object.assign({ preset: '', uiFont: '', codeFont: '', accentLight: '', accentDark: '', surfaceLight: '', surfaceDark: '', inkLight: '', inkDark: '' }, scope.getSnapshot().value), status: 'ready', mode: 'host', writable: true, fontSize: 14 }),
  subscribe: () => () => {},
};
const actions = {
  write: (f, v) => scope.set(f, v), setFontSize: (px) => ctx.theme.setFontSize(px),
  exportText: () => 'dsh-appearance-v1:' + JSON.stringify(scope.getSnapshot().value),
  applyImport: async () => true, resetAll: async () => true,
};
const t = ctx.locale.bind('appearance');
function render(node) {
  if (node === null || node === undefined || node === false) return [];
  if (typeof node === 'string' || typeof node === 'number') return [String(node)];
  if (Array.isArray(node)) return node.flatMap(render);
  if (typeof node.type === 'function') return render(node.type(Object.assign({}, node.props, { children: node.children })));
  return node.children.flatMap(render);
}
let text = '';
try { text = render(slot.component({ store, actions, t })).join(' | '); }
catch (error) { failures++; console.log('  FAIL  页面渲染抛错 -> ' + error.message); }
ok('渲染出了标题', text.includes('外观增强'));
ok('渲染出了三张卡片', text.includes('字体') && text.includes('配色') && text.includes('高级'));
const presetLabels = ['默认', '石墨', '深海', '暖沙', '森绿', '高对比'];
ok('渲染出了全部 6 个预设', presetLabels.every((label) => text.includes(label)), presetLabels.filter((l) => !text.includes(l)).join(',') || 'all present');
ok('渲染出了字号步进器', /14 px/.test(text));
const tree = slot.component({ store, actions, t });
const collect = (node, out) => {
  if (node === null || node === undefined || node === false) return out;
  if (typeof node === 'string' || typeof node === 'number') return out;
  if (Array.isArray(node)) { node.forEach((n) => collect(n, out)); return out; }
  if (typeof node.type === 'function') return collect(node.type(Object.assign({}, node.props, { children: node.children })), out);
  if (node.props && typeof node.props === 'object') {
    if (typeof node.props.placeholder === 'string') out.push(node.props.placeholder);
    if (node.type === 'textarea' || node.type === 'input') out.push(String(node.props.type || node.type));
  }
  (node.children || []).forEach((n) => collect(n, out));
  return out;
};
const props = collect(tree, []);
ok('导出前缀出现在 textarea 占位符', props.some((p) => p.startsWith('dsh-appearance-v1:')), JSON.stringify(props.slice(0, 4)));
ok('页面里有 textarea 与 3 个取色器', props.includes('textarea') && props.filter((p) => p === 'color').length === 3, JSON.stringify(props.slice(0, 10)));

console.log('SECTION 5: 导入 / 导出 / 重置');
const exportedText = actions.exportText();
ok('导出文本带协议前缀', exportedText.startsWith('dsh-appearance-v1:'));
ok('导出文本可被 JSON 解析', (() => { try { JSON.parse(exportedText.slice('dsh-appearance-v1:'.length)); return true; } catch { return false; } })());
await scope.mutate([{ op: 'unset', path: ['preset'] }, { op: 'unset', path: ['uiFont'] }, { op: 'unset', path: ['accentDark'] }]);
last = calls.overrides[calls.overrides.length - 1];
ok('清空全部字段后覆盖层回到空', Object.keys(last.tokens).length === 0, JSON.stringify(last.tokens));
await scope.set('preset', 'graphite');
last = calls.overrides[calls.overrides.length - 1];
ok('再次切换预设立即生效（回归：不再滞后一帧）', last.tokens['--dsw-alias-bg-base'] && last.tokens['--dsw-alias-bg-base'].light === '#FFFFFF', JSON.stringify(last.tokens['--dsw-alias-bg-base']));

try { fs.unlinkSync(hostTmp); } catch {}
console.log('');
console.log(failures === 0 ? 'SMOKE TEST: ALL PASS' : 'SMOKE TEST: ' + failures + ' FAILURE(S)');
process.exit(failures === 0 ? 0 : 1);