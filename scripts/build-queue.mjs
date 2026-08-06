import fs from 'node:fs';
import path from 'node:path';
import Papa from 'papaparse';

const root = process.cwd();
const read = file => {
  const parsed = Papa.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''), { header: true, skipEmptyLines: true });
  if (parsed.errors.length) throw new Error(`${file}: ${JSON.stringify(parsed.errors)}`);
  return parsed.data;
};
const followerNumber = value => {
  const text = String(value ?? '').trim().replaceAll(',', '');
  const match = text.match(/^([0-9]+(?:\.[0-9]+)?)\s*(만|천|[kKmM])?$/);
  if (!match) return 0;
  const multiplier = match[2] === '만' || match[2]?.toLowerCase() === 'm' ? 10000 : match[2] === '천' || match[2]?.toLowerCase() === 'k' ? 1000 : 1;
  return Math.round(Number(match[1]) * multiplier);
};
const accounts = read(path.join(root, 'public/data/accounts.csv'));
const contents = read(path.join(root, 'public/data/contents.csv'));
const mined = new Set(contents.map(row => row['계정핸들']).filter(Boolean));
const rows = accounts
  .filter(row => !mined.has(row['핸들']))
  .map(row => {
    const type = String(row['계정유형'] ?? '');
    const followers = Number(row['팔로워수치']) || followerNumber(row['팔로워']);
    let priority;
    if (type === '국내 약사 인플루언서') priority = followers >= 10000 ? 1 : 2;
    else if (type === '국내 메디컬 인접 계정') priority = 3;
    else priority = 4;
    return {
      순번: 0,
      핸들: row['핸들'],
      계정유형: type,
      팔로워수치: String(followers || ''),
      우선순위: String(priority),
      상태: '대기',
      시도횟수: '0',
      처리일시: '',
      보류사유: '',
    };
  })
  .sort((a, b) => Number(a['우선순위']) - Number(b['우선순위']) || Number(b['팔로워수치'] || 0) - Number(a['팔로워수치'] || 0) || a['핸들'].localeCompare(b['핸들']));
rows.forEach((row, index) => { row['순번'] = String(index + 1); });
const fields = ['순번', '핸들', '계정유형', '팔로워수치', '우선순위', '상태', '시도횟수', '처리일시', '보류사유'];
fs.writeFileSync(path.join(root, 'work/QUEUE.csv'), '\uFEFF' + Papa.unparse(rows, { columns: fields, newline: '\r\n' }), 'utf8');
console.log(JSON.stringify({ queueRows: rows.length, byPriority: Object.fromEntries([1, 2, 3, 4].map(p => [p, rows.filter(row => row['우선순위'] === String(p)).length])) }, null, 2));
