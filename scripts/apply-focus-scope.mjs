import fs from 'node:fs';
import path from 'node:path';
import Papa from 'papaparse';

const root = 'C:\\dev\\pharm-social-intelligence';
const queueFile = path.join(root, 'work', 'QUEUE.csv');

const parsed = Papa.parse(fs.readFileSync(queueFile, 'utf8').replace(/^\uFEFF/, ''), {
  header: true,
  skipEmptyLines: true,
});
const queue = parsed.data;
const now = new Date().toISOString();
let excluded = 0;
let inScope = 0;

for (const row of queue) {
  if (row['상태'] !== '대기') continue;
  if (String(row['계정유형'] || '').includes('약사 인플루언서')) {
    inScope += 1;
    continue;
  }
  row['상태'] = '보류';
  row['처리일시'] = now;
  row['보류사유'] = '사용자 범위 제외: 병원·기관·메디컬 인접 계정';
  excluded += 1;
}

const csv = Papa.unparse(queue, { columns: parsed.meta.fields, newline: '\r\n' });
fs.writeFileSync(queueFile, `\uFEFF${csv}\r\n`, 'utf8');
console.log(JSON.stringify({ excluded, inScope, pending: queue.filter(row => row['상태'] === '대기').length }));
