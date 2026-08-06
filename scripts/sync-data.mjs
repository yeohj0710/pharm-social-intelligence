// Codex 워크스페이스(G드라이브)의 원장을 저장소로 복사한다.
// 저장소 CSV는 워크스페이스에서 떠 온 스냅샷이라 자동으로 따라오지 않는다.
// 사용: npm run sync   (배포까지: npm run deploy)
//
// cpSync 는 쓰지 않는다. G: 는 구글 드라이브가 마운트한 가상 드라이브라
// cpSync 로 읽으면 노드가 0xC0000409 로 죽는다. 파일 단위로 읽고 쓴다.
import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';

// 이미지는 화면에 필요한 크기보다 크게 저장돼 있다(원본 폭 360px, 장당 29KB).
// 목록 썸네일은 48x64 CSS, 모달 스트립은 96x128 CSS 로 그리니 2x 화면 기준 192x256 이면 충분하다.
// 폭 200px · 품질 60 이면 장당 9KB 로 줄면서 훅 자막이 그대로 읽힌다.
// 원본은 G드라이브 워크스페이스에 그대로 남는다.
const IMG_WIDTH = 200;
const IMG_QUALITY = 60;

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

// 이미지는 새로 생긴 것만 줄여서 옮긴다. 이미 있는 건 다시 만들지 않는다.
// --force 를 주면 전부 다시 압축한다(압축 설정을 바꿨을 때 쓴다).
const force = process.argv.includes('--force');

async function syncImages(label, fromDir, toDir) {
  if (!existsSync(fromDir)) return;
  mkdirSync(toDir, { recursive: true });
  const have = new Set(readdirSync(toDir));
  const files = readdirSync(fromDir).filter((f) => /\.(jpe?g|png|webp)$/i.test(f));
  let added = 0;
  let bytes = 0;

  for (const file of files) {
    const out = file.replace(/\.(jpe?g|png|webp)$/i, '.jpg');
    if (!force && have.has(out)) continue;
    try {
      const buf = await sharp(join(fromDir, file))
        .resize({ width: IMG_WIDTH, withoutEnlargement: true })
        .jpeg({ quality: IMG_QUALITY, progressive: true, mozjpeg: true })
        .toBuffer();
      writeFileSync(join(toDir, out), buf);
      added += 1;
      bytes += buf.length;
    } catch (error) {
      console.warn(`  ${label} ${file} 압축 실패: ${error.message}`);
    }
  }
  if (added) changed += 1;
  const total = force ? files.length : have.size + added;
  const avg = added ? ` · 평균 ${(bytes / added / 1024).toFixed(1)}KB` : '';
  console.log(`  ${label.padEnd(14)} ${String(total).padStart(5)}개  ${added ? `${force ? '재압축' : '+'}${added}개${avg}` : '변화 없음'}`);
}

await syncImages('thumbs', join(SRC, 'public/data/thumbs'), join(DEST, 'thumbs'));
await syncImages('frames', join(SRC, 'public/data/frames'), join(DEST, 'frames'));

console.log(changed ? '\n동기화했습니다. 배포하려면 npm run deploy 를 실행하세요.' : '\n바뀐 데이터가 없습니다.');
