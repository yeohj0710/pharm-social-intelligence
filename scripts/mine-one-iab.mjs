import fs from 'node:fs';
import path from 'node:path';
import Papa from 'papaparse';

const root = 'C:\\dev\\pharm-social-intelligence';
const queueFile = path.join(root, 'work', 'QUEUE.csv');
const accountsFile = path.join(root, 'public', 'data', 'accounts.csv');
const contentsFile = path.join(root, 'public', 'data', 'contents.csv');
const observationsFile = path.join(root, 'work', 'raw', 'observations.jsonl');

function readCsv(file) {
  const parsed = Papa.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''), { header: true, skipEmptyLines: true });
  if (parsed.errors.length) throw new Error(`${file}: ${JSON.stringify(parsed.errors)}`);
  return parsed;
}
function writeCsv(file, rows, fields) {
  fs.writeFileSync(file, '\uFEFF' + Papa.unparse(rows, { columns: fields, newline: '\r\n' }), 'utf8');
}
function parseNumber(value) {
  const text = String(value ?? '').replaceAll(',', '').trim();
  const match = text.match(/^([0-9]+(?:\.[0-9]+)?)\s*(만|천|k|m)?$/i);
  if (!match) return null;
  const unit = match[2]?.toLowerCase();
  return Math.round(Number(match[1]) * (unit === '만' || unit === 'm' ? 10000 : unit === '천' || unit === 'k' ? 1000 : 1));
}
function median(values) {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!sorted.length) return null;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}
function metric(value) {
  return Number.isFinite(value) ? (Number.isInteger(value) ? String(value) : value.toFixed(2)) : '';
}
function gate(views, followers, center, type) {
  if (!Number.isFinite(views) || !Number.isFinite(center)) return { judgment: '판정불가(지표없음)', reason: `조회수 ${Number.isFinite(views) ? views : '미기록'} / 중앙조회수 ${Number.isFinite(center) ? center : '미기록'}` };
  const multiple = views / center;
  if (multiple >= 10) return { judgment: '통과', reason: `예외(배수 ${multiple.toFixed(2)}/10 이상, 용도=형식)` };
  if (/해외/.test(type)) return { judgment: views >= 3000000 ? '통과' : '미달', reason: `해외 기준(조회수 ${views}/3000000)` };
  const requiredMultiple = followers >= 50000 ? 4 : followers >= 10000 ? 6 : 8;
  const requiredViews = followers >= 50000 ? 200000 : followers >= 10000 ? 100000 : 50000;
  const band = followers >= 50000 ? '5만 이상' : followers >= 10000 ? '1만~5만 구간' : '1만 미만 구간';
  return { judgment: views / center >= requiredMultiple && views >= requiredViews ? '통과' : '미달', reason: `${band}(배수 ${multiple.toFixed(2)}/${requiredMultiple}, 조회수 ${views}/${requiredViews})` };
}
function assignment(text) {
  if (/육아|아이|어린이|키즈|아기|임신|출산/.test(text) && !/여성건강|약물안전|생활습관/.test(text)) return '불가';
  const beauty = /뷰티|피부|화장품|앰플|스킨케어|메이크업|다이어트|체중|감량/.test(text);
  const beautyProduct = /뷰티|피부|화장품|앰플|스킨케어|메이크업/.test(text) && /제품|공구|구매|가격|마켓|리뷰|추천/.test(text);
  const kim = !beauty && !/다이어트|체중|감량/.test(text);
  const oh = !beautyProduct;
  const names = [];
  if (kim) names.push('김주성');
  if (oh) names.push('오약');
  names.push('선영');
  if (kim && oh) names.push('공용');
  return names.join('·') || '불가';
}
function appendObservations(rows) {
  if (!rows.length) return;
  fs.mkdirSync(path.dirname(observationsFile), { recursive: true });
  fs.appendFileSync(observationsFile, rows.map(row => JSON.stringify(row)).join('\n') + '\n', 'utf8');
}
function appendProgress(accounts, contents, queue) {
  const done = queue.filter(row => ['완료', '보류'].includes(row['상태'])).length;
  if (!done || done % 20 !== 0) return;
  const observed = fs.existsSync(observationsFile) ? fs.readFileSync(observationsFile, 'utf8').split(/\r?\n/).filter(Boolean).length : 0;
  const medianFilled = accounts.filter(row => String(row['최근12개중앙조회수'] ?? '').trim()).length;
  const adopted = contents.filter(row => ['A', 'B'].includes(row['등급'])).length;
  fs.appendFileSync(path.join(root, 'work', 'PROGRESS.md'), `진척 감사 ${done}개 | 완료+보류 ${done} | 중앙조회수 ${medianFilled}/368 | 관측 ${observed}건 | 채택 ${adopted}건\r\n`, 'utf8');
}
function extractProfile() {
  const url = location.href;
  const parts = url.replace(/^https?:\/\/[^/]+\//, '').split('?')[0].split('#')[0].split('/').filter(Boolean);
  const handle = parts[0] || '';
  const links = [...document.querySelectorAll('a')].map(node => ({ href: node.href, text: node.innerText.trim(), image: node.querySelector('img')?.src || '', alt: node.querySelector('img')?.alt || '' }));
  const posts = [];
  const seen = new Set();
  for (const link of links) {
    if (!link.href.includes('/reel/')) continue;
    const shortcode = link.href.split('?')[0].split('/').filter(Boolean).at(-1);
    if (!shortcode || seen.has(shortcode)) continue;
    seen.add(shortcode);
    posts.push({ handle, shortcode, url: link.href, viewDisplay: link.text, image: link.image, alt: link.alt });
    if (posts.length >= 12) break;
  }
  const body = document.body?.innerText || '';
  return { url, handle, blocked: posts.length === 0 && /로그인|가입하기|페이지를 찾을 수 없습니다|죄송합니다/.test(body), posts };
}
function extractPost() {
  const url = location.href;
  const body = document.body?.innerText || '';
  const description = document.querySelector('meta[property="og:description"]')?.getAttribute('content') || '';
  const image = document.querySelector('meta[property="og:image"]')?.getAttribute('content') || '';
  const timeNodes = [...document.querySelectorAll('time')];
  const time = timeNodes.at(-1) || timeNodes[0];
  const social = body.match(/(?:^|\n)([0-9]+(?:\.[0-9]+)?\s*(?:천|만|k|m)?)\n([0-9]+(?:\.[0-9]+)?\s*(?:천|만|k|m)?)\n\d{4}년/m);
  const exact = description.match(/^([0-9][0-9,]*) likes, ([0-9][0-9,]*) comments/);
  const videos = [...document.querySelectorAll('video')].map(node => Number.isFinite(node.duration) ? node.duration : null).filter(Number.isFinite);
  return {
    url,
    shortcode: url.split('?')[0].split('#')[0].split('/').filter(Boolean).at(-1) || '',
    blocked: /페이지를 찾을 수 없습니다|게시물을 이용할 수 없습니다|게시물이 삭제/.test(body),
    dateTime: time?.getAttribute('datetime') || '',
    likes: exact ? Number(exact[1].replaceAll(',', '')) : social ? parseNumber(social[1]) : null,
    comments: exact ? Number(exact[2].replaceAll(',', '')) : social ? parseNumber(social[2]) : null,
    lengthSec: videos[0] ?? null,
    description,
    image,
  };
}

export async function mineOneIab(tab) {
  const queueParsed = readCsv(queueFile);
  const queue = queueParsed.data;
  for (const item of queue) if (item['상태'] === '진행') item['상태'] = '대기';
  const item = queue.find(row => row['상태'] === '대기');
  if (!item) return { status: 'empty' };
  item['상태'] = '진행';
  item['시도횟수'] = String(Number(item['시도횟수'] || 0) + 1);
  writeCsv(queueFile, queue, queueParsed.meta.fields);
  const accountsParsed = readCsv(accountsFile);
  const contentsParsed = readCsv(contentsFile);
  const accounts = accountsParsed.data;
  let contents = contentsParsed.data;
  const handle = item['핸들'];
  const account = accounts.find(row => row['핸들'] === handle);
  if (!account) throw new Error(`account not found: ${handle}`);
  const finishHold = reason => {
    item['상태'] = '보류';
    item['처리일시'] = new Date().toISOString();
    item['보류사유'] = reason;
    writeCsv(queueFile, queue, queueParsed.meta.fields);
    appendProgress(accounts, contents, queue);
    return { status: '보류', handle, reason, done: queue.filter(row => ['완료', '보류'].includes(row['상태'])).length };
  };
  try {
    await tab.goto(`https://www.instagram.com/${handle}/reels/`);
    await tab.playwright.waitForTimeout(1200);
    const profile = await tab.playwright.evaluate(extractProfile);
    if (profile.blocked || !profile.posts?.length) return finishHold(profile.blocked ? '로그인 벽 또는 비공개 프로필' : '릴스 없음');
    const posts = [];
    for (const candidate of profile.posts) {
      let detail = { shortcode: candidate.shortcode, url: candidate.url, likes: null, comments: null, lengthSec: null, dateTime: '', description: '', image: '', blocked: false };
      try {
        await tab.goto(candidate.url);
        await tab.playwright.waitForTimeout(1200);
        detail = { ...detail, ...(await tab.playwright.evaluate(extractPost)) };
      } catch (error) {
        detail.error = String(error?.message || error).slice(0, 180);
      }
      detail.views = parseNumber(candidate.viewDisplay);
      posts.push({ ...detail, handle });
    }
    posts.sort((a, b) => String(b.dateTime).localeCompare(String(a.dateTime)));
    const observedAt = new Date().toISOString();
    const observations = posts.map(post => ({ 핸들: handle, shortcode: post.shortcode, 게시일: post.dateTime ? post.dateTime.slice(0, 10) : '', 조회수: Number.isFinite(post.views) ? post.views : '', 좋아요: Number.isFinite(post.likes) ? post.likes : '', 댓글: Number.isFinite(post.comments) ? post.comments : '', 길이초: Number.isFinite(post.lengthSec) ? Number(post.lengthSec.toFixed(2)) : '', 관측일시: observedAt }));
    appendObservations(observations);
    const views = observations.map(row => Number(row['조회수'])).filter(Number.isFinite);
    const center = median(views);
    const withViews = observations.filter(row => Number.isFinite(Number(row['조회수'])));
    const likesComplete = withViews.every(row => Number.isFinite(Number(row['좋아요'])));
    const likeRate = likesComplete && views.length ? withViews.reduce((sum, row) => sum + Number(row['좋아요']), 0) / views.reduce((sum, value) => sum + value, 0) : null;
    account['최근12개중앙조회수'] = center === null ? '' : metric(center);
    account['최고조회수'] = center === null ? '' : String(Math.max(...views));
    account['평소좋아요율'] = center === null || likeRate === null ? '' : likeRate.toFixed(6);
    account['마지막정면채굴일시'] = observedAt;
    account['마지막확인shortcode'] = posts[0]?.shortcode || '';
    const followers = Number(account['팔로워수치'] || item['팔로워수치']) || parseNumber(account['팔로워']);
    const type = account['계정유형'] || item['계정유형'];
    const ids = new Set(contents.map(row => row['ID']));
    const accepted = contents.filter(row => ['A', 'B'].includes(row['등급']));
    const supplementAccepted = accepted.filter(row => /영양제/.test(`${row['카테고리']} ${row['증상·성분키워드']}`)).length;
    let adopted = 0;
    for (const post of posts) {
      if (!Number.isFinite(post.views) || !Number.isFinite(center) || adopted >= 3) continue;
      const result = gate(post.views, followers, center, type);
      if (result.judgment !== '통과' || result.reason.startsWith('예외')) continue;
      const description = String(post.description || '');
      const sourceText = `${account['주력카테고리'] || ''} ${description}`;
      const supplement = /영양제|비타민|미네랄|유산균|오메가|마그네슘|프로바이오틱/.test(sourceText);
      if (supplement && accepted.length + adopted > 0 && supplementAccepted / (accepted.length + adopted) >= 0.4) continue;
      const base = `${handle}-${post.shortcode}`.replace(/[^a-zA-Z0-9_-]/g, '-');
      let id = base; let suffix = 2; while (ids.has(id)) id = `${base}-${suffix++}`; ids.add(id);
      const content = Object.fromEntries(contentsParsed.meta.fields.map(field => [field, '']));
      Object.assign(content, {
        ID: id, 발견일시: observedAt, 발견엔진: 'E1', 계정핸들: handle, 계정명: account['이름'], 팔로워: account['팔로워'], 팔로워수치: String(followers || ''), 계정유형: type, 국가: account['국가'], 게시일: post.dateTime ? post.dateTime.slice(0, 10) : '', 경과일: post.dateTime ? String(Math.max(0, Math.floor((Date.now() - Date.parse(post.dateTime)) / 86400000))) : '', 영상URL: post.url, shortcode: post.shortcode, '형식(릴스·캐러셀)': '릴스', 길이초: Number.isFinite(post.lengthSec) ? post.lengthSec.toFixed(2) : '', 조회수: String(post.views), 좋아요: Number.isFinite(post.likes) ? String(post.likes) : '', 댓글: Number.isFinite(post.comments) ? String(post.comments) : '', 계정중앙조회수: metric(center), 배수: (post.views / center).toFixed(2), 좋아요율: Number.isFinite(post.likes) ? (post.likes / post.views).toFixed(6) : '', 계정평소좋아요율: account['평소좋아요율'], 광고점수: /광고|협찬|공구|구매|할인|마켓|제품/.test(description) ? '3' : '0', 광고판정: /광고|협찬|공구|구매|할인|마켓|제품/.test(description) ? '광고·공구' : '불명', 광고근거: description.slice(0, 180) || '공개 설명 확인', 카테고리: account['주력카테고리'] || '건강정보', 소주제: description.replaceAll('\n', ' ').slice(0, 80), 진입각도: '공개 릴스 관측', '증상·성분키워드': description.replaceAll('\n', ' ').slice(0, 180), 이식후보여부: '검토', '용도(내용·형식·둘다)': '내용', '배정가능(김주성·오약·선영·공용·불가)': assignment(sourceText), 등급: 'B', 한줄요약: description.replaceAll('\n', ' ').slice(0, 140), '왜터졌나(가설)': `게이트 통과: ${result.reason}`, 사람검토: '검토', 지표수집일시: observedAt, 게이트판정: result.judgment, 게이트근거: result.reason,
      });
      contents.push(content); adopted += 1;
    }
    const adoptedByHandle = new Map();
    for (const row of contents) if (['A', 'B'].includes(row['등급'])) adoptedByHandle.set(row['계정핸들'], (adoptedByHandle.get(row['계정핸들']) || 0) + 1);
    for (const row of accounts) row['이계정채택수'] = String(adoptedByHandle.get(row['핸들']) || 0);
    item['상태'] = '완료'; item['처리일시'] = observedAt; item['보류사유'] = '';
    writeCsv(accountsFile, accounts, accountsParsed.meta.fields); writeCsv(contentsFile, contents, contentsParsed.meta.fields); writeCsv(queueFile, queue, queueParsed.meta.fields);
    appendProgress(accounts, contents, queue);
    return { status: '완료', handle, observed: observations.length, views: views.length, median: center, adopted, done: queue.filter(row => ['완료', '보류'].includes(row['상태'])).length, pending: queue.filter(row => row['상태'] === '대기').length };
  } catch (error) {
    return finishHold(`브라우저 확인 실패: ${String(error?.message || error).slice(0, 180)}`);
  }
}
