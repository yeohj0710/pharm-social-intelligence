// 빌드 결과물(dist)을 pharm-social-intelligence 프로젝트로 올린다.
//
// 저장소 루트에서 `vercel --prod`를 치면 Output Directory 기본값이 public 이라
// index.html 없는 데이터 폴더만 올라가 사이트가 깨진다.
// `vercel deploy dist --prod`를 치면 dist 라는 이름의 새 프로젝트가 만들어진다.
// 둘 다 실제로 겪은 사고라 배포는 이 스크립트로만 한다.
//
// vite build 가 dist 를 매번 비우므로 .vercel 링크를 그때마다 다시 넣는다.

import { cpSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';

if (!existsSync('dist/index.html')) {
  console.error('dist/index.html 이 없다. npm run build 를 먼저 한다.');
  process.exit(1);
}

if (!existsSync('.vercel/project.json')) {
  console.error('.vercel/project.json 이 없다. 프로젝트 링크가 풀렸다.');
  process.exit(1);
}

cpSync('.vercel', 'dist/.vercel', { recursive: true });

// Node 24 는 윈도우에서 .cmd 를 직접 못 띄운다(EINVAL).
// 인자 배열 대신 명령 한 줄을 셸에 넘긴다.
execSync('npx vercel deploy --prod --yes', { cwd: 'dist', stdio: 'inherit' });
