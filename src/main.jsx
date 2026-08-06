import { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import Papa from 'papaparse';
import { ArrowUpRight, Menu, Search, X } from 'lucide-react';
import './styles.css';

const DATA_FILES = {
  accounts: '/data/accounts.csv',
  contents: '/data/contents.csv',
  formats: '/data/formats.csv',
  topics: '/data/topics.csv',
};

const NAV_ITEMS = [
  { id: 'overview', label: '요약' },
  { id: 'contents', label: '콘텐츠 목록', key: 'contents' },
  { id: 'accounts', label: '인플루언서 목록', key: 'accounts' },
  { id: 'formats', label: '포맷 목록', key: 'formats' },
  { id: 'topics', label: '주제 목록', key: 'topics' },
];

/* ---------- 값 다루기 ---------- */

function metricValue(value) {
  if (value === null || value === undefined || value === '') return 0;
  const raw = String(value).replace(/,/g, '').trim().toLowerCase();
  const number = Number.parseFloat(raw.replace(/[가-힣a-z]+/g, ''));
  if (!Number.isFinite(number)) return 0;
  if (raw.includes('만')) return number * 10000;
  if (raw.includes('천') || raw.includes('k')) return number * 1000;
  if (raw.includes('m')) return number * 1000000;
  return number;
}

// 원본에 값이 없으면 null. 0과 미기록을 섞지 않는다.
function numberOrNull(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return null;
  const number = Number(raw.replace(/,/g, ''));
  return Number.isFinite(number) ? number : null;
}

function display(value, fallback = '미기록') {
  return value === null || value === undefined || String(value).trim() === '' ? fallback : value;
}

function formatCount(value) {
  if (value === null) return '미기록';
  if (value >= 10000) {
    const man = value / 10000;
    return `${man >= 100 ? Math.round(man) : man.toFixed(1).replace(/\.0$/, '')}만`;
  }
  return value.toLocaleString('ko-KR');
}

function formatMultiple(value) {
  if (value === null) return null;
  if (value >= 100) return `${Math.round(value)}배`;
  if (value >= 10) return `${value.toFixed(0)}배`;
  if (value >= 1) return `${value.toFixed(1)}배`;
  return `${value.toFixed(2)}배`;
}

// 배수 구간. 화면 위계의 기준이다.
function multipleTone(value) {
  if (value === null) return 'none';
  if (value >= 50) return 'peak';
  if (value >= 10) return 'hot';
  if (value >= 3) return 'high';
  if (value >= 1) return 'mid';
  return 'low';
}

// 경과일 → 게시일 → 미기록. 원본에 없으면 날짜를 지어내지 않는다.
function displayAge(age, date) {
  const raw = String(age ?? '').trim();
  if (/^\d+(\.\d+)?$/.test(raw)) {
    const days = Number(raw);
    if (days < 14) return `${days}일 전`;
    if (days < 60) return `${Math.round(days / 7)}주 전`;
    if (days < 365) return `${Math.round(days / 30)}개월 전`;
    return `${(days / 365).toFixed(1)}년 전`;
  }
  if (raw) return raw.endsWith('전') ? raw : `${raw} 전`;
  return display(date);
}

// "영양제·이너뷰티·증상" 같은 복합 표기를 키워드로 쪼갠다.
function categoryKeywords(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return [];
  return raw.split(/[·/,]/).map((part) => part.trim()).filter(Boolean);
}

function median(numbers) {
  if (!numbers.length) return null;
  const sorted = [...numbers].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function parseCsv(path) {
  return new Promise((resolve, reject) => {
    Papa.parse(path, {
      download: true,
      header: true,
      skipEmptyLines: true,
      complete: (results) => resolve(results.data),
      error: reject,
    });
  });
}

function instagramUrl(handle) {
  if (!handle) return '#';
  return `https://www.instagram.com/${String(handle).replace(/^@/, '').trim()}/`;
}

function normalizeData(raw) {
  // 계정 원장에 핸들이 중복된 행이 있어 렌더 키는 행 번호로 따로 만든다.
  const accounts = raw.accounts.map((row, index) => ({
    kind: 'account',
    uid: `account-${index}`,
    id: row['핸들'],
    handle: row['핸들'],
    name: row['이름'],
    type: row['계정유형'],
    country: row['국가'],
    followers: row['팔로워'],
    followerValue: numberOrNull(row['팔로워수치']) ?? metricValue(row['팔로워']),
    posts: row['게시물수'],
    category: row['주력카테고리'],
    medianViews: numberOrNull(row['최근12개중앙조회수']),
    topViews: numberOrNull(row['최고조회수']),
    adoptedCount: numberOrNull(row['이계정채택수']),
    assignment: row['배정적합(김·오·선)'],
    grade: row['등급(S·A·B·제외)'],
    status: row['허수판정'],
    source: row['발굴경로(엔진·시드계정)'],
    note: row['사람메모'],
    link: instagramUrl(row['핸들']),
  }));

  const contents = raw.contents.map((row, index) => {
    const views = numberOrNull(row['조회수']);
    const multiple = numberOrNull(row['배수']);
    const thumb = String(row['썸네일파일'] ?? '').trim();
    return {
      kind: 'content',
      uid: `content-${index}`,
      id: row.ID,
      handle: row['계정핸들'],
      name: row['계정명'],
      followers: row['팔로워'],
      followerValue: numberOrNull(row['팔로워수치']) ?? metricValue(row['팔로워']),
      type: row['계정유형'],
      date: row['게시일'],
      age: row['경과일'],
      ageValue: numberOrNull(row['경과일']),
      url: row['영상URL'] || instagramUrl(row['계정핸들']),
      format: row['형식(릴스·캐러셀)'],
      seconds: numberOrNull(row['길이초']),
      views,
      viewSort: views ?? -1,
      likes: numberOrNull(row['좋아요']),
      comments: numberOrNull(row['댓글']),
      medianViews: numberOrNull(row['계정중앙조회수']),
      multiple,
      multipleSort: multiple ?? -1,
      thumb: thumb ? `/data/thumbs/${thumb}` : '',
      metricAt: row['지표수집일시'],
      category: row['카테고리'],
      keywords: categoryKeywords(row['카테고리']),
      subtopic: row['소주제'],
      angle: row['진입각도'],
      formatId: row['포맷ID'],
      hookType: row['훅유형'],
      hook: row['훅문구(첫3초 자막 원문)'],
      structure: row['구조'],
      edit: row['편집장치'],
      summary: row['한줄요약'],
      why: row['왜터졌나(가설)'],
      suggestions: row['우리버전제안(훅 문구 3개)'],
      ad: row['광고판정'],
      assignment: row['배정가능(김주성·오약·선영·공용·불가)'],
      grade: row['등급'],
      gateJudgment: row['게이트판정'],
      gateReason: row['게이트근거'],
      note: row['사람메모'],
    };
  });

  const formats = raw.formats.map((row, index) => ({
    kind: 'format',
    uid: `format-${index}`,
    id: row['포맷ID'],
    title: row['포맷명'],
    definition: row['한줄정의'],
    hookType: row['훅유형'],
    structure: row['구조(비트 단위로 초 배분까지)'],
    length: row['길이대'],
    edit: row['편집장치'],
    filming: row['촬영'],
    difficulty: row['제작난이도(상·중·하)'],
    portability: row['이식가능성(상·중·하)'],
    reason: row['이식근거'],
    adaptation: row['각색안'],
    topics: row['어떤주제와붙나'],
    people: row['배정적합인물'],
    status: row['상태'],
    examples: row['대표영상URL 3개'],
  }));

  const topics = raw.topics.map((row, index) => ({
    kind: 'topic',
    uid: `topic-${index}`,
    id: row['주제ID'],
    title: row['주제'],
    angle: row['진입각도'],
    category: row['카테고리'],
    keywords: row['관련증상·성분'],
    usage: row['국내사용횟수'],
    maxMultiplier: row['최고배수'],
    example: row['대표영상URL'],
    recent: row['최근사용일'],
    saturation: row['소진도'],
    controversy: row['논쟁성(상·중·하)'],
    authority: row['약사권위활용도(상·중·하)'],
    product: row['제품연결가능성'],
    people: row['배정가능인물'],
    status: row['상태'],
  }));

  // 포맷별 성과는 콘텐츠에서 계산한다.
  const byFormat = new Map();
  contents.forEach((item) => {
    if (!item.formatId || item.multiple === null) return;
    if (!byFormat.has(item.formatId)) byFormat.set(item.formatId, []);
    byFormat.get(item.formatId).push(item.multiple);
  });
  formats.forEach((format) => {
    const values = byFormat.get(format.id) || [];
    format.sampleCount = values.length;
    format.medianMultiple = median(values);
    format.topMultiple = values.length ? Math.max(...values) : null;
  });

  return { accounts, contents, formats, topics };
}

/* ---------- 조각 ---------- */

function Multiple({ value, size = 'md' }) {
  const tone = multipleTone(value);
  const label = formatMultiple(value);
  return (
    <span className={`mult mult-${tone} mult-${size}`}>
      {label === null ? <em>미기록</em> : label}
    </span>
  );
}

function Thumb({ src, alt, format }) {
  if (!src) return <div className="thumb thumb-empty"><span>{format === '캐러셀' ? '캐' : '릴'}</span></div>;
  return <img className="thumb" src={src} alt={alt} loading="lazy" />;
}

function InstagramLink({ href, label }) {
  return (
    <a className="ig-link" href={href} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()} aria-label={`${label} 원본 Instagram 열기`}>
      Instagram <ArrowUpRight size={13} />
    </a>
  );
}

function ContentRow({ item, onOpen, compact = false }) {
  const name = display(item.name);
  return (
    <button className={`crow ${compact ? 'crow-compact' : ''}`} onClick={() => onOpen(item)}>
      <Thumb src={item.thumb} alt="" format={item.format} />
      <div className="crow-copy">
        <strong className="crow-hook">{display(item.hook, display(item.summary, '훅 문구 미기록'))}</strong>
        <span className="crow-summary">{display(item.summary)}</span>
        <span className="crow-meta">
          <span className="crow-name">{name}</span>
          <span className="crow-dot">·</span>
          <span className="crow-when">{displayAge(item.age, item.date)}</span>
          <span className="crow-dot">·</span>
          <span className="crow-format">{display(item.format)}</span>
        </span>
      </div>
      <div className="cell cell-mult"><span className="cell-label">배수</span><Multiple value={item.multiple} /></div>
      <div className="cell cell-views"><span className="cell-label">조회수</span><b>{formatCount(item.views)}</b></div>
      {!compact && (
        <>
          <div className="cell cell-likes"><span className="cell-label">좋아요</span><b>{formatCount(item.likes)}</b></div>
          <div className="cell cell-comments"><span className="cell-label">댓글</span><b>{formatCount(item.comments)}</b></div>
          <div className="cell cell-link"><InstagramLink href={item.url} label={name} /></div>
        </>
      )}
    </button>
  );
}

// 목록 머리말은 행과 같은 격자를 써야 열이 어긋나지 않는다.
function ContentListHead() {
  return (
    <div className="crow crow-head">
      <span />
      <span>콘텐츠</span>
      <span className="cell cell-mult">배수</span>
      <span className="cell cell-views">조회수</span>
      <span className="cell cell-likes">좋아요</span>
      <span className="cell cell-comments">댓글</span>
      <span className="cell cell-link">원본</span>
    </div>
  );
}

function Chips({ options, value, onChange, allLabel = '전체' }) {
  return (
    <div className="chips">
      <button className={value === 'all' ? 'chip on' : 'chip'} onClick={() => onChange('all')}>{allLabel}</button>
      {options.map(([label, count]) => (
        <button key={label} className={value === label ? 'chip on' : 'chip'} onClick={() => onChange(label)}>
          {label}<em>{count}</em>
        </button>
      ))}
    </div>
  );
}

function SortTabs({ value, onChange, options }) {
  return (
    <div className="sort-tabs" role="group" aria-label="정렬 기준">
      {options.map(([id, label]) => (
        <button key={id} className={value === id ? 'on' : ''} onClick={() => onChange(id)} aria-pressed={value === id}>{label}</button>
      ))}
    </div>
  );
}

function EmptyState({ label }) {
  return <div className="empty"><strong>{label} 데이터가 없습니다</strong><span>검색어나 필터를 바꿔보세요.</span></div>;
}

function PageHead({ kicker, title, description, children }) {
  return (
    <div className="head">
      <div className="head-copy">
        <div className="kicker">{kicker}</div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {children}
    </div>
  );
}

/* ---------- 상세 ---------- */

function DetailSection({ label, value }) {
  return <div className="dsection"><span>{label}</span><p>{display(value)}</p></div>;
}

function DetailModal({ item, onClose, onNavigate, onOpenFormat }) {
  if (!item) return null;
  const isAccount = item.kind === 'account';
  const isContent = item.kind === 'content';
  const isFormat = item.kind === 'format';
  const kicker = isAccount ? '인플루언서 상세' : isContent ? '콘텐츠 상세' : isFormat ? '포맷 상세' : '주제 상세';
  return (
    <div className="backdrop" onMouseDown={onClose}>
      <div className="modal" onMouseDown={(event) => event.stopPropagation()}>
        <div className="modal-head">
          <div className="modal-title">
            <div className="modal-kicker">{kicker}</div>
            <h2>{isAccount ? item.name : isContent ? display(item.hook, item.summary) : item.title}</h2>
            <p className="modal-sub">{isAccount ? `@${item.handle}` : isContent ? `${display(item.name)} · @${item.handle}` : item.id}</p>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="닫기"><X size={18} /></button>
        </div>

        {isContent && (
          <>
            <div className="modal-hero">
              {item.thumb && <img className="modal-thumb" src={item.thumb} alt="" />}
              <div className="modal-figures">
                <div className="figure-big">
                  <span>배수</span>
                  <Multiple value={item.multiple} size="lg" />
                  <small>{item.medianViews === null ? '계정 중앙 조회수 미기록' : `계정 중앙 ${formatCount(item.medianViews)}회 대비`}</small>
                </div>
                <div className="figure-row">
                  <div><span>조회수</span><strong>{formatCount(item.views)}</strong></div>
                  <div><span>좋아요</span><strong>{formatCount(item.likes)}</strong></div>
                  <div><span>댓글</span><strong>{formatCount(item.comments)}</strong></div>
                  <div><span>게시일</span><strong>{displayAge(item.age, item.date)}</strong></div>
                </div>
              </div>
            </div>
            <div className="dgrid">
              <div><span>카테고리</span><strong>{display(item.category)}</strong></div>
              <div><span>형식·길이</span><strong>{display(item.format)}{item.seconds !== null ? ` · ${item.seconds}초` : ''}</strong></div>
              <div><span>훅 유형</span><strong>{display(item.hookType)}</strong></div>
              <div><span>광고 판정</span><strong>{display(item.ad)}</strong></div>
              <div><span>게이트 판정</span><strong>{display(item.gateJudgment)}</strong></div>
              <div><span>등급·배정</span><strong>{display(item.grade)} · {display(item.assignment)}</strong></div>
            </div>
            <DetailSection label="게이트 근거" value={item.gateReason} />
            <DetailSection label="한줄 요약" value={item.summary} />
            <DetailSection label="구조" value={item.structure} />
            <DetailSection label="편집 장치" value={item.edit} />
            <DetailSection label="반응 요인 가설" value={item.why} />
            <DetailSection label="우리 버전 제안" value={item.suggestions} />
            {item.note && <DetailSection label="수집 메모" value={item.note} />}
            <div className="modal-actions">
              {item.formatId && <button className="wide-button" onClick={() => onOpenFormat(item.formatId)}>이 포맷 보기</button>}
              <a className="wide-button primary" href={item.url} target="_blank" rel="noreferrer">원본 Instagram 열기 <ArrowUpRight size={15} /></a>
            </div>
          </>
        )}

        {isAccount && (
          <>
            <div className="dgrid">
              <div><span>팔로워</span><strong>{display(item.followers)}</strong></div>
              <div><span>중앙 조회수</span><strong>{formatCount(item.medianViews)}</strong></div>
              <div><span>최고 조회수</span><strong>{formatCount(item.topViews)}</strong></div>
              <div><span>게시물</span><strong>{display(item.posts)}</strong></div>
            </div>
            <DetailSection label="계정 유형" value={item.type} />
            <DetailSection label="주력 카테고리" value={item.category} />
            <DetailSection label="배정 적합" value={item.assignment} />
            <DetailSection label="팀 메모" value={item.note} />
            <div className="modal-actions">
              <button className="wide-button" onClick={() => onNavigate('contents', { handle: item.handle })}>이 계정 콘텐츠 보기</button>
              <a className="wide-button primary" href={item.link} target="_blank" rel="noreferrer">Instagram 프로필 열기 <ArrowUpRight size={15} /></a>
            </div>
          </>
        )}

        {isFormat && (
          <>
            <div className="dgrid">
              <div><span>배수 중앙값</span><strong>{item.medianMultiple === null ? '미기록' : formatMultiple(item.medianMultiple)}</strong></div>
              <div><span>최고 배수</span><strong>{item.topMultiple === null ? '미기록' : formatMultiple(item.topMultiple)}</strong></div>
              <div><span>측정 콘텐츠</span><strong>{item.sampleCount}건</strong></div>
              <div><span>이식 가능성</span><strong>{display(item.portability)}</strong></div>
            </div>
            <DetailSection label="한줄 정의" value={item.definition} />
            <DetailSection label="구조" value={item.structure} />
            <DetailSection label="각색안" value={item.adaptation} />
            <DetailSection label="붙이기 좋은 주제" value={item.topics} />
            <div className="modal-actions">
              <button className="wide-button primary" onClick={() => onNavigate('contents', { formatId: item.id })}>이 포맷 콘텐츠 보기</button>
            </div>
          </>
        )}

        {!isAccount && !isContent && !isFormat && (
          <>
            <div className="dgrid">
              <div><span>진입 각도</span><strong>{display(item.angle)}</strong></div>
              <div><span>카테고리</span><strong>{display(item.category)}</strong></div>
              <div><span>약사 권위</span><strong>{display(item.authority)}</strong></div>
              <div><span>제품 연결</span><strong>{display(item.product)}</strong></div>
            </div>
            <DetailSection label="관련 증상·성분" value={item.keywords} />
            <DetailSection label="운영 메모" value={`${display(item.recent)} · 소진도 ${display(item.saturation)}`} />
            {item.example && <div className="modal-actions"><a className="wide-button primary" href={item.example} target="_blank" rel="noreferrer">대표 Instagram 열기 <ArrowUpRight size={15} /></a></div>}
          </>
        )}
      </div>
    </div>
  );
}

/* ---------- 화면 ---------- */

function ContentsView({ items, params, onOpen, onNavigate }) {
  const [sort, setSort] = useState('default');
  const [keyword, setKeyword] = useState('all');
  const [format, setFormat] = useState('all');

  const scoped = useMemo(() => items.filter((item) => {
    if (params.handle && item.handle !== params.handle) return false;
    if (params.formatId && item.formatId !== params.formatId) return false;
    return true;
  }), [items, params.handle, params.formatId]);

  const keywordCounts = useMemo(() => {
    const counts = new Map();
    scoped.forEach((item) => item.keywords.forEach((word) => counts.set(word, (counts.get(word) || 0) + 1)));
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  }, [scoped]);

  const formatCounts = useMemo(() => {
    const counts = new Map();
    scoped.forEach((item) => { const key = display(item.format); counts.set(key, (counts.get(key) || 0) + 1); });
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [scoped]);

  const filtered = scoped
    .filter((item) => (keyword === 'all' || item.keywords.includes(keyword)) && (format === 'all' || item.format === format));

  // 기본은 원장 순서 그대로 둔다. 정렬은 필요할 때만 고른다.
  const sorted = sort === 'default' ? filtered : [...filtered].sort((a, b) => {
    if (sort === 'views') return b.viewSort - a.viewSort;
    if (sort === 'recent') return (a.ageValue ?? 99999) - (b.ageValue ?? 99999);
    return b.multipleSort - a.multipleSort;
  });

  const measured = scoped.filter((item) => item.multiple !== null).length;

  return (
    <section className="view">
      <PageHead
        kicker="CONTENTS"
        title="콘텐츠 목록"
        description={`훅 문구, 인플루언서, 조회수와 배수를 함께 봅니다. 배수는 ${measured}건에서 계산했고, 나머지는 조회수를 아직 못 읽었습니다.`}
      >
        <div className="head-count"><strong>{sorted.length}</strong><span>건</span></div>
      </PageHead>

      {(params.handle || params.formatId) && (
        <div className="scope-bar">
          <span>{params.handle ? `@${params.handle} 콘텐츠만 봅니다` : `${params.formatId} 포맷 콘텐츠만 봅니다`}</span>
          <button onClick={() => onNavigate('contents', {})}>전체 콘텐츠 보기</button>
        </div>
      )}

      <div className="toolbar">
        <SortTabs value={sort} onChange={setSort} options={[['default', '기본'], ['multiple', '배수순'], ['views', '조회수순'], ['recent', '최신순']]} />
        <Chips options={formatCounts} value={format} onChange={setFormat} allLabel="형식 전체" />
      </div>
      <Chips options={keywordCounts} value={keyword} onChange={setKeyword} allLabel="주제 전체" />

      <div className="list">
        <ContentListHead />
        {sorted.map((item) => <ContentRow key={item.uid} item={item} onOpen={onOpen} />)}
        {sorted.length === 0 && <EmptyState label="콘텐츠" />}
      </div>
    </section>
  );
}

function AccountsView({ items, onOpen }) {
  const [sort, setSort] = useState('default');
  const [type, setType] = useState('all');

  const typeCounts = useMemo(() => {
    const counts = new Map();
    items.forEach((item) => { const key = display(item.type); counts.set(key, (counts.get(key) || 0) + 1); });
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [items]);

  const filtered = items.filter((item) => type === 'all' || item.type === type);
  const sorted = sort === 'default' ? filtered : [...filtered].sort((a, b) => {
    if (sort === 'median') return (b.medianViews ?? -1) - (a.medianViews ?? -1);
    return b.followerValue - a.followerValue;
  });

  return (
    <section className="view">
      <PageHead kicker="ACCOUNTS" title="인플루언서 목록" description="약사·메디컬 공개 계정과 주력 카테고리. 중앙 조회수는 콘텐츠에 등장한 계정만 측정했습니다.">
        <div className="head-count"><strong>{sorted.length}</strong><span>명</span></div>
      </PageHead>

      <div className="toolbar">
        <SortTabs value={sort} onChange={setSort} options={[['default', '기본'], ['followers', '팔로워순'], ['median', '중앙 조회수순']]} />
      </div>
      <Chips options={typeCounts} value={type} onChange={setType} allLabel="유형 전체" />

      <div className="list">
        {sorted.map((item) => (
          <button className="arow" key={item.uid} onClick={() => onOpen(item)}>
            <div className="arow-copy">
              <strong>{item.name}</strong>
              <span>@{item.handle} · {display(item.category)}</span>
            </div>
            <div className="arow-figures">
              <div><span>팔로워</span><strong>{display(item.followers)}</strong></div>
              <div><span>중앙 조회수</span><strong>{formatCount(item.medianViews)}</strong></div>
            </div>
            <InstagramLink href={item.link} label={item.name} />
          </button>
        ))}
        {sorted.length === 0 && <EmptyState label="인플루언서" />}
      </div>
    </section>
  );
}

function FormatsView({ items, onOpen }) {
  const sorted = items;
  const measured = items.filter((item) => item.sampleCount > 0).length;
  return (
    <section className="view">
      <PageHead kicker="FORMATS" title="포맷 목록" description={`릴스 제작용 구조 템플릿. ${measured}개 포맷은 실제 콘텐츠 배수로 성과를 계산했습니다.`}>
        <div className="head-count"><strong>{items.length}</strong><span>개</span></div>
      </PageHead>
      <div className="list">
        {sorted.map((item) => (
          <button className="frow" key={item.uid} onClick={() => onOpen(item)}>
            <div className="frow-copy">
              <strong>{item.title}</strong>
              <span>{display(item.definition)}</span>
            </div>
            <div className="frow-score">
              <Multiple value={item.medianMultiple} />
              <span className="frow-sample">{item.sampleCount ? `측정 ${item.sampleCount}건` : '측정 없음'}</span>
            </div>
            <div className="frow-meta">
              <span>{display(item.length)}</span>
              <span>이식 {display(item.portability)}</span>
            </div>
          </button>
        ))}
        {items.length === 0 && <EmptyState label="포맷" />}
      </div>
    </section>
  );
}

function TopicsView({ items, onOpen }) {
  return (
    <section className="view">
      <PageHead kicker="TOPICS" title="주제 목록" description="제품·증상·성분별 주제 후보, 약사 권위 활용도, 제품 연결 가능성">
        <div className="head-count"><strong>{items.length}</strong><span>개</span></div>
      </PageHead>
      <div className="list">
        {items.map((item) => (
          <button className="frow" key={item.uid} onClick={() => onOpen(item)}>
            <div className="frow-copy">
              <strong>{item.title}</strong>
              <span>{display(item.angle)}</span>
            </div>
            <div className="frow-meta">
              <span>{display(item.category)}</span>
              <span>권위 {display(item.authority)}</span>
            </div>
          </button>
        ))}
        {items.length === 0 && <EmptyState label="주제" />}
      </div>
    </section>
  );
}

function Overview({ data, onOpen, onNavigate }) {
  const { accounts, contents, formats } = data;

  const withMultiple = contents.filter((item) => item.multiple !== null);
  const previewContents = contents.slice(0, 5);
  const previewFormats = formats.slice(0, 5);
  const reels = contents.filter((item) => item.format === '릴스').length;

  const coverage = [
    { label: '배수 계산', done: withMultiple.length, total: contents.length, note: '조회수를 읽은 릴스만' },
    { label: '조회수', done: contents.filter((item) => item.views !== null).length, total: reels, note: '릴스 기준 · 캐러셀은 비공개' },
    { label: '좋아요·댓글', done: contents.filter((item) => item.likes !== null).length, total: contents.length, note: '공개된 값만' },
    { label: '썸네일', done: contents.filter((item) => item.thumb).length, total: contents.length, note: '저장 완료' },
  ];

  const typeCounts = [...accounts.reduce((map, item) => {
    const key = display(item.type);
    return map.set(key, (map.get(key) || 0) + 1);
  }, new Map())].sort((a, b) => b[1] - a[1]);

  return (
    <section className="view">
      <PageHead
        kicker="PHARM SOCIAL INTELLIGENCE"
        title="약사·메디컬 콘텐츠 레퍼런스"
        description={`인플루언서 ${accounts.length}명, 콘텐츠 ${contents.length}건, 포맷 ${formats.length}개. 공개 Instagram 프로필에서 모았습니다.`}
      />

      <section className="panel">
        <div className="panel-head">
          <h2>계정 구성</h2>
          <button className="text-link" onClick={() => onNavigate('accounts', {})}>전체 목록 <ArrowUpRight size={13} /></button>
        </div>
        <div className="type-list">
          {typeCounts.map(([label, count]) => (
            <div className="type" key={label}>
              <span>{label}</span>
              <strong>{count}</strong>
            </div>
          ))}
        </div>
      </section>

      <section className="panel panel-flush">
        <div className="panel-head">
          <h2>콘텐츠</h2>
          <button className="text-link" onClick={() => onNavigate('contents', {})}>전체 목록 <ArrowUpRight size={13} /></button>
        </div>
        <div className="list list-inset">
          {previewContents.map((item) => <ContentRow key={item.uid} item={item} onOpen={onOpen} compact />)}
          {previewContents.length === 0 && <EmptyState label="콘텐츠" />}
        </div>
      </section>

      <div className="panel-grid">
        <section className="panel">
          <div className="panel-head">
            <h2>포맷 카드</h2>
            <button className="text-link" onClick={() => onNavigate('formats', {})}>전체 목록 <ArrowUpRight size={13} /></button>
          </div>
          <div className="frank">
            {previewFormats.map((item) => (
              <button className="frank-row" key={item.uid} onClick={() => onOpen(item)}>
                <span className="frank-copy">
                  <strong>{item.title}</strong>
                  <small>{display(item.definition)}</small>
                </span>
                <span className="frank-tag">{display(item.length)}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="panel">
          <div className="panel-head"><h2>수집 현황</h2></div>
          <div className="cover-list">
            {coverage.map((row) => (
              <div className="cover" key={row.label}>
                <div className="cover-label"><span>{row.label}</span><strong>{row.done}/{row.total}</strong></div>
                <div className="cover-track"><div className="cover-fill" style={{ width: `${Math.round((row.done / row.total) * 100)}%` }} /></div>
                <small>{row.note}</small>
              </div>
            ))}
          </div>
        </section>
      </div>

      <p className="foot">
        공개 Instagram 프로필에서 확인한 데이터입니다. 조회수·좋아요·댓글은 원본에 기록된 값만 표시하고, 없으면 미기록으로 둡니다.
      </p>
    </section>
  );
}

/* ---------- 셸 ---------- */

function App() {
  const [data, setData] = useState(null);
  const [view, setView] = useState('overview');
  const [params, setParams] = useState({});
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);
  const [navOpen, setNavOpen] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all(Object.entries(DATA_FILES).map(async ([key, path]) => [key, await parseCsv(path)]))
      .then((entries) => setData(normalizeData(Object.fromEntries(entries))))
      .catch(() => setError('공개 데이터 파일을 읽지 못했습니다. 잠시 후 새로고침해 주세요.'));
  }, []);

  useEffect(() => {
    const handler = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        document.querySelector('.topbar input')?.focus();
      }
      if (event.key === 'Escape') setSelected(null);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const navigate = (nextView, nextParams = {}) => {
    setView(nextView);
    setParams(nextParams);
    setSelected(null);
    setNavOpen(false);
  };

  const filteredData = useMemo(() => {
    if (!data || !search.trim()) return data;
    const query = search.toLowerCase();
    const includes = (item) => Object.values(item).some((value) => String(value || '').toLowerCase().includes(query));
    return Object.fromEntries(Object.entries(data).map(([key, items]) => [key, items.filter(includes)]));
  }, [data, search]);

  if (error) return <div className="screen"><h1>데이터를 불러오지 못했습니다</h1><p>{error}</p></div>;
  if (!data) return <div className="screen"><h1>데이터 준비 중</h1><p>인플루언서·콘텐츠 목록을 불러옵니다.</p></div>;

  const current = filteredData || data;
  const renderView = () => {
    if (view === 'overview') return <Overview data={data} onOpen={setSelected} onNavigate={navigate} />;
    if (view === 'contents') return <ContentsView items={current.contents} params={params} onOpen={setSelected} onNavigate={navigate} />;
    if (view === 'accounts') return <AccountsView items={current.accounts} onOpen={setSelected} />;
    if (view === 'formats') return <FormatsView items={current.formats} onOpen={setSelected} />;
    return <TopicsView items={current.topics} onOpen={setSelected} />;
  };

  return (
    <div className="app">
      {navOpen && <div className="scrim" onClick={() => setNavOpen(false)} />}
      <aside className={`sidebar ${navOpen ? 'open' : ''}`}>
        <div className="wordmark">
          <strong>PHARM SI</strong>
          <span>웰니스 콘텐츠팀</span>
        </div>
        <nav>
          {NAV_ITEMS.map(({ id, label, key }) => (
            <button key={id} className={view === id ? 'active' : ''} onClick={() => navigate(id, {})}>
              <span>{label}</span>
              {key && <em>{data[key].length}</em>}
            </button>
          ))}
        </nav>
        <div className="sidebar-foot">
          <span>공개 데이터 인덱스</span>
          <span>2026.08.05 기준</span>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <button className="menu-button" onClick={() => setNavOpen(!navOpen)} aria-label="메뉴 열기"><Menu size={20} /></button>
          <div className="topbar-title">{NAV_ITEMS.find((item) => item.id === view)?.label}</div>
          <label className="search">
            <Search size={17} />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="훅 문구·계정·주제 검색" />
            {search && <button className="clear" onClick={() => setSearch('')} aria-label="검색어 지우기"><X size={15} /></button>}
          </label>
        </header>
        <div className="content">{renderView()}</div>
      </main>

      <DetailModal
        item={selected}
        onClose={() => setSelected(null)}
        onNavigate={navigate}
        onOpenFormat={(formatId) => setSelected(data.formats.find((format) => format.id === formatId) || null)}
      />
    </div>
  );
}

createRoot(document.getElementById('root')).render(<App />);
