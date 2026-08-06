import fs from 'node:fs';
import path from 'node:path';
import Papa from 'papaparse';

const root = process.cwd();
const work = path.join(root, 'work');
const raw = path.join(work, 'raw');
fs.mkdirSync(raw, { recursive: true });

const goalSource = process.argv[2];
const goalFile = path.join(work, 'GOAL.md');
const progressFile = path.join(work, 'PROGRESS.md');
const queueFile = path.join(work, 'QUEUE.csv');

if (!fs.existsSync(goalFile)) {
  if (!goalSource || !fs.existsSync(goalSource)) throw new Error('goal objective source is missing');
  fs.copyFileSync(goalSource, goalFile);
}

function readCsv(file) {
  const parsed = Papa.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''), { header: true, skipEmptyLines: true });
  if (parsed.errors.length) throw new Error(`${file}: ${JSON.stringify(parsed.errors)}`);
  return parsed;
}

function writeCsv(file, rows, fields) {
  fs.writeFileSync(file, '\uFEFF' + Papa.unparse(rows, { columns: fields, newline: '\r\n' }), 'utf8');
}

const accounts = readCsv(path.join(root, 'public/data/accounts.csv')).data;
const contents = readCsv(path.join(root, 'public/data/contents.csv')).data;
let recovery = 0;
if (fs.existsSync(queueFile)) {
  const queue = readCsv(queueFile);
  for (const row of queue.data) {
    if (row['상태'] === '진행') {
      row['상태'] = '대기';
      recovery += 1;
    }
  }
  if (recovery) writeCsv(queueFile, queue.data, queue.meta.fields);
}

const stats = {
  accounts: accounts.length,
  contents: contents.length,
  minedAccounts: new Set(contents.map(row => row['계정핸들']).filter(Boolean)).size,
  medianFilled: accounts.filter(row => String(row['최근12개중앙조회수'] ?? '').trim()).length,
  adopted: contents.filter(row => ['A', 'B'].includes(row['등급'])).length,
  queuePending: fs.existsSync(queueFile) ? readCsv(queueFile).data.filter(row => row['상태'] === '대기').length : null,
  queueRecovery: recovery,
};

if (!fs.existsSync(progressFile)) {
  fs.writeFileSync(progressFile, `세션 시작 | 계정 ${stats.minedAccounts}/368 | 관측 원장 ${stats.contents}건 | 채택 ${stats.adopted}건 | 중앙조회수 ${stats.medianFilled}/368 | 진행→대기 ${recovery}건\r\n`, 'utf8');
}

console.log(JSON.stringify(stats, null, 2));
