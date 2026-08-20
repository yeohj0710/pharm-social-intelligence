// 빌드 결과물(dist)을 pharm-social-intelligence 프로젝트로 올린다.
//
// 저장소 루트에서 `vercel --prod`를 치면 Output Directory 기본값이 public 이라
// index.html 없는 데이터 폴더만 올라가 사이트가 깨진다.
// `vercel deploy dist --prod`를 치면 dist 라는 이름의 새 프로젝트가 만들어진다.
// 둘 다 실제로 겪은 사고라 배포는 이 스크립트로만 한다.
//
// vite build 가 dist 를 매번 비우므로 .vercel 링크를 그때마다 다시 넣는다.

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { dirname, join, relative } from 'node:path';

if (!existsSync('dist/index.html')) {
  console.error('dist/index.html 이 없다. npm run build 를 먼저 한다.');
  process.exit(1);
}

if (!existsSync('.vercel/project.json')) {
  console.error('.vercel/project.json 이 없다. 프로젝트 링크가 풀렸다.');
  process.exit(1);
}

function filesUnder(dir) {
  if (!existsSync(dir)) return [];
  const files = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) files.push(...filesUnder(path));
    else files.push(path);
  }
  return files;
}

function payloadHash() {
  const paths = [
    ...filesUnder('dist'),
    'vercel.json',
    '.vercel/project.json',
  ].filter(existsSync).sort();
  const hash = createHash('sha256');
  for (const path of paths) {
    hash.update(relative('.', path).replaceAll('\\', '/'));
    hash.update('\0');
    hash.update(readFileSync(path));
    hash.update('\0');
  }
  return hash.digest('hex');
}

const state = join('etc', 'codex-deploy-state', 'pharm-social.sha256');
const current = payloadHash();
const previous = existsSync(state) ? readFileSync(state, 'utf8').trim() : '';
if (current === previous) {
  console.log('배포할 변경 없음 — Vercel 배포를 건너뛴다.');
  process.exit(0);
}
if (process.argv.includes('--check')) {
  console.log('배포 산출물이 바뀌었다 — 실제 배포는 실행하지 않았다.');
  process.exit(0);
}

// Node 24 는 윈도우에서 .cmd 를 직접 못 띄운다(EINVAL).
// 이미 만든 dist 를 로컬에서 Vercel 산출물로 만든 뒤 prebuilt 로 올려
// 같은 payload를 Vercel에서 다시 빌드하지 않는다.
execSync('npx vercel build --prod --yes', { cwd: '.', stdio: 'inherit' });
execSync('npx vercel deploy --prebuilt --prod --yes', { cwd: '.', stdio: 'inherit' });
mkdirSync(dirname(state), { recursive: true });
writeFileSync(state, `${current}\n`, 'utf8');
