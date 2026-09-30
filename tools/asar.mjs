
import fs from 'node:fs';
const archive = process.argv[2];
const cmd = process.argv[3];
const arg = process.argv[4];
const arg2 = process.argv[5];
const fd = fs.openSync(archive, 'r');
const b = Buffer.alloc(16);
fs.readSync(fd, b, 0, 16, 0);
const headerSize = b.readUInt32LE(4);
const payload = Buffer.alloc(headerSize);
fs.readSync(fd, payload, 0, headerSize, 8);
const jsonLen = payload.readUInt32LE(4);
const header = JSON.parse(payload.subarray(8, 8 + jsonLen).toString('utf8'));
const base = 8 + headerSize;
function walk(node, prefix, out) {
  for (const [name, child] of Object.entries(node.files || {})) {
    const p = prefix ? prefix + '/' + name : name;
    if (child.files) walk(child, p, out);
    else out.push({ path: p, size: child.size, offset: Number(child.offset), unpacked: !!child.unpacked });
  }
}
const all = [];
walk(header, '', all);
const readFile = (f) => {
  if (f.unpacked) return fs.readFileSync(archive + '.unpacked/' + f.path);
  const buf = Buffer.alloc(f.size);
  fs.readSync(fd, buf, 0, f.size, base + f.offset);
  return buf;
};
if (cmd === 'grep') {
  const re = new RegExp(arg, 'i');
  const filter = arg2 ? new RegExp(arg2, 'i') : null;
  let hits = 0;
  const limit = Number(process.argv[6] || 120);
  const cands = all.filter((f) => /\.(ts|tsx|js|mjs|cjs|css|json|md)$/i.test(f.path) && f.size < 3_000_000 && (!filter || filter.test(f.path)));
  for (const f of cands) {
    if (hits >= limit) break;
    let text;
    try { text = readFile(f).toString('utf8'); } catch { continue; }
    const lines = text.split('\n');
    for (let i = 0; i < lines.length && hits < limit; i++) {
      if (re.test(lines[i])) { console.log(f.path + ':' + (i + 1) + ': ' + lines[i].trim().slice(0, 220)); hits++; }
    }
  }
  console.error('total hits ' + hits);
} else if (cmd === 'count') console.log('files:', all.length);
else if (cmd === 'ls') {
  const re = new RegExp(arg, 'i');
  const m = all.filter((f) => re.test(f.path));
  console.log('matched', m.length);
  for (const f of m.slice(0, Number(process.argv[5] || 300))) console.log(String(f.size).padStart(9), f.path);
} else if (cmd === 'cat') {
  const f = all.find((x) => x.path === arg);
  if (!f) { console.error('NOT FOUND ' + arg); process.exit(2); }
  process.stdout.write(readFile(f));
}
