import { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import Papa from 'papaparse';
import {
  ArrowUpRight,
  BarChart3,
  Camera,
  Check,
  ChevronRight,
  CircleDot,
  Database,
  ExternalLink,
  Filter,
  Layers3,
  LayoutDashboard,
  Menu,
  Search,
  Sparkles,
  Tag,
  Users,
  X,
} from 'lucide-react';
import './styles.css';

const DATA_FILES = {
  accounts: '/data/accounts.csv',
  contents: '/data/contents.csv',
  formats: '/data/formats.csv',
  topics: '/data/topics.csv',
};

const NAV_ITEMS = [
  { id: 'overview', label: '요약', icon: LayoutDashboard },
  { id: 'accounts', label: '인플루언서 목록', icon: Users, key: 'accounts' },
  { id: 'contents', label: '콘텐츠 목록', icon: BarChart3, key: 'contents' },
  { id: 'formats', label: '포맷 목록', icon: Layers3, key: 'formats' },
  { id: 'topics', label: '주제 목록', icon: Tag, key: 'topics' },
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

function Badge({ children, tone = 'neutral' }) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}

function ContentListRow({ item, onOpen }) {
  const name = display(item.name);
  return (
    <button className="content-list-row" onClick={() => onOpen(item)}>
      <div className="content-list-primary">
        <div className="list-index">{display(item.format, '콘텐츠').slice(0, 1)}</div>
        <div className="content-list-copy">
          <strong>{display(item.summary, '제목 미기록')}</strong>
          <span className="content-list-author">
            <span className="author-name">{name}</span>
            <b>@{display(item.handle)}</b>
          </span>
        </div>
      </div>
      <div className="content-list-metrics">
        <div><small>조회수</small><strong>{display(item.views)}</strong></div>
        <div><small>좋아요</small><strong>{display(item.likes)}</strong></div>
        <div><small>댓글</small><strong>{display(item.comments)}</strong></div>
        <div><small>게시일</small><strong>{displayAge(item.age, item.date)}</strong></div>
      </div>
      <div className="content-list-tail">
        <Badge tone={item.ad === '광고아님' ? 'lime' : 'neutral'}>{display(item.format)}</Badge>
        <a className="table-link" href={item.url} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()} aria-label={`${name} 원본 Instagram 열기`}><Camera size={18} /></a>
        <ChevronRight size={18} className="row-chevron" />
      </div>
    </button>
  );
}

function FormatListRow({ item, onOpen }) {
  return <button className="format-list-row" onClick={() => onOpen(item)}>
    <div className="format-list-primary"><div className="list-index">포</div><div><strong>{item.title}</strong><span>{display(item.definition)}</span></div></div>
    <div className="format-list-meta"><Badge tone="lime">{display(item.hookType)}</Badge><span>{display(item.length)}</span><span>난이도 {display(item.difficulty)}</span><span>이식 {display(item.portability)}</span><ChevronRight size={18} /></div>
  </button>;
}

function StatCard({ label, value, accent, detail }) {
  return (
    <div className={`stat-card ${accent}`}>
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      <div className="stat-detail">{detail}</div>
    </div>
  );
}

function DetailModal({ item, onClose }) {
  if (!item) return null;
  const isAccount = item.kind === 'account';
  const isContent = item.kind === 'content';
  const isFormat = item.kind === 'format';
  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className="modal" onMouseDown={(event) => event.stopPropagation()}>
        <div className="modal-head">
          <div>
            <div className="eyebrow">{isAccount ? '인플루언서 상세' : isContent ? '콘텐츠 상세' : isFormat ? '포맷 상세' : '주제 상세'}</div>
            <h2>{isAccount ? item.name : isContent ? item.summary : item.title}</h2>
            <p className="modal-subtitle">{isAccount ? `@${item.handle}` : isContent ? `@${item.handle} · ${display(item.date)}` : item.id}</p>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="닫기"><X size={19} /></button>
        </div>

        {isAccount && (
          <>
            <div className="profile-hero">
              <div className="avatar avatar-large">{String(item.name || item.handle).slice(0, 1)}</div>
              <div>
                <div className="profile-title-row"><strong>@{item.handle}</strong><Badge tone="lime">{display(item.status, '공개 확인')}</Badge></div>
                <p>{display(item.type)} · {display(item.country)}</p>
              </div>
              <a className="primary-button" href={item.link} target="_blank" rel="noreferrer"><Camera size={16} /> Instagram 열기 <ExternalLink size={14} /></a>
            </div>
            <div className="detail-grid">
              <div><span>팔로워</span><strong>{display(item.followers)}</strong></div>
              <div><span>게시물</span><strong>{display(item.posts)}</strong></div>
              <div><span>주력 카테고리</span><strong>{display(item.category)}</strong></div>
              <div><span>배정 적합</span><strong>{display(item.assignment)}</strong></div>
            </div>
            <DetailSection label="발견 경로" value={item.source} />
            <DetailSection label="팀 메모" value={item.note} />
          </>
        )}

        {isContent && (
          <>
            <div className="content-meta-row">
              <Badge tone="coral">{display(item.category)}</Badge>
              <Badge>{display(item.format)}</Badge>
              <Badge tone={item.ad === '광고아님' ? 'lime' : 'neutral'}>{display(item.ad, '광고 판정 미기록')}</Badge>
              <span className="muted">조회수 {display(item.views)} · 좋아요 {display(item.likes)} · 댓글 {display(item.comments)}</span>
            </div>
            <div className="hook-box"><span>HOOK · {display(item.hookType, '미기록')}</span><strong>{display(item.hook)}</strong></div>
            <div className="detail-grid content-grid">
              <div><span>진입 각도</span><strong>{display(item.angle)}</strong></div>
              <div><span>소주제</span><strong>{display(item.subtopic)}</strong></div>
              <div><span>구조</span><strong>{display(item.structure)}</strong></div>
              <div><span>편집 장치</span><strong>{display(item.edit)}</strong></div>
            </div>
            <DetailSection label="한줄 요약" value={item.summary} />
            <DetailSection label="반응 요인 가설" value={item.why} />
            <DetailSection label="우리 버전 제안" value={item.suggestions} />
            <a className="secondary-button full-button" href={item.url} target="_blank" rel="noreferrer"><Camera size={16} /> 원본 Instagram 콘텐츠 보기 <ArrowUpRight size={15} /></a>
          </>
        )}

        {!isAccount && !isContent && (
          <>
            <div className="detail-grid content-grid">
              <div><span>한줄 정의</span><strong>{display(item.definition || item.angle)}</strong></div>
              <div><span>훅 유형</span><strong>{display(item.hookType || item.authority)}</strong></div>
              <div><span>이식 가능성</span><strong>{display(item.portability || item.product)}</strong></div>
              <div><span>배정 가능</span><strong>{display(item.people)}</strong></div>
            </div>
            <DetailSection label={isFormat ? '구조' : '관련 키워드'} value={isFormat ? item.structure : item.keywords} />
            <DetailSection label={isFormat ? '각색안' : '진입 각도'} value={isFormat ? item.adaptation : item.angle} />
            <DetailSection label={isFormat ? '붙이기 좋은 주제' : '운영 메모'} value={isFormat ? item.topics : `${display(item.recent)} · ${display(item.saturation)}`} />
            {item.example && <a className="secondary-button full-button" href={item.example} target="_blank" rel="noreferrer"><Camera size={16} /> 대표 Instagram 보기 <ArrowUpRight size={15} /></a>}
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
  return <label className="search-box"><Search size={18} /><input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} /><kbd>⌘ K</kbd></label>;
}

function FilterSelect({ label, value, onChange, options }) {
  return <label className="filter-select"><span>{label}</span><select value={value} onChange={(event) => onChange(event.target.value)}><option value="all">전체</option>{options.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>;
}

function EmptyState({ label }) {
  return <div className="empty-state"><Database size={24} /><strong>{label} 데이터가 없습니다</strong><span>검색어나 필터를 바꿔보세요.</span></div>;
}

function AccountsView({ items, onOpen }) {
  const [type, setType] = useState('all');
  const [category, setCategory] = useState('all');
  const types = useMemo(() => [...new Set(items.map((item) => item.type).filter(Boolean))].sort(), [items]);
  const categories = useMemo(() => [...new Set(items.map((item) => item.category).filter(Boolean))].sort(), [items]);
  const filtered = items.filter((item) => (type === 'all' || item.type === type) && (category === 'all' || item.category === category));
  return <DataViewHeader eyebrow="ACCOUNTS" title="인플루언서 목록" description="약사·메디컬 계정, 주력 카테고리, 팔로워 수, 원본 Instagram 링크" count={filtered.length}>
    <div className="filter-row"><Filter size={16} /><FilterSelect label="계정 유형" value={type} onChange={setType} options={types} /><FilterSelect label="카테고리" value={category} onChange={setCategory} options={categories} /></div>
    <div className="account-table-wrap"><table><thead><tr><th>계정</th><th>유형</th><th>팔로워</th><th>주력 카테고리</th><th>배정 적합</th><th></th></tr></thead><tbody>{filtered.map((item) => <tr key={item.id} onClick={() => onOpen(item)}><td><div className="table-account"><div className="avatar">{String(item.name || item.handle).slice(0, 1)}</div><div><strong>{item.name}</strong><span>@{item.handle}</span></div></div></td><td><Badge>{display(item.type)}</Badge></td><td className="number-cell">{display(item.followers)}</td><td>{display(item.category)}</td><td>{display(item.assignment, '공용')}</td><td><a className="table-link" href={item.link} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()} aria-label={`${item.name} Instagram 열기`}><Camera size={16} /></a></td></tr>)}</tbody></table>{filtered.length === 0 && <EmptyState label="계정" />}</div>
  </DataViewHeader>;
}

function ContentsView({ items, onOpen }) {
  const [category, setCategory] = useState('all');
  const [format, setFormat] = useState('all');
  const categories = useMemo(() => [...new Set(items.map((item) => item.category).filter(Boolean))].sort(), [items]);
  const formats = useMemo(() => [...new Set(items.map((item) => item.format).filter(Boolean))].sort(), [items]);
  const filtered = items.filter((item) => (category === 'all' || item.category === category) && (format === 'all' || item.format === format));
  return <DataViewHeader eyebrow="CONTENTS" title="콘텐츠 목록" description="콘텐츠 제목, 인플루언서명과 핸들, 조회수·좋아요·댓글, 게시일, 원본 Instagram 링크" count={filtered.length}>
    <div className="filter-row"><Filter size={16} /><FilterSelect label="카테고리" value={category} onChange={setCategory} options={categories} /><FilterSelect label="형식" value={format} onChange={setFormat} options={formats} /></div>
    <div className="content-list"><div className="list-head"><span>콘텐츠 정보</span><span>성과 지표</span></div>{filtered.map((item) => <ContentListRow key={item.id} item={item} onOpen={onOpen} />)}</div>{filtered.length === 0 && <EmptyState label="콘텐츠" />}
  </DataViewHeader>;
}

function FormatsView({ items, onOpen }) {
  return <DataViewHeader eyebrow="FORMATS" title="포맷 목록" description="릴스 제작용 훅 유형, 구조 비트, 편집 장치, 이식 가능성" count={items.length}>
    <div className="list-panel">{items.map((item) => <FormatListRow key={item.id} item={item} onOpen={onOpen} />)}</div>
  </DataViewHeader>;
}

function TopicsView({ items, onOpen }) {
  return <DataViewHeader eyebrow="TOPICS" title="주제 목록" description="제품·증상·성분별 주제 후보, 약사 권위 활용도, 제품 연결 가능성" count={items.length}>
    <div className="topic-list">{items.map((item) => <button className="topic-row" key={item.id} onClick={() => onOpen(item)}><div className="topic-index">{String(item.title || '?').slice(0, 1)}</div><div className="topic-main"><strong>{item.title}</strong><span>{display(item.angle)} · {display(item.category)}</span></div><div className="topic-tags"><Badge tone="lime">권위 {display(item.authority)}</Badge><Badge>{display(item.product, '제품 연결 미기록')}</Badge></div><ChevronRight size={18} /></button>)}</div>
  </DataViewHeader>;
}

function DataViewHeader({ eyebrow, title, description, count, children }) {
  return <section className="view-section"><div className="section-intro"><div><div className="eyebrow mono">{eyebrow}</div><h1>{title}</h1><p>{description}</p></div><div className="result-count"><strong>{count}</strong><span>건</span></div></div>{children}</section>;
}

function Overview({ data, onOpen, onNavigate }) {
  const { accounts, contents, formats, topics } = data;
  const topAccounts = [...accounts].sort((a, b) => b.followerValue - a.followerValue).slice(0, 5);
  const topContents = [...contents].sort((a, b) => b.likeValue - a.likeValue).slice(0, 4);
  const categoryCounts = Object.entries(accounts.reduce((acc, item) => { const key = item.category || '기타'; acc[key] = (acc[key] || 0) + 1; return acc; }, {})).sort((a, b) => b[1] - a[1]).slice(0, 5);
  return <>
    <section className="hero-panel">
      <div className="hero-copy"><div className="eyebrow mono light">PHARM SOCIAL INTELLIGENCE · 2026.08</div><h1>약사·메디컬<br /><em>콘텐츠 인덱스</em></h1><p>공개 Instagram 프로필에서 모은 인플루언서·콘텐츠·포맷·주제 데이터</p><div className="hero-actions"><button className="primary-button" onClick={() => onNavigate('accounts')}>인플루언서 목록 <ArrowUpRight size={16} /></button><button className="ghost-button" onClick={() => onNavigate('contents')}>콘텐츠 목록 <ChevronRight size={16} /></button></div></div>
      <div className="hero-summary"><div><span>인플루언서</span><strong>{accounts.length}</strong></div><div><span>콘텐츠</span><strong>{contents.length}</strong></div><div><span>포맷</span><strong>{formats.length}</strong></div><div><span>주제</span><strong>{topics.length}</strong></div></div>
    </section>
    <div className="stat-grid"><StatCard label="인플루언서 목록" value={accounts.length} detail="약사·메디컬 공개 계정" accent="stat-lime" /><StatCard label="콘텐츠 목록" value={contents.length} detail="훅·구조·편집 장치" accent="stat-coral" /><StatCard label="포맷 목록" value={formats.length} detail="제작용 구조 템플릿" accent="stat-blue" /><StatCard label="주제 목록" value={topics.length} detail="이식 가능한 주제 후보" accent="stat-yellow" /></div>
    <div className="overview-grid">
      <section className="panel spotlight-panel"><div className="panel-head"><div><div className="eyebrow">팔로워 상위 계정</div><h2>주목 계정</h2></div><button className="text-button" onClick={() => onNavigate('accounts')}>전체 목록 <ArrowUpRight size={14} /></button></div><div className="rank-list">{topAccounts.map((item, index) => <button className="rank-row" key={item.id} onClick={() => onOpen(item)}><span className="rank-number">0{index + 1}</span><div className="avatar">{String(item.name || item.handle).slice(0, 1)}</div><div className="rank-info"><strong>{item.name}</strong><span>@{item.handle} · {display(item.category)}</span></div><div className="rank-value"><strong>{display(item.followers)}</strong><span>팔로워</span></div><ChevronRight size={16} /></button>)}</div></section>
      <section className="panel category-panel"><div className="panel-head"><div><div className="eyebrow">계정 카테고리</div><h2>카테고리 분포</h2></div><CircleDot size={18} className="muted-icon" /></div><div className="bar-list">{categoryCounts.map(([label, value]) => <div className="bar-row" key={label}><div className="bar-label"><span>{label}</span><strong>{value}</strong></div><div className="bar-track"><div className="bar-fill" style={{ width: `${Math.max(10, (value / categoryCounts[0][1]) * 100)}%` }} /></div></div>)}</div><div className="category-foot"><span><span className="dot dot-lime"></span>상위 5개 카테고리</span><strong>{categoryCounts.reduce((sum, [, value]) => sum + value, 0)}개 계정</strong></div></section>
    </div>
    <section className="panel recent-panel"><div className="panel-head"><div><div className="eyebrow">콘텐츠 성과 지표</div><h2>주요 콘텐츠</h2></div><button className="text-button" onClick={() => onNavigate('contents')}>전체 목록 <ArrowUpRight size={14} /></button></div><div className="content-list compact-content-list"><div className="list-head"><span>콘텐츠 정보</span><span>성과 지표</span></div>{topContents.map((item) => <ContentListRow key={item.id} item={item} onOpen={onOpen} />)}</div></section>
    <div className="data-note"><Check size={16} /> 공개 Instagram 프로필에서 확인한 데이터 · 인플루언서 계정 {accounts.length}개 · 2026.08.05 기준</div>
  </>;
}

function App() {
  const [data, setData] = useState(null);
  const [view, setView] = useState('overview');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all(Object.entries(DATA_FILES).map(async ([key, path]) => [key, await parseCsv(path)])).then((entries) => setData(normalizeData(Object.fromEntries(entries)))).catch(() => setError('공개 데이터 파일을 읽지 못했습니다. 잠시 후 새로고침해 주세요.'));
  }, []);

  useEffect(() => {
    const handler = (event) => { if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); document.querySelector('.global-search input')?.focus(); } };
    window.addEventListener('keydown', handler); return () => window.removeEventListener('keydown', handler);
  }, []);

  const filteredData = useMemo(() => {
    if (!data || !search.trim()) return data;
    const query = search.toLowerCase();
    const includes = (item) => Object.values(item).some((value) => String(value || '').toLowerCase().includes(query));
    return Object.fromEntries(Object.entries(data).map(([key, items]) => [key, items.filter(includes)]));
  }, [data, search]);

  if (error) return <div className="fatal-error"><Database size={30} /><h1>데이터를 불러오지 못했습니다.</h1><p>{error}</p></div>;
  if (!data) return <div className="loading-screen"><div className="loading-mark"><Sparkles size={22} /></div><strong>데이터 준비 중</strong><span>인플루언서·콘텐츠 목록을 불러옵니다</span></div>;

  const currentData = filteredData || data;
  const renderView = () => {
    if (view === 'overview') return <Overview data={data} onOpen={setSelected} onNavigate={setView} />;
    if (view === 'accounts') return <AccountsView items={currentData.accounts} onOpen={setSelected} />;
    if (view === 'contents') return <ContentsView items={currentData.contents} onOpen={setSelected} />;
    if (view === 'formats') return <FormatsView items={currentData.formats} onOpen={setSelected} />;
    return <TopicsView items={currentData.topics} onOpen={setSelected} />;
  };

  return <div className="app-shell">
    <aside className={`sidebar ${sidebarOpen ? 'sidebar-open' : ''}`}><div className="brand"><div className="brand-mark"><Sparkles size={17} /></div><div><strong>PHARM<span>·</span>SI</strong><small>social intelligence</small></div></div><div className="workspace-switcher"><span className="workspace-dot"></span><div><small>WORKSPACE</small><strong>웰니스 콘텐츠팀</strong></div><ChevronRight size={15} /></div><nav>{NAV_ITEMS.map(({ id, label, icon: Icon, key }) => <button key={id} className={view === id ? 'active' : ''} onClick={() => { setView(id); setSidebarOpen(false); }}><Icon size={17} /><span>{label}</span>{key && <em>{data[key].length}</em>}</button>)}</nav><div className="sidebar-bottom"><div className="source-card"><div className="source-icon"><Database size={16} /></div><div><strong>공개 데이터 인덱스</strong><span>2026.08.05 업데이트</span></div></div><div className="sidebar-legal">Team workspace · Internal use</div></div></aside>
    <main className="main-content"><header className="topbar"><button className="mobile-menu" onClick={() => setSidebarOpen(!sidebarOpen)} aria-label="메뉴 열기"><Menu size={20} /></button><div className="breadcrumb"><span>WORKSPACE</span><ChevronRight size={14} /><strong>{NAV_ITEMS.find((item) => item.id === view)?.label}</strong></div><div className="topbar-actions"><SearchBar value={search} onChange={setSearch} placeholder="인플루언서·주제·훅 검색" /></div></header><div className="content-wrap">{view !== 'overview' && <div className="global-search"><SearchBar value={search} onChange={setSearch} placeholder="현재 목록에서 검색" />{search && <button className="clear-search" onClick={() => setSearch('')} aria-label="검색어 지우기"><X size={15} /></button>}</div>}{renderView()}</div></main><DetailModal item={selected} onClose={() => setSelected(null)} />
  </div>;
}

createRoot(document.getElementById('root')).render(<App />);
