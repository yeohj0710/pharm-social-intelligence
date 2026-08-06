import fs from 'node:fs';
import Papa from 'papaparse';

const file = 'public/data/contents.csv';
const parsed = Papa.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''), { header: true, skipEmptyLines: true });
const targets = new Set(['DbcN6jJwjJO', 'DbFt3HARR7_']);
for (const row of parsed.data) {
  if (!targets.has(row.shortcode)) continue;
  const note = '게시물 삭제·링크 무효로 썸네일 재취득 불가';
  const existing = String(row['사람메모'] ?? '').trim();
  if (!existing.includes(note)) row['사람메모'] = existing ? `${existing}; ${note}` : note;
}
fs.writeFileSync(file, '\uFEFF' + Papa.unparse(parsed.data, { columns: parsed.meta.fields, newline: '\r\n' }), 'utf8');
console.log('recorded thumbnail blocker for 2 deleted posts');
