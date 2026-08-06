import fs from 'node:fs';
import Papa from 'papaparse';

const handle = process.argv[2];
const file = 'work/QUEUE.csv';
const parsed = Papa.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''), { header: true, skipEmptyLines: true });
const row = parsed.data.find(item => item['핸들'] === handle);
if (!row) throw new Error(`queue row not found: ${handle}`);
row['상태'] = '대기';
row['시도횟수'] = '0';
row['처리일시'] = '';
row['보류사유'] = '';
fs.writeFileSync(file, '\uFEFF' + Papa.unparse(parsed.data, { columns: parsed.meta.fields, newline: '\r\n' }), 'utf8');
console.log(`reset ${handle}`);
