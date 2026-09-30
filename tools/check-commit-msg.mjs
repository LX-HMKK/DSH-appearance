/**
 * Angular 提交规范校验（+ 中文描述要求），由 .git/hooks/commit-msg 调用。
 * 用法: node tools/check-commit-msg.mjs <commit-msg 文件路径>
 */
import fs from 'node:fs';

const ANGULAR_TYPES = ['build', 'ci', 'docs', 'feat', 'fix', 'perf', 'refactor', 'revert', 'style', 'test', 'chore'];
const PASSTHROUGH = /^(Merge |Revert |fixup!|squash!)/;
const HEADER = /^(\w+)(?:\(([^()]+)\))?(!)?: (.+)$/;
const CJK = /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/;
const MAX_HEADER = 100;
const MAX_BODY_LINE = 100;

const file = process.argv[2];
if (!file) {
  console.error('用法: node tools/check-commit-msg.mjs <commit-msg 文件路径>');
  process.exit(2);
}

const raw = fs.readFileSync(file, 'utf8');
// 去掉注释行与尾部空白；保留正文结构
const lines = raw.split(/\r?\n/).filter((line) => !line.startsWith('#'));
while (lines.length > 0 && lines[lines.length - 1].trim() === '') lines.pop();
const header = (lines[0] || '').trimEnd();

const fail = (message) => {
  console.error('');
  console.error('✖ 提交信息不符合 Angular 规范（中文描述）：' + message);
  console.error('');
  console.error('  格式: <type>(<scope>): <中文简述>');
  console.error('  type: ' + ANGULAR_TYPES.join(' | '));
  console.error('  示例: feat(appearance): 新增配色预设与强调色取色器');
  console.error('  详见 AGENTS.md「提交规范」一节。');
  console.error('');
  process.exit(1);
};

if (PASSTHROUGH.test(header)) process.exit(0);
if (header === '') fail('提交信息为空');

const match = HEADER.exec(header);
if (!match) fail('首行不匹配 <type>(<scope>): <subject> —— ' + JSON.stringify(header));

const [, type, scope, bang, subject] = match;
if (!ANGULAR_TYPES.includes(type)) fail('未知的 type「' + type + '」，可用: ' + ANGULAR_TYPES.join(', '));
if (scope !== undefined && !/^[a-z0-9][a-z0-9./-]*$/.test(scope)) fail('scope 必须是小写字母/数字/.-/ —— ' + JSON.stringify(scope));
if (!subject || subject.trim() === '') fail('subject 为空');
if (!CJK.test(subject)) fail('subject 必须包含中文 —— ' + JSON.stringify(subject));
if (header.length > MAX_HEADER) fail('首行 ' + header.length + ' 字符，超过 ' + MAX_HEADER);
if (/[.。]$/.test(subject.trim())) fail('subject 结尾不要加句号');

// 正文：与首行之间必须空一行；单行不超过 MAX_BODY_LINE
if (lines.length > 1) {
  if (lines[1].trim() !== '') fail('正文与首行之间必须留一个空行');
  for (let i = 2; i < lines.length; i += 1) {
    if (lines[i].length > MAX_BODY_LINE) fail('正文第 ' + (i + 1) + ' 行超过 ' + MAX_BODY_LINE + ' 字符');
  }
}

if (bang === '!' && !raw.includes('BREAKING CHANGE')) {
  fail('用了 ! 标记破坏性变更，就必须在 footer 写 BREAKING CHANGE: ...');
}

console.log('✔ 提交信息符合 Angular 规范' + (scope ? '（scope: ' + scope + '）' : ''));
