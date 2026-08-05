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
  { id: 'accounts', label: '인플루언서 목록', key: 'accounts' },
  { id: 'contents', label: '콘텐츠 목록', key: 'contents' },
  { id: 'formats', label: '포맷 목록', key: 'formats' },
  { id: 'topics', label: '주제 목록', key: 'topics' },
];

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

function display(value, fallback = '미기록') {
  return value === null || value === undefined || String(value).trim() === '' ? fallback : value;
}

// 경과일 → 게시일 → 미기록 순으로 내려간다. 원본에 값이 없으면 날짜를 지어내지 않는다.
function displayAge(age, date) {
  const raw = String(age ?? '').trim();
  if (/\d/.test(raw)) return raw.endsWith('전') ? raw : `${raw} 전`;
  return display(date);
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
  const accounts = raw.accounts.map((row) => ({
    kind: 'account',
    id: row['핸들'],
    handle: row['핸들'],
    name: row['이름'],
    type: row['계정유형'],
    country: row['국가'] || '국내',
    followers: row['팔로워'],
    followerValue: metricValue(row['팔로워']),
    posts: row['게시물수'],
    category: row['주력카테고리'],
    assignment: row['배정적합(김·오·선)'],
    grade: row['등급(S·A·B·제외)'],
    status: row['허수판정'],
    source: row['발굴경로(엔진·시드계정)'],
    note: row['사람메모'],
    link: instagramUrl(row['핸들']),
  }));

  const contents = raw.contents.map((row) => ({
    kind: 'content',
    id: row.ID,
    handle: row['계정핸들'],
    name: row['계정명'],
    followers: row['팔로워'],
    type: row['계정유형'],
    date: row['게시일'] || row['발견일시']?.slice(0, 10),
    age: row['경과일'],
    url: row['영상URL'] || instagramUrl(row['계정핸들']),
    format: row['형식(릴스·캐러셀)'],
    views: row['조회수'],
    likes: row['좋아요'],
    likeValue: metricValue(row['좋아요']),
    comments: row['댓글'],
    category: row['카테고리'],
    subtopic: row['소주제'],
    angle: row['진입각도'],
    hookType: row['훅유형'],
    hook: row['훅문구(첫3초 자막 원문)'],
    structure: row['구조'],
    edit: row['편집장치'],
    summary: row['한줄요약'],
    why: row['왜터졌나(가설)'],
    suggestions: row['우리버전제안(훅 문구 3개)'],
    ad: row['광고판정'],
    transfer: row['이식후보여부'],
  }));

  const formats = raw.formats.map((row) => ({
    kind: 'format',
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

  const topics = raw.topics.map((row) => ({
    kind: 'topic',
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

  return { accounts, contents, formats, topics };
}

function Tag({ children, tone = 'plain' }) {
  return <span className={`tag tag-${tone}`}>{children}</span>;
}

function InstagramLink({ href, label, className = 'row-link' }) {
  return (
    <a className={className} href={href} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()} aria-label={`${label} 원본 Instagram 열기`}>
      Instagram <ArrowUpRight size={14} />
    </a>
  );
}

function ContentRow({ item, onOpen }) {
  const name = display(item.name);
  return (
    <button className="row row-content" onClick={() => onOpen(item)}>
      <div className="row-main">
        <strong className="row-title">{display(item.summary, '제목 미기록')}</strong>
        <span className="row-sub">
          <span className="row-name">{name}</span>
          <span className="row-handle">@{display(item.handle)}</span>
        </span>
      </div>
      <div className="row-metrics">
        <div><small>조회수</small><strong>{display(item.views)}</strong></div>
        <div><small>좋아요</small><strong>{display(item.likes)}</strong></div>
        <div><small>댓글</small><strong>{display(item.comments)}</strong></div>
        <div><small>게시일</small><strong>{displayAge(item.age, item.date)}</strong></div>
      </div>
      <div className="row-tail">
        <span className="row-format">{display(item.format)}</span>
        <InstagramLink href={item.url} label={name} />
      </div>
    </button>
  );
}

function FormatRow({ item, onOpen }) {
  return (
    <button className="row row-format-item" onClick={() => onOpen(item)}>
      <div className="row-main">
        <strong className="row-title">{item.title}</strong>
        <span className="row-sub"><span className="row-name">{display(item.definition)}</span></span>
      </div>
      <div className="row-meta">
        <Tag tone="accent">{display(item.hookType)}</Tag>
        <span>{display(item.length)}</span>
        <span>난이도 {display(item.difficulty)}</span>
        <span>이식 {display(item.portability)}</span>
      </div>
    </button>
  );
}

function TopicRow({ item, onOpen }) {
  return (
    <button className="row row-topic" onClick={() => onOpen(item)}>
      <div className="row-main">
        <strong className="row-title">{item.title}</strong>
        <span className="row-sub"><span className="row-name">{display(item.angle)} · {display(item.category)}</span></span>
      </div>
      <div className="row-meta">
        <span>권위 {display(item.authority)}</span>
        <span>{display(item.product, '제품 연결 미기록')}</span>
      </div>
    </button>
  );
}

function DetailModal({ item, onClose }) {
  if (!item) return null;
  const isAccount = item.kind === 'account';
  const isContent = item.kind === 'content';
  const isFormat = item.kind === 'format';
  const kicker = isAccount ? '인플루언서 상세' : isContent ? '콘텐츠 상세' : isFormat ? '포맷 상세' : '주제 상세';
  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className="modal" onMouseDown={(event) => event.stopPropagation()}>
        <div className="modal-head">
          <div>
            <div className="modal-kicker">{kicker}</div>
            <h2>{isAccount ? item.name : isContent ? item.summary : item.title}</h2>
            <p className="modal-sub">{isAccount ? `@${item.handle}` : isContent ? `@${item.handle} · ${display(item.date)}` : item.id}</p>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="닫기"><X size={18} /></button>
        </div>

        {isAccount && (
          <>
            <div className="detail-grid">
              <div><span>팔로워</span><strong>{display(item.followers)}</strong></div>
              <div><span>게시물</span><strong>{display(item.posts)}</strong></div>
              <div><span>계정 유형</span><strong>{display(item.type)}</strong></div>
              <div><span>배정 적합</span><strong>{display(item.assignment, '공용')}</strong></div>
            </div>
            <DetailSection label="주력 카테고리" value={item.category} />
            <DetailSection label="발견 경로" value={item.source} />
            <DetailSection label="팀 메모" value={item.note} />
            <a className="wide-link" href={item.link} target="_blank" rel="noreferrer">Instagram 프로필 열기 <ArrowUpRight size={15} /></a>
          </>
        )}

        {isContent && (
          <>
            <div className="detail-metrics">
              <div><span>조회수</span><strong>{display(item.views)}</strong></div>
              <div><span>좋아요</span><strong>{display(item.likes)}</strong></div>
              <div><span>댓글</span><strong>{display(item.comments)}</strong></div>
              <div><span>게시일</span><strong>{displayAge(item.age, item.date)}</strong></div>
            </div>
            <div className="tag-row">
              <Tag tone="accent">{display(item.category)}</Tag>
              <Tag>{display(item.format)}</Tag>
              <Tag>{display(item.ad, '광고 판정 미기록')}</Tag>
            </div>
            <div className="quote">
              <span>훅 · {display(item.hookType, '유형 미기록')}</span>
              <strong>{display(item.hook)}</strong>
            </div>
            <div className="detail-grid">
              <div><span>진입 각도</span><strong>{display(item.angle)}</strong></div>
              <div><span>소주제</span><strong>{display(item.subtopic)}</strong></div>
              <div><span>구조</span><strong>{display(item.structure)}</strong></div>
              <div><span>편집 장치</span><strong>{display(item.edit)}</strong></div>
            </div>
            <DetailSection label="반응 요인 가설" value={item.why} />
            <DetailSection label="우리 버전 제안" value={item.suggestions} />
            <a className="wide-link" href={item.url} target="_blank" rel="noreferrer">원본 Instagram 콘텐츠 열기 <ArrowUpRight size={15} /></a>
          </>
        )}

        {!isAccount && !isContent && (
          <>
            <div className="detail-grid">
              <div><span>{isFormat ? '한줄 정의' : '진입 각도'}</span><strong>{display(isFormat ? item.definition : item.angle)}</strong></div>
              <div><span>{isFormat ? '훅 유형' : '약사 권위'}</span><strong>{display(isFormat ? item.hookType : item.authority)}</strong></div>
              <div><span>{isFormat ? '이식 가능성' : '제품 연결'}</span><strong>{display(isFormat ? item.portability : item.product)}</strong></div>
              <div><span>배정 가능</span><strong>{display(item.people)}</strong></div>
            </div>
            <DetailSection label={isFormat ? '구조' : '관련 증상·성분'} value={isFormat ? item.structure : item.keywords} />
            <DetailSection label={isFormat ? '각색안' : '진입 각도'} value={isFormat ? item.adaptation : item.angle} />
            <DetailSection label={isFormat ? '붙이기 좋은 주제' : '운영 메모'} value={isFormat ? item.topics : `${display(item.recent)} · 소진도 ${display(item.saturation)}`} />
            {item.example && <a className="wide-link" href={item.example} target="_blank" rel="noreferrer">대표 Instagram 콘텐츠 열기 <ArrowUpRight size={15} /></a>}
          </>
        )}
      </div>
    </div>
  );
}

function DetailSection({ label, value }) {
  return <div className="detail-section"><span>{label}</span><p>{display(value)}</p></div>;
}

function SearchBar({ value, onChange, placeholder }) {
  return (
    <label className="search-box">
      <Search size={17} />
      <input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} />
    </label>
  );
}

function FilterSelect({ label, value, onChange, options }) {
  return (
    <label className="filter-select">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="all">전체</option>
        {options.map((option) => <option key={option} value={option}>{option}</option>)}
      </select>
    </label>
  );
}

function EmptyState({ label }) {
  return <div className="empty-state"><strong>{label} 데이터가 없습니다</strong><span>검색어나 필터를 바꿔보세요.</span></div>;
}

function PageHead({ kicker, title, description, count, unit = '건' }) {
  return (
    <div className="page-head">
      <div className="page-head-copy">
        <div className="kicker">{kicker}</div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {count !== undefined && <div className="page-count"><strong>{count}</strong><span>{unit}</span></div>}
    </div>
  );
}

function AccountsView({ items, onOpen }) {
  const [type, setType] = useState('all');
  const [category, setCategory] = useState('all');
  const types = useMemo(() => [...new Set(items.map((item) => item.type).filter(Boolean))].sort(), [items]);
  const categories = useMemo(() => [...new Set(items.map((item) => item.category).filter(Boolean))].sort(), [items]);
  const filtered = items.filter((item) => (type === 'all' || item.type === type) && (category === 'all' || item.category === category));
  return (
    <section className="view">
      <PageHead kicker="ACCOUNTS" title="인플루언서 목록" description="약사·메디컬 계정, 주력 카테고리, 팔로워 수, 원본 Instagram 링크" count={filtered.length} unit="명" />
      <div className="filter-row">
        <FilterSelect label="계정 유형" value={type} onChange={setType} options={types} />
        <FilterSelect label="카테고리" value={category} onChange={setCategory} options={categories} />
      </div>
      <div className="table-card">
        <table>
          <thead><tr><th>인플루언서</th><th>계정 유형</th><th>팔로워</th><th>주력 카테고리</th><th>배정 적합</th><th></th></tr></thead>
          <tbody>
            {filtered.map((item) => (
              <tr key={item.id} onClick={() => onOpen(item)}>
                <td>
                  <div className="cell-account">
                    <strong>{item.name}</strong>
                    <span>@{item.handle}</span>
                  </div>
                </td>
                <td>{display(item.type)}</td>
                <td className="cell-number">{display(item.followers)}</td>
                <td>{display(item.category)}</td>
                <td>{display(item.assignment, '공용')}</td>
                <td className="cell-link"><InstagramLink href={item.link} label={item.name} /></td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && <EmptyState label="인플루언서" />}
      </div>
    </section>
  );
}

function ContentsView({ items, onOpen }) {
  const [category, setCategory] = useState('all');
  const [format, setFormat] = useState('all');
  const categories = useMemo(() => [...new Set(items.map((item) => item.category).filter(Boolean))].sort(), [items]);
  const formats = useMemo(() => [...new Set(items.map((item) => item.format).filter(Boolean))].sort(), [items]);
  const filtered = items.filter((item) => (category === 'all' || item.category === category) && (format === 'all' || item.format === format));
  return (
    <section className="view">
      <PageHead kicker="CONTENTS" title="콘텐츠 목록" description="콘텐츠 제목, 인플루언서명과 핸들, 조회수·좋아요·댓글, 게시일, 원본 Instagram 링크" count={filtered.length} />
      <div className="filter-row">
        <FilterSelect label="카테고리" value={category} onChange={setCategory} options={categories} />
        <FilterSelect label="형식" value={format} onChange={setFormat} options={formats} />
      </div>
      <div className="list-card">
        <div className="list-head"><span>콘텐츠 정보</span><span>성과 지표</span></div>
        {filtered.map((item) => <ContentRow key={item.id} item={item} onOpen={onOpen} />)}
        {filtered.length === 0 && <EmptyState label="콘텐츠" />}
      </div>
    </section>
  );
}

function FormatsView({ items, onOpen }) {
  return (
    <section className="view">
      <PageHead kicker="FORMATS" title="포맷 목록" description="릴스 제작용 훅 유형, 구조 비트, 편집 장치, 이식 가능성" count={items.length} unit="개" />
      <div className="list-card">
        {items.map((item) => <FormatRow key={item.id} item={item} onOpen={onOpen} />)}
        {items.length === 0 && <EmptyState label="포맷" />}
      </div>
    </section>
  );
}

function TopicsView({ items, onOpen }) {
  return (
    <section className="view">
      <PageHead kicker="TOPICS" title="주제 목록" description="제품·증상·성분별 주제 후보, 약사 권위 활용도, 제품 연결 가능성" count={items.length} unit="개" />
      <div className="list-card">
        {items.map((item) => <TopicRow key={item.id} item={item} onOpen={onOpen} />)}
        {items.length === 0 && <EmptyState label="주제" />}
      </div>
    </section>
  );
}

function Overview({ data, onOpen, onNavigate }) {
  const { accounts, contents, formats, topics } = data;
  const topAccounts = [...accounts].sort((a, b) => b.followerValue - a.followerValue).slice(0, 6);
  const previewContents = contents.slice(0, 5);
  // 주력카테고리는 "영양제·이너뷰티·증상"처럼 복합 표기라 그대로 세면 값이 거의 다 달라진다.
  // 구분자로 쪼개 키워드 단위로 센다.
  const categoryCounts = Object.entries(accounts.reduce((acc, item) => {
    const raw = String(item.category || '').trim();
    const keywords = raw ? raw.split(/[·/,]/).map((part) => part.trim()).filter(Boolean) : ['미기록'];
    keywords.forEach((keyword) => { acc[keyword] = (acc[keyword] || 0) + 1; });
    return acc;
  }, {})).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const formatCounts = Object.entries(contents.reduce((acc, item) => {
    const key = item.format || '미기록';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {})).sort((a, b) => b[1] - a[1]);

  const figures = [
    { key: 'accounts', label: '인플루언서', value: accounts.length, unit: '명', note: '약사·메디컬 공개 계정' },
    { key: 'contents', label: '콘텐츠', value: contents.length, unit: '건', note: '훅·구조·편집 장치 기록' },
    { key: 'formats', label: '포맷', value: formats.length, unit: '개', note: '제작용 구조 템플릿' },
    { key: 'topics', label: '주제', value: topics.length, unit: '개', note: '이식 가능한 주제 후보' },
  ];

  return (
    <section className="view">
      <div className="page-head">
        <div className="page-head-copy">
          <div className="kicker">PHARM SOCIAL INTELLIGENCE</div>
          <h1>약사·메디컬 인스타그램 공개 데이터</h1>
          <p>인플루언서 {accounts.length}명과 콘텐츠 {contents.length}건을 형식·주제별로 정리했습니다. 2026.08.05 기준.</p>
        </div>
      </div>

      <div className="figure-strip">
        {figures.map((figure) => (
          <button className="figure" key={figure.key} onClick={() => onNavigate(figure.key)}>
            <span className="figure-label">{figure.label}</span>
            <span className="figure-value"><strong>{figure.value}</strong><em>{figure.unit}</em></span>
            <span className="figure-note">{figure.note}</span>
          </button>
        ))}
      </div>

      <div className="panel-grid">
        <section className="panel">
          <div className="panel-head">
            <h2>팔로워 상위 인플루언서</h2>
            <button className="text-link" onClick={() => onNavigate('accounts')}>전체 목록 <ArrowUpRight size={13} /></button>
          </div>
          <div className="rank-list">
            {topAccounts.map((item, index) => (
              <button className="rank" key={item.id} onClick={() => onOpen(item)}>
                <span className="rank-index">{String(index + 1).padStart(2, '0')}</span>
                <span className="rank-copy">
                  <strong>{item.name}</strong>
                  <small>@{item.handle} · {display(item.category)}</small>
                </span>
                <span className="rank-value">{display(item.followers)}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="panel">
          <div className="panel-head">
            <h2>주력 카테고리 키워드</h2>
            <span className="panel-note">상위 6개</span>
          </div>
          <div className="bar-list">
            {categoryCounts.map(([label, value]) => (
              <div className="bar" key={label}>
                <div className="bar-label"><span>{label}</span><strong>{value}</strong></div>
                <div className="bar-track"><div className="bar-fill" style={{ width: `${Math.max(6, (value / categoryCounts[0][1]) * 100)}%` }} /></div>
              </div>
            ))}
          </div>
          <div className="panel-foot">
            <span>콘텐츠 형식</span>
            <strong>{formatCounts.map(([label, value]) => `${label} ${value}건`).join(' · ')}</strong>
          </div>
        </section>
      </div>

      <section className="panel panel-flush">
        <div className="panel-head">
          <h2>콘텐츠 미리보기</h2>
          <button className="text-link" onClick={() => onNavigate('contents')}>전체 목록 <ArrowUpRight size={13} /></button>
        </div>
        <div className="list-card list-compact">
          {previewContents.map((item) => <ContentRow key={item.id} item={item} onOpen={onOpen} />)}
        </div>
      </section>

      <p className="page-foot">
        공개 Instagram 프로필에서 확인한 데이터입니다. 조회수·좋아요·댓글은 원본에 기록된 값만 표시하고, 없으면 미기록으로 둡니다.
      </p>
    </section>
  );
}

function App() {
  const [data, setData] = useState(null);
  const [view, setView] = useState('overview');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
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
        document.querySelector('.topbar .search-box input')?.focus();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const filteredData = useMemo(() => {
    if (!data || !search.trim()) return data;
    const query = search.toLowerCase();
    const includes = (item) => Object.values(item).some((value) => String(value || '').toLowerCase().includes(query));
    return Object.fromEntries(Object.entries(data).map(([key, items]) => [key, items.filter(includes)]));
  }, [data, search]);

  if (error) return <div className="screen-message"><h1>데이터를 불러오지 못했습니다</h1><p>{error}</p></div>;
  if (!data) return <div className="screen-message"><h1>데이터 준비 중</h1><p>인플루언서·콘텐츠 목록을 불러옵니다.</p></div>;

  const currentData = filteredData || data;
  const renderView = () => {
    if (view === 'overview') return <Overview data={data} onOpen={setSelected} onNavigate={setView} />;
    if (view === 'accounts') return <AccountsView items={currentData.accounts} onOpen={setSelected} />;
    if (view === 'contents') return <ContentsView items={currentData.contents} onOpen={setSelected} />;
    if (view === 'formats') return <FormatsView items={currentData.formats} onOpen={setSelected} />;
    return <TopicsView items={currentData.topics} onOpen={setSelected} />;
  };

  return (
    <div className="app">
      {sidebarOpen && <div className="scrim" onClick={() => setSidebarOpen(false)} />}
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="wordmark">
          <strong>PHARM SI</strong>
          <span>웰니스 콘텐츠팀</span>
        </div>
        <nav>
          {NAV_ITEMS.map(({ id, label, key }) => (
            <button key={id} className={view === id ? 'active' : ''} onClick={() => { setView(id); setSidebarOpen(false); }}>
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
          <button className="menu-button" onClick={() => setSidebarOpen(!sidebarOpen)} aria-label="메뉴 열기"><Menu size={20} /></button>
          <div className="topbar-title">{NAV_ITEMS.find((item) => item.id === view)?.label}</div>
          <div className="topbar-search">
            <SearchBar value={search} onChange={setSearch} placeholder="인플루언서·주제·훅 검색" />
            {search && <button className="clear-button" onClick={() => setSearch('')} aria-label="검색어 지우기"><X size={15} /></button>}
          </div>
        </header>
        <div className="content">
          {view !== 'overview' && (
            <div className="mobile-search">
              <SearchBar value={search} onChange={setSearch} placeholder="현재 목록에서 검색" />
              {search && <button className="clear-button" onClick={() => setSearch('')} aria-label="검색어 지우기"><X size={15} /></button>}
            </div>
          )}
          {renderView()}
        </div>
      </main>

      <DetailModal item={selected} onClose={() => setSelected(null)} />
    </div>
  );
}

createRoot(document.getElementById('root')).render(<App />);
