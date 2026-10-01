
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
  useRef: (init) => ({ current: init }),
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
await scope.set('preset', 'dracula');
let last = calls.overrides[calls.overrides.length - 1];
ok('预设写入后出现强调色覆盖', last.tokens['--dsw-alias-state-business-primary'] && last.tokens['--dsw-alias-state-business-primary'].light === '#644AC9', JSON.stringify(last.tokens['--dsw-alias-state-business-primary']));
ok('覆盖层是 {light,dark} 成对结构', Object.values(last.tokens).every((v) => typeof v.light === 'string' && typeof v.dark === 'string'));
await scope.set('uiFont', 'Inter, sans-serif');
last = calls.overrides[calls.overrides.length - 1];
ok('字体写入后出现 --dsw-font-family', last.tokens['--dsw-font-family'] && last.tokens['--dsw-font-family'].light === 'Inter, sans-serif', JSON.stringify(last.tokens['--dsw-font-family']));
await scope.set('accentDark', '#00FF00');
last = calls.overrides[calls.overrides.length - 1];
ok('手填强调色盖过预设（深色档）', last.tokens['--dsw-alias-state-business-primary'].dark === '#00FF00' && last.tokens['--dsw-alias-state-business-primary'].light === '#644AC9', JSON.stringify(last.tokens['--dsw-alias-state-business-primary']));
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
const presetLabels = ['默认', 'One Dark Pro', 'Dracula', 'Nord', 'GitHub', 'Catppuccin'];
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
ok('高级区块默认折叠：不渲染 textarea 与导出占位符', !props.includes('textarea') && !props.some((p) => p.startsWith('dsh-appearance-v1:')), JSON.stringify(props.slice(0, 6)));
ok('页面里有 3 个取色器（强调色/背景色/文字色）', props.filter((p) => p === 'color').length === 3, JSON.stringify(props.slice(0, 10)));

console.log('SECTION 4b: 字体选择器');
// 旧版保存的长字体栈也要能认回家族名，且界面上不能再出现原始栈
await scope.set('uiFont', '"Noto Sans SC", "Source Han Sans SC", "Source Han Sans CN", "PingFang SC", "Microsoft YaHei", sans-serif');
const text2 = render(slot.component({ store, actions, t })).join(' | ');
ok('界面显示家族名而不是字体栈', text2.includes('思源黑体') && !text2.includes('Source Han Sans CN'), text2.slice(0, 100));
ok('没有原生 select（下拉已自绘）', !collect(slot.component({ store, actions, t }), []).includes('select'));
await scope.set('uiFont', '');
await scope.set('codeFont', '"JetBrains Mono", "Cascadia Code", Consolas, "Courier New", monospace');
const text3 = render(slot.component({ store, actions, t })).join(' | ');
ok('等宽字体同样显示家族名', text3.includes('JetBrains Mono') && !text3.includes('Cascadia Code, Consolas'), 'CODE_FONT_TEXT=' + text3.slice(0, 300));
await scope.set('codeFont', '');

console.log('SECTION 4c: 中英文字体拆分');
await scope.set('uiFont', '"Inter", "Noto Sans SC", sans-serif');
const realProps = slot.opts.inject();
const rawTree = slot.component(realProps);
const pickers = [];
(function walkTree(node) {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) return node.forEach(walkTree);
  if (typeof node.type === 'function') {
    if (node.type.name === 'FontPicker') pickers.push(node);
    return walkTree(node.type(Object.assign({}, node.props, { children: node.children })));
  }
  (node.children || []).forEach(walkTree);
})(rawTree);
ok('页面有 3 个字体选择器（英文/中文/代码）', pickers.length === 3, String(pickers.length));
const text5 = render(rawTree).join(' | ');
ok('两个框分别显示英文字体与中文字体', text5.includes('Inter') && text5.includes('思源黑体'), text5.slice(0, 80));
await pickers[1].props.onChange('LXGW WenKai');
last = calls.overrides[calls.overrides.length - 1];
const composed = last.tokens['--dsw-font-family'] && last.tokens['--dsw-font-family'].light;
ok('选中文后合成「英文在前、中文在后」', typeof composed === 'string' && composed.indexOf('"Inter"') === 0 && composed.indexOf('"LXGW WenKai"') > 0, String(composed));
await pickers[0].props.onChange('Roboto');
last = calls.overrides[calls.overrides.length - 1];
const composed2 = last.tokens['--dsw-font-family'] && last.tokens['--dsw-font-family'].light;
ok('再选英文后中文保持不变', typeof composed2 === 'string' && composed2.indexOf('"Roboto"') === 0 && composed2.indexOf('"LXGW WenKai"') > 0, String(composed2));
await scope.set('uiFont', '');

console.log('SECTION 5: 导入 / 导出 / 重置');
const exportedText = actions.exportText();
ok('导出文本带协议前缀', exportedText.startsWith('dsh-appearance-v1:'));
ok('导出文本可被 JSON 解析', (() => { try { JSON.parse(exportedText.slice('dsh-appearance-v1:'.length)); return true; } catch { return false; } })());
await scope.mutate([{ op: 'unset', path: ['preset'] }, { op: 'unset', path: ['uiFont'] }, { op: 'unset', path: ['accentDark'] }]);
last = calls.overrides[calls.overrides.length - 1];
ok('清空全部字段后覆盖层回到空', Object.keys(last.tokens).length === 0, JSON.stringify(last.tokens));
await scope.set('preset', 'nord');
last = calls.overrides[calls.overrides.length - 1];
ok('再次切换预设立即生效（回归：不再滞后一帧）', last.tokens['--dsw-alias-bg-base'] && last.tokens['--dsw-alias-bg-base'].light === '#ECEFF4', JSON.stringify(last.tokens['--dsw-alias-bg-base']));

console.log('SECTION 5b: One Dark Pro 的覆盖范围');
await scope.set('preset', 'onedark');
last = calls.overrides[calls.overrides.length - 1];
const od = last.tokens;
ok('覆盖 42 个 token（8 基础 + 30 外围与语法 + 4 static 填充）', Object.keys(od).length === 42, String(Object.keys(od).length));
ok('卡片头/悬停的 static 填充进覆盖层（另一侧保持 DSH 原值）', !!od['--dsw-static-neutral-850'] && od['--dsw-static-neutral-850'].dark === '#1B1D23' && od['--dsw-static-neutral-850'].light === '#212123' && od['--dsw-static-neutral-50'].light === '#FAFAFA' && od['--dsw-static-neutral-50'].dark === '#FAFAFA', JSON.stringify([od['--dsw-static-neutral-850'], od['--dsw-static-neutral-50']]));
ok('语法高亮关键字色进了覆盖层', !!od['--shiki-token-keyword'] && od['--shiki-token-keyword'].dark === '#C678DD', JSON.stringify(od['--shiki-token-keyword']));
ok('语法高亮是明暗成对的', !!od['--shiki-token-comment'] && od['--shiki-token-comment'].light === '#696C77' && od['--shiki-token-comment'].dark === '#7F848E', JSON.stringify(od['--shiki-token-comment']));
ok('代码块底色跟随预设', !!od['--dsw-alias-markdown-code-block'] && od['--dsw-alias-markdown-code-block'].dark === '#23272E', JSON.stringify(od['--dsw-alias-markdown-code-block']));
ok('外围 token 也进了覆盖层', !!od['--dsw-alias-label-tertiary'] && !!od['--dsw-alias-bg-layer-3'] && !!od['--dsw-alias-brand-primary']);
ok('default 预设仍然一个 token 都不覆盖', (await (async () => { await scope.set('preset', 'default'); return Object.keys(calls.overrides[calls.overrides.length - 1].tokens).length; })()) === 0);

console.log('SECTION 5c: 旧预设 id 的兜底（升级路径）');
await scope.set('preset', 'graphite');
last = calls.overrides[calls.overrides.length - 1];
ok('已删除的预设 id 不再产生任何覆盖', Object.keys(last.tokens).length === 0, JSON.stringify(Object.keys(last.tokens)));
const exportedAfterStale = JSON.parse(realProps.actions.exportText().slice('dsh-appearance-v1:'.length));
ok('导出的配置里不会留着不存在的 id', exportedAfterStale.preset === 'default', String(exportedAfterStale.preset));
ok('页面快照里同样归一成 default', realProps.store.get().values.preset === 'default', String(realProps.store.get().values.preset));
await scope.set('preset', 'default');

console.log('SECTION 6: 本机字体枚举（走真实 apply 注入的 actions/store）');
const real = realProps;
ok('注入里带 loadLocalFonts', typeof real.actions.loadLocalFonts === 'function');
globalThis.window.queryLocalFonts = async () => [{ family: 'Inter' }, { family: 'Noto Sans SC' }, { family: 'Inter' }, { family: '' }];
await real.actions.loadLocalFonts();
await new Promise((resolve) => setTimeout(resolve, 20));
ok('枚举后状态就绪并按家族去重', real.store.get().localFonts === 'ready:2', String(real.store.get().localFonts));
const text4 = render(slot.component(real)).join(' | ');
ok('枚举后页面仍可渲染', text4.includes('外观增强'));
try { await real.actions.loadLocalFonts(); ok('重复枚举是幂等的', true); } catch (error) { ok('重复枚举是幂等的', false, error.message); }

console.log('SECTION 7: 候选去重与选中态（回归：两行同名 + 两个勾）');
const collectPickers = (node, out) => {
  if (!node || typeof node !== 'object') return out;
  if (Array.isArray(node)) { node.forEach((child) => collectPickers(child, out)); return out; }
  if (typeof node.type === 'function') {
    if (node.type.name === 'FontPicker') out.push(node);
    collectPickers(node.type(Object.assign({}, node.props, { children: node.children })), out);
    return out;
  }
  (node.children || []).forEach((child) => collectPickers(child, out));
  return out;
};
const beforePick = collectPickers(slot.component(real), []);
ok('本机字体就绪后仍是 3 个选择器', beforePick.length === 3, String(beforePick.length));
const codePicker = beforePick[2];
const interOption = codePicker.props.allOptions.find((option) => option.family === 'Inter');
ok('本机枚举出的 Inter 进入候选', !!interOption, JSON.stringify(codePicker.props.allOptions.map((o) => o.family)));
// 等宽选项的栈里带着整条兜底链：旧实现拿整条栈跟家族名比，判定"当前值不在候选里"，
// 于是同一个家族被追加成第二行，两行都与当前值相等 -> 两行同名 + 两个勾。
await codePicker.props.onChange(interOption.stack);
await new Promise((resolve) => setTimeout(resolve, 10));
const codeAfter = collectPickers(slot.component(real), [])[2];
const dupeFamilies = codeAfter.props.allOptions.filter((o) => o.family).map((o) => o.family.toLowerCase());
ok('候选里同一家族只出现一行', new Set(dupeFamilies).size === dupeFamilies.length, JSON.stringify(dupeFamilies));
ok('默认短名单同样没有重复家族', codeAfter.props.options.length === new Set(codeAfter.props.options.map((o) => o.family || o.id)).size, JSON.stringify(codeAfter.props.options.map((o) => o.family)));
ok('不再追加多余的「当前值」行', !codeAfter.props.allOptions.some((o) => o.id === 'current'), JSON.stringify(codeAfter.props.allOptions.map((o) => o.id)));
const pickedValue = real.store.get().values.codeFont;
const matched = codeAfter.props.allOptions.filter((o) => o.stack === pickedValue);
ok('只有一行与当前值完全相等（只会打一个勾）', matched.length === 1, 'value=' + pickedValue + ' rows=' + JSON.stringify(codeAfter.props.allOptions.map((o) => o.family)));
await scope.set('codeFont', '');

try { fs.unlinkSync(hostTmp); } catch {}
console.log('');
console.log(failures === 0 ? 'SMOKE TEST: ALL PASS' : 'SMOKE TEST: ' + failures + ' FAILURE(S)');
process.exit(failures === 0 ? 0 : 1);