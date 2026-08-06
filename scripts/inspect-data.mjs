import fs from 'node:fs';
import Papa from 'papaparse';

function readCsv(file) {
  const source = fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '');
  return Papa.parse(source, { header: true, skipEmptyLines: true });
}

const accounts = readCsv('public/data/accounts.csv');
const contents = readCsv('public/data/contents.csv');

const countFilled = (rows, field) => rows.filter(row => String(row[field] ?? '').trim() !== '').length;
const countValue = (rows, field, value) => rows.filter(row => String(row[field] ?? '').trim() === value).length;
const frequency = (rows, field) => rows.reduce((out, row) => {
  const value = String(row[field] ?? '');
  out[value] = (out[value] ?? 0) + 1;
  return out;
}, {});

console.log(JSON.stringify({
  accounts: {
    rows: accounts.data.length,
    fields: accounts.meta.fields,
    medianFilled: countFilled(accounts.data, '최근12개중앙조회수'),
    maxFilled: countFilled(accounts.data, '최고조회수'),
    likeRateFilled: countFilled(accounts.data, '평소좋아요율'),
    adoptedCountFilled: countFilled(accounts.data, '이계정채택수'),
    adoptedNonZero: accounts.data.filter(row => Number(row['이계정채택수']) > 0).length,
  },
  contents: {
    rows: contents.data.length,
    fields: contents.meta.fields,
    handles: [...new Set(contents.data.map(row => row['계정핸들']))],
    viewsFilled: countFilled(contents.data, '조회수'),
    likesFilled: countFilled(contents.data, '좋아요'),
    viewsEmpty: countValue(contents.data, '조회수', ''),
    likesZero: countValue(contents.data, '좋아요', '0'),
    gateField: contents.meta.fields.includes('게이트판정'),
    gateFilled: contents.meta.fields.includes('게이트판정') ? countFilled(contents.data, '게이트판정') : 0,
    assignments: frequency(contents.data, '배정가능(김주성·오약·선영·공용·불가)'),
    grades: frequency(contents.data, '등급'),
  },
}, null, 2));
