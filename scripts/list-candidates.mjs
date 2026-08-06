import fs from 'node:fs';
import Papa from 'papaparse';

const read = file => Papa.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''), { header: true, skipEmptyLines: true }).data;
const rows = read('public/data/contents.csv');
const missingThumb = rows.filter(row => !row['썸네일파일'] || !fs.existsSync(`public/data/thumbs/${row['썸네일파일']}`));
const reelNoViews = rows.filter(row => row['형식(릴스·캐러셀)'] === '릴스' && !String(row['조회수'] ?? '').trim());
const zeroLikes = rows.filter(row => String(row['좋아요'] ?? '').trim() === '0');
console.log(JSON.stringify({
  missingThumb: missingThumb.map(row => ({ handle: row['계정핸들'], shortcode: row.shortcode, thumbnail: row['썸네일파일'], url: row['영상URL'] })),
  reelNoViews: reelNoViews.map(row => ({ handle: row['계정핸들'], shortcode: row.shortcode, url: row['영상URL'], likes: row['좋아요'], note: row['사람메모'] })),
  zeroLikes: zeroLikes.map(row => ({ handle: row['계정핸들'], shortcode: row.shortcode, url: row['영상URL'], views: row['조회수'], note: row['사람메모'] })),
}, null, 2));
