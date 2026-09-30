/**
 * 安装仓库的 git 钩子（钩子目录不受版本控制，所以新克隆后跑一次）。
 * 用法: node tools/install-hooks.mjs  或  npm run hooks:install
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const root = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
const hookDir = path.join(root, '.git', 'hooks');
fs.mkdirSync(hookDir, { recursive: true });

const hooks = {
  'commit-msg': [
    '#!/bin/sh',
    '# Angular 提交规范 + 中文描述校验（见 AGENTS.md）',
    'node "$(git rev-parse --show-toplevel)/tools/check-commit-msg.mjs" "$1"',
    '',
  ].join('\n'),
};

for (const [name, body] of Object.entries(hooks)) {
  const target = path.join(hookDir, name);
  fs.writeFileSync(target, body, { mode: 0o755 });
  try { fs.chmodSync(target, 0o755); } catch { /* Windows 上无所谓 */ }
  console.log('installed .git/hooks/' + name);
}
