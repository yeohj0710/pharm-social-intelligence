import fs from 'node:fs';

const text = process.argv.slice(2).join(' ');
if (!text) throw new Error('progress text required');
fs.appendFileSync('work/PROGRESS.md', `${text}\r\n`, 'utf8');
console.log(text);
