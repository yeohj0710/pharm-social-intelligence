// Codex 워크스페이스(G드라이브)의 원장을 저장소로 복사한다.
// 저장소 CSV는 워크스페이스에서 떠 온 스냅샷이라 자동으로 따라오지 않는다.
// 사용: npm run sync   (배포까지: npm run deploy)
//
// cpSync 는 쓰지 않는다. G: 는 구글 드라이브가 마운트한 가상 드라이브라
// cpSync 로 읽으면 노드가 0xC0000409 로 죽는다. 파일 단위로 읽고 쓴다.
import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const SRC = 'G:/내 드라이브/여형준님/30 인플루언서+콘텐츠 조사/국내 메디컬 콘텐츠 레퍼런스 조사/etc/01 국내 메디컬 레퍼런스 채굴 (Codex)';
const DEST = 'public/data';
const FILES = ['accounts.csv', 'contents.csv', 'formats.csv', 'topics.csv'];

if (!existsSync(SRC)) {
  console.error(`워크스페이스를 찾지 못했습니다: ${SRC}`);
  console.error('구글 드라이브 데스크톱이 켜져 있고 G: 가 연결됐는지 확인해 주세요.');
  process.exit(1);
}

const rows = (text) => { const t = text.trim(); return t ? t.split('\n').length - 1 : 0; };
const stamp = (p) => statSync(p).mtime.toISOString().slice(5, 16).replace('T', ' ');

mkdirSync(join(DEST, 'thumbs'), { recursive: true });
let changed = 0;

for (const name of FILES) {
  const from = join(SRC, 'data', name);
  const to = join(DEST, name);
  if (!existsSync(from)) { console.warn(`  ${name.padEnd(14)} 원본이 없어 건너뜁니다`); continue; }

  const next = readFileSync(from);
  const prev = existsSync(to) ? readFileSync(to) : null;
  const before = prev ? rows(prev.toString('utf8')) : 0;
  const after = rows(next.toString('utf8'));

  if (prev && prev.equals(next)) {
    console.log(`  ${name.padEnd(14)} ${String(after).padStart(5)}행  변화 없음`);
    continue;
  }
  writeFileSync(to, next);
  changed += 1;
  const delta = after - before;
  const mark = delta === 0 ? '내용만 갱신' : `${delta > 0 ? '+' : ''}${delta}행`;
  console.log(`  ${name.padEnd(14)} ${String(after).padStart(5)}행  ${mark}  (원본 ${stamp(from)})`);
}

// 썸네일은 새로 생긴 것만 옮긴다. 285개를 매번 다시 쓰면 느리다.
const thumbSrc = join(SRC, 'public/data/thumbs');
const thumbDest = join(DEST, 'thumbs');
if (existsSync(thumbSrc)) {
  const have = new Set(readdirSync(thumbDest));
  let added = 0;
  for (const file of readdirSync(thumbSrc)) {
    if (!file.toLowerCase().endsWith('.jpg') || have.has(file)) continue;
    writeFileSync(join(thumbDest, file), readFileSync(join(thumbSrc, file)));
    added += 1;
  }
  if (added) changed += 1;
  console.log(`  ${'thumbs'.padEnd(14)} ${String(have.size + added).padStart(5)}개  ${added ? `+${added}개` : '변화 없음'}`);
}

console.log(changed ? '\n동기화했습니다. 배포하려면 npm run deploy 를 실행하세요.' : '\n바뀐 데이터가 없습니다.');
