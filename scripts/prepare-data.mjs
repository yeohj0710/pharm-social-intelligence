import fs from 'node:fs';
import path from 'node:path';
import Papa from 'papaparse';

const root = process.cwd();
const dataDir = path.join(root, 'public', 'data');

function readCsv(file) {
  const parsed = Papa.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''), { header: true, skipEmptyLines: true });
  if (parsed.errors.length) throw new Error(`${file}: ${JSON.stringify(parsed.errors)}`);
  return parsed;
}

function writeCsv(file, rows, fields) {
  fs.writeFileSync(file, '\uFEFF' + Papa.unparse(rows, { columns: fields, newline: '\r\n' }), 'utf8');
}

function insertAfter(fields, name, after) {
  if (fields.includes(name)) return fields;
  const index = fields.indexOf(after);
  if (index < 0) return [...fields, name];
  return [...fields.slice(0, index + 1), name, ...fields.slice(index + 1)];
}

function followerNumber(value) {
  const text = String(value ?? '').trim().replaceAll(',', '');
  if (!text) return '';
  const match = text.match(/^([0-9]+(?:\.[0-9]+)?)\s*(만|천|[kKmM])?$/);
  if (!match) return '';
  const number = Number(match[1]);
  const unit = match[2] ?? '';
  const multiplier = unit === '만' || unit.toLowerCase() === 'm' ? 10000 : unit === '천' || unit.toLowerCase() === 'k' ? 1000 : 1;
  return String(Math.round(number * multiplier));
}

function numeric(value) {
  const text = String(value ?? '').replaceAll(',', '').trim();
  return text && /^\d+(?:\.\d+)?$/.test(text) ? Number(text) : null;
}

function median(values) {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!sorted.length) return null;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function assignment(row) {
  const text = [row['카테고리'], row['소주제'], row['증상·성분키워드'], row['한줄요약']].filter(Boolean).join('·');
  const isChildcare = /육아|아이|어린이|키즈|아기|임신|출산/.test(text);
  if (isChildcare && !/여성건강|약물안전|생활습관/.test(text)) return '불가';
  const isBeauty = /뷰티|피부|화장품|앰플|스킨케어|메이크업|다이어트|체중|감량/.test(text);
  const isBeautyProduct = /뷰티|피부|화장품|앰플|스킨케어|메이크업/.test(text) && /제품|공구|구매|가격|마켓|리뷰|추천/.test(text);
  const kim = !isBeauty && !/다이어트|체중|감량/.test(text);
  const oh = !isBeautyProduct;
  const sun = true;
  const names = [];
  if (kim) names.push('김주성');
  if (oh) names.push('오약');
  if (sun) names.push('선영');
  if (kim && oh && sun) names.push('공용');
  return names.length ? names.join('·') : '불가';
}

function gate(row, account) {
  const views = numeric(row['조회수']);
  const followers = numeric(row['팔로워수치']) ?? numeric(account?.['팔로워수치']);
  const center = numeric(row['계정중앙조회수']) ?? numeric(account?.['최근12개중앙조회수']);
  if (!views || !center) return { judgment: '판정불가(지표없음)', reason: `조회수 ${views ?? '미기록'} / 중앙조회수 ${center ?? '미기록'}` };
  const multiple = views / center;
  if (multiple >= 10) return { judgment: '통과', reason: `예외(배수 ${multiple.toFixed(2)}/10 이상, 용도=형식)` };
  const type = String(account?.['계정유형'] ?? row['계정유형'] ?? '');
  if (/해외/.test(type)) return { judgment: views >= 3000000 ? '통과' : '미달', reason: `해외 기준(조회수 ${views}/${3000000})` };
  let requiredMultiple;
  let requiredViews;
  if (followers >= 50000) {
    requiredMultiple = 4;
    requiredViews = 200000;
  } else if (followers >= 10000) {
    requiredMultiple = 6;
    requiredViews = 100000;
  } else {
    requiredMultiple = 8;
    requiredViews = 50000;
  }
  const pass = multiple >= requiredMultiple && views >= requiredViews;
  const band = followers >= 50000 ? '5만 이상' : followers >= 10000 ? '1만~5만 구간' : '1만 미만 구간';
  return { judgment: pass ? '통과' : '미달', reason: `${band}(배수 ${multiple.toFixed(2)}/${requiredMultiple}, 조회수 ${views}/${requiredViews})` };
}

const accountsFile = path.join(dataDir, 'accounts.csv');
const contentsFile = path.join(dataDir, 'contents.csv');
const accountsParsed = readCsv(accountsFile);
const contentsParsed = readCsv(contentsFile);
let accounts = accountsParsed.data;
let contents = contentsParsed.data;
let accountFields = insertAfter(accountsParsed.meta.fields, '팔로워수치', '팔로워');
let contentFields = insertAfter(contentsParsed.meta.fields, '팔로워수치', '팔로워');
contentFields = insertAfter(contentFields, '게이트판정', '배정가능(김주성·오약·선영·공용·불가)');
contentFields = insertAfter(contentFields, '게이트근거', '게이트판정');

for (const row of accounts) row['팔로워수치'] = followerNumber(row['팔로워']);
for (const row of contents) row['팔로워수치'] = followerNumber(row['팔로워']);

const accountGroups = new Map();
for (const row of accounts) {
  const handle = row['핸들'];
  if (!accountGroups.has(handle)) accountGroups.set(handle, []);
  accountGroups.get(handle).push(row);
}
let merged = 0;
const deduped = [];
for (const [handle, rows] of accountGroups) {
  if (rows.length === 1) {
    deduped.push(rows[0]);
    continue;
  }
  const survivors = rows.filter(row => row['허수판정'] !== '중복');
  if (survivors.length !== 1) throw new Error(`duplicate handle ${handle} has ${survivors.length} survivors`);
  const survivor = survivors[0];
  for (const row of rows) {
    if (row === survivor) continue;
    for (const field of accountFields) {
      if (!String(survivor[field] ?? '').trim() && String(row[field] ?? '').trim()) survivor[field] = row[field];
    }
    merged += 1;
  }
  deduped.push(survivor);
}
accounts = deduped;

const accountByHandle = new Map(accounts.map(row => [row['핸들'], row]));
for (const row of contents) {
  const account = accountByHandle.get(row['계정핸들']);
  const result = gate(row, account);
  row['게이트판정'] = result.judgment;
  row['게이트근거'] = result.reason;
  row['배정가능(김주성·오약·선영·공용·불가)'] = assignment(row);
}

const adoptedByHandle = new Map();
for (const row of contents) {
  if (['A', 'B'].includes(row['등급'])) adoptedByHandle.set(row['계정핸들'], (adoptedByHandle.get(row['계정핸들']) ?? 0) + 1);
}
for (const row of accounts) row['이계정채택수'] = String(adoptedByHandle.get(row['핸들']) ?? 0);

writeCsv(accountsFile, accounts, accountFields);
writeCsv(contentsFile, contents, contentFields);

console.log(JSON.stringify({
  accountRows: accounts.length,
  contentRows: contents.length,
  followerFields: { accounts: accountFields.includes('팔로워수치'), contents: contentFields.includes('팔로워수치') },
  gateFilled: contents.filter(row => String(row['게이트판정'] ?? '').trim()).length,
  assignmentOnlyCommon: contents.filter(row => row['배정가능(김주성·오약·선영·공용·불가)'] === '공용').length,
  merged,
  adoptedAccounts: accounts.filter(row => Number(row['이계정채택수']) > 0).length,
}, null, 2));
