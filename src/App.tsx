import React, { useCallback, useEffect, useRef, useState } from 'react';
import ePub, { Book, Rendition } from 'epubjs';
import {
  BookOpen, List, Search, Settings2, Bookmark, Highlighter, StickyNote,
  ChevronRight, ChevronLeft, Sun, Moon, Coffee, Maximize, Minimize,
  Plus, Minus, X, Menu, PanelLeftClose, PanelLeftOpen, Check, Trash2,
  Keyboard, RotateCcw, AlignJustify, Type, Save, ArrowUpRight
} from 'lucide-react';

type Theme = 'dark' | 'light' | 'sepia';
type Mark = { id: string; cfi: string; label: string; note?: string; color?: string; quote?: string; };
const STORAGE = 'reader-astorat-frame-v1';
const bookUrl = '/Epub-reader/books/book.epub';
function readSaved() {
  try { return JSON.parse(localStorage.getItem(STORAGE) || '{}'); } catch { return {}; }
}
function persist(patch: Record<string, unknown>) {
  const prev = readSaved(); localStorage.setItem(STORAGE, JSON.stringify({ ...prev, ...patch }));
}

export default function App() {
  const hostRef = useRef<HTMLDivElement>(null);
  const bookRef = useRef<Book | null>(null);
  const renditionRef = useRef<Rendition | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [title, setTitle] = useState('أسطورة الإطار');
  const [authors, setAuthors] = useState('كارل بوبر، مارك أ. نوترنو');
  const [toc, setToc] = useState<any[]>([]);
  const [chapter, setChapter] = useState('جارٍ فتح الكتاب…');
  const [progress, setProgress] = useState(0);
  const [location, setLocation] = useState('');
  const [theme, setTheme] = useState<Theme>(() => readSaved().theme || 'dark');
  const [mode, setMode] = useState<'paginated'|'scrolled'>('paginated');
  const [fontSize, setFontSize] = useState(19);
  const [lineHeight, setLineHeight] = useState(1.85);
  const [fontFamily, setFontFamily] = useState('Noto Kufi Arabic');
  const [width, setWidth] = useState(760);
  const [panel, setPanel] = useState<'toc'|'search'|'settings'|'marks'|'notes'|'shortcuts'|null>(null);
  const [marks, setMarks] = useState<Mark[]>([]);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [noteDraft, setNoteDraft] = useState('');
  const [selection, setSelection] = useState<{cfi:string; quote:string}|null>(null);
  const [highlightColor, setHighlightColor] = useState('#d6b77c');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);

  const applyTheme = useCallback((next: Theme) => {
    setTheme(next); persist({theme: next});
    const r = renditionRef.current;
    if (!r) return;
    const palettes: Record<Theme, any> = {
      dark: { body: { background: '#202020 !important', color: '#e8e4dc !important' }, 'p, div, span, li': { color: '#e8e4dc !important' }, a: { color: '#c6a77b !important' } },
      light: { body: { background: '#f8f6f1 !important', color: '#282722 !important' }, 'p, div, span, li': { color: '#282722 !important' }, a: { color: '#8a6336 !important' } },
      sepia: { body: { background: '#f1e6d0 !important', color: '#4d3827 !important' }, 'p, div, span, li': { color: '#4d3827 !important' }, a: { color: '#8b5e34 !important' } }
    };
    try { r.themes.register('reader-theme', palettes[next]); r.themes.select('reader-theme'); } catch {}
  }, []);

  const applyTypography = useCallback(() => {
    const r = renditionRef.current;
    if (!r) return;
    r.themes.fontSize(`${fontSize}px`);
    r.themes.override('line-height', String(lineHeight), true);
    r.themes.override('font-family', `"${fontFamily}", serif`, true);
    r.themes.override('text-align', 'justify', true);
    r.themes.override('direction', 'rtl', true);
    r.themes.override('padding', '0 2.5% !important', true);
  }, [fontSize, lineHeight, fontFamily]);

  useEffect(() => {
    const saved = readSaved();
    setFontSize(saved.fontSize || 19);
    setLineHeight(saved.lineHeight || 1.85);
    setFontFamily(saved.fontFamily || 'Noto Kufi Arabic');
    setWidth(saved.width || 760);
    setMode(saved.mode || 'paginated');
    setMarks(saved.marks || []);
    const book = ePub(bookUrl);
    bookRef.current = book;
    const rendition = book.renderTo(hostRef.current!, {
      width: '100%', height: '100%', flow: saved.mode === 'scrolled' ? 'scrolled-doc' : 'paginated',
      spread: 'none', manager: 'default', allowScriptedContent: false
    });
    renditionRef.current = rendition;
    rendition.on('relocated', (loc: any) => {
      if (!loc?.start) return;
      const cfi = loc.start.cfi || '';
      setLocation(cfi);
      const pct = book.locations?.percentageFromCfi(cfi);
      if (typeof pct === 'number' && Number.isFinite(pct)) setProgress(Math.round(pct * 100));
      const item = book.navigation?.get(loc.start.href);
      if (item?.label) setChapter(item.label.trim());
      else if (loc.start.href) {
        const navItem = book.navigation?.toc?.find((x: any) => x.href.split('#')[0] === loc.start.href.split('#')[0]);
        if (navItem?.label) setChapter(navItem.label.trim());
      }
      persist({ location: cfi, progress: Math.round((pct || 0) * 100), mode });
    });
    Promise.all([book.ready, book.loaded.navigation, book.loaded.metadata]).then(async ([, nav, meta]) => {
      setToc(nav.toc || []);
      if (meta.title) setTitle(meta.title);
      if (meta.creator) setAuthors(Array.isArray(meta.creator) ? meta.creator.join('، ') : meta.creator);
      await book.locations.generate(1200);
      setReady(true);
      applyTheme(saved.theme || 'dark');
      applyTypography();
      const start = saved.location || undefined;
      await rendition.display(start);
      setTimeout(() => { applyTheme(saved.theme || 'dark'); applyTypography(); }, 250);
    }).catch((err) => setError('تعذّر فتح الكتاب. تأكد من سلامة ملف EPUB. ' + (err?.message || '')));
    const onSelected = (cfiRange: string, contents: any) => {
      try {
        const sel = contents.window.getSelection();
        const quote = sel?.toString().trim();
        if (quote) setSelection({cfi: cfiRange, quote});
      } catch {}
    };
    rendition.on('selected', onSelected);
    return () => { try { rendition.destroy(); book.destroy(); } catch {} };
    // Initialize once; typography/theme are applied through separate effects.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { applyTheme(theme); }, [theme, applyTheme]);
  useEffect(() => { applyTypography(); persist({fontSize, lineHeight, fontFamily, width}); }, [applyTypography, fontSize, lineHeight, fontFamily, width]);

  const goNext = useCallback(() => renditionRef.current?.next(), []);
  const goPrev = useCallback(() => renditionRef.current?.prev(), []);
  const jump = useCallback((href: string) => {
    renditionRef.current?.display(href);
    setPanel(null); setSidebarOpen(false);
  }, []);

  const toggleMode = async () => {
    const r = renditionRef.current; if (!r) return;
    const current = location;
    const next = mode === 'paginated' ? 'scrolled' : 'paginated';
    setMode(next); persist({mode: next});
    try {
      r.flow(next === 'scrolled' ? 'scrolled-doc' : 'paginated');
      await r.display(current || undefined);
    } catch {}
  };

  const addBookmark = () => {
    if (!location) return;
    const item = {id: crypto.randomUUID(), cfi: location, label: chapter || 'موضع محفوظ', quote: ''};
    const next = [...marks, item]; setMarks(next); persist({marks: next});
  };
  const addHighlight = () => {
    if (!selection || !renditionRef.current) return;
    const item: Mark = {id: crypto.randomUUID(), cfi: selection.cfi, label: chapter, quote: selection.quote, color: highlightColor};
    try {
      renditionRef.current.annotations.highlight(selection.cfi, {color: highlightColor, fill: highlightColor, 'fill-opacity': '0.28'}, (e: any) => {
        if (e?.target) e.target.style.cursor = 'pointer';
      }, 'reader-highlight');
    } catch {}
    const next = [...marks, item]; setMarks(next); persist({marks: next}); setSelection(null);
  };
  const removeMark = (id: string) => {
    const item = marks.find(m => m.id === id);
    if (item?.color) try { renditionRef.current?.annotations.remove(item.cfi, 'highlight'); } catch {}
    const next = marks.filter(m => m.id !== id); setMarks(next); persist({marks: next});
  };
  const saveNote = () => {
    if (!selection || !noteDraft.trim()) return;
    const item: Mark = {id: crypto.randomUUID(), cfi: selection.cfi, label: chapter, quote: selection.quote, note: noteDraft.trim()};
    const next = [...marks, item]; setMarks(next); persist({marks: next}); setSelection(null); setNoteDraft('');
  };
  const updateNote = (id: string, note: string) => {
    const next = marks.map(m => m.id === id ? {...m, note} : m); setMarks(next); persist({marks: next});
  };

  const searchBook = async () => {
    const q = query.trim(); if (!q || !bookRef.current) return;
    setSearching(true); setResults([]);
    const book = bookRef.current;
    const found: any[] = [];
    try {
      await book.spine.each(async (item: any) => {
        const doc = await item.load(book.load.bind(book));
        const body = doc?.body;
        if (!body) return;
        const text = body.textContent || '';
        const lower = text.toLocaleLowerCase();
        const needle = q.toLocaleLowerCase();
        let index = lower.indexOf(needle);
        while (index >= 0 && found.length < 100) {
          const start = Math.max(0, index - 85), end = Math.min(text.length, index + q.length + 110);
          const excerpt = text.slice(start, end).replace(/\s+/g, ' ').trim();
          found.push({href: item.href, excerpt, cfi: item.cfiFromRange ? null : undefined, index});
          index = lower.indexOf(needle, index + needle.length);
        }
        item.unload();
      });
      setResults(found);
    } catch { setResults([]); }
    setSearching(false);
  };

  const fullscreen = async () => {
    try {
      if (!document.fullscreenElement) await document.documentElement.requestFullscreen();
      else await document.exitFullscreen();
    } catch { setIsFullscreen(v => !v); }
  };
  useEffect(() => {
    const listener = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', listener);
    return () => document.removeEventListener('fullscreenchange', listener);
  }, []);

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target && ['INPUT','TEXTAREA','SELECT'].includes(target.tagName)) return;
      if (e.key === 'ArrowRight') { e.preventDefault(); goNext(); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); goPrev(); }
      if (e.key === '+' || e.key === '=') setFontSize(s => Math.min(34, s + 1));
      if (e.key === '-') setFontSize(s => Math.max(13, s - 1));
      if (e.key.toLowerCase() === 't') setPanel(p => p === 'toc' ? null : 'toc');
      if (e.key.toLowerCase() === 's') setPanel(p => p === 'search' ? null : 'search');
      if (e.key.toLowerCase() === 'f') fullscreen();
      if (e.key === 'Escape') { setPanel(null); setSidebarOpen(false); }
      if (e.key === '?') setShowShortcuts(v => !v);
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [goNext, goPrev]);

  const nestedToc = (items: any[], depth = 0) => items.map((item: any, i: number) => (
    <React.Fragment key={`${item.id || item.href}-${i}`}>
      <button className={`toc-item depth-${Math.min(depth, 3)}`} onClick={() => jump(item.href)} title={item.label}>
        <span>{item.label}</span>{chapter === item.label && <span className="active-dot" />}
      </button>
      {item.subitems?.length > 0 && nestedToc(item.subitems, depth + 1)}
    </React.Fragment>
  ));

  return <div className={`app theme-${theme} ${isFullscreen ? 'fullscreen' : ''}`} dir="rtl">
    <header className="topbar">
      <div className="brand">
        <div className="brand-mark"><BookOpen size={18}/></div>
        <div className="brand-copy"><strong>{title || 'قارئ'}</strong><span>{authors}</span></div>
      </div>
      <div className="chapter-chip"><span className="live-dot"/><span>{chapter}</span></div>
      <div className="toolbar">
        <button className={`icon-btn ${panel==='toc'?'selected':''}`} title="الفهرس (T)" onClick={() => setPanel(panel==='toc'?null:'toc')}><List/></button>
        <button className={`icon-btn ${panel==='search'?'selected':''}`} title="بحث (S)" onClick={() => setPanel(panel==='search'?null:'search')}><Search/></button>
        <button className={`icon-btn ${panel==='marks'?'selected':''}`} title="العلامات والاقتباسات" onClick={() => setPanel(panel==='marks'?null:'marks')}><Bookmark/></button>
        <button className={`icon-btn ${panel==='settings'?'selected':''}`} title="إعدادات القراءة" onClick={() => setPanel(panel==='settings'?null:'settings')}><Settings2/></button>
        <div className="theme-switch">
          <button title="داكن" className={theme==='dark'?'active':''} onClick={() => applyTheme('dark')}><Moon size={15}/></button>
          <button title="فاتح" className={theme==='light'?'active':''} onClick={() => applyTheme('light')}><Sun size={15}/></button>
          <button title="ورقي" className={theme==='sepia'?'active':''} onClick={() => applyTheme('sepia')}><Coffee size={15}/></button>
        </div>
        <button className="icon-btn" title="ملء الشاشة (F)" onClick={fullscreen}>{isFullscreen?<Minimize/>:<Maximize/>}</button>
      </div>
    </header>

    <div className="reading-progress"><div style={{width:`${progress}%`}}/><span>{progress}%</span></div>

    <main className="workspace">
      {panel && <aside className="panel">
        <div className="panel-head">
          <div className="panel-title">
            {panel==='toc' && <><List/><span>فهرس الكتاب</span></>}
            {panel==='search' && <><Search/><span>ابحث في الكتاب</span></>}
            {panel==='settings' && <><Settings2/><span>إعدادات القراءة</span></>}
            {panel==='marks' && <><Bookmark/><span>علاماتك وملاحظاتك</span></>}
            {panel==='notes' && <><StickyNote/><span>ملاحظات</span></>}
            {panel==='shortcuts' && <><Keyboard/><span>اختصارات لوحة المفاتيح</span></>}
          </div><button className="icon-btn small" onClick={() => setPanel(null)}><X/></button>
        </div>
        {panel==='toc' && <div className="panel-scroll toc-list">{toc.length ? nestedToc(toc) : <div className="empty">سيظهر الفهرس بعد تحميل الكتاب.</div>}</div>}
        {panel==='search' && <div className="panel-content">
          <div className="search-box"><Search size={17}/><input value={query} onChange={e=>setQuery(e.target.value)} onKeyDown={e=>e.key==='Enter'&&searchBook()} placeholder="ابحث عن كلمة أو عبارة…"/><button onClick={searchBook} disabled={searching}>{searching?'…':'بحث'}</button></div>
          <p className="hint">يبحث في نصوص فصول الكتاب بالكامل.</p>
          <div className="search-results">{searching ? <div className="empty">جارٍ البحث في صفحات الكتاب…</div> : results.map((r,i)=><button className="result" key={i} onClick={()=>jump(r.href)}><span className="result-chapter">{r.href.split('/').pop()}</span><p>{r.excerpt}</p><ArrowUpRight size={15}/></button>)}
          {!searching && query && results.length===0 && <div className="empty">لا توجد نتائج. جرّب كلمة أخرى.</div>}</div>
        </div>}
        {panel==='settings' && <div className="panel-content settings">
          <section><h3><Type size={16}/> الخط والقراءة</h3>
            <label>حجم الخط <strong>{fontSize}px</strong></label><div className="range-row"><button className="mini-btn" onClick={()=>setFontSize(s=>Math.max(13,s-1))}><Minus/></button><input type="range" min="13" max="34" value={fontSize} onChange={e=>setFontSize(+e.target.value)}/><button className="mini-btn" onClick={()=>setFontSize(s=>Math.min(34,s+1))}><Plus/></button></div>
            <label>ارتفاع السطر <strong>{lineHeight.toFixed(2)}</strong></label><input type="range" min="1.3" max="2.4" step=".05" value={lineHeight} onChange={e=>setLineHeight(+e.target.value)}/>
            <label>عرض النص <strong>{width}px</strong></label><input type="range" min="520" max="1000" step="20" value={width} onChange={e=>setWidth(+e.target.value)}/>
            <label>نوع الخط</label><select value={fontFamily} onChange={e=>setFontFamily(e.target.value)}><option>Noto Kufi Arabic</option><option>Georgia</option><option>serif</option><option>Arial</option><option>Tahoma</option></select>
          </section>
          <section><h3><AlignJustify size={16}/> طريقة القراءة</h3>
            <div className="mode-options"><button className={mode==='paginated'?'active':''} onClick={()=>mode!=='paginated'&&toggleMode()}>صفحات</button><button className={mode==='scrolled'?'active':''} onClick={()=>mode!=='scrolled'&&toggleMode()}>تمرير مستمر</button></div>
            <p className="hint">حافظنا على موضعك قدر الإمكان عند تغيير طريقة القراءة.</p>
          </section>
          <section><h3>الثيم</h3><div className="mode-options"><button className={theme==='dark'?'active':''} onClick={()=>applyTheme('dark')}>داكن</button><button className={theme==='light'?'active':''} onClick={()=>applyTheme('light')}>فاتح</button><button className={theme==='sepia'?'active':''} onClick={()=>applyTheme('sepia')}>ورقي</button></div></section>
          <button className="reset-btn" onClick={()=>{setFontSize(19);setLineHeight(1.85);setWidth(760);setFontFamily('Noto Kufi Arabic')}}><RotateCcw size={15}/> استعادة الإعدادات الافتراضية</button>
        </div>}
        {panel==='marks' && <div className="panel-content marks-list">
          <button className="add-current" onClick={addBookmark}><Plus size={16}/> حفظ موضع القراءة الحالي</button>
          {selection && <div className="selection-card"><span className="selection-label">النص المحدد</span><p>{selection.quote}</p><div className="color-row">{['#d6b77c','#e5a3a3','#9ab8d7','#a8c9a0'].map(c=><button key={c} style={{background:c}} className={highlightColor===c?'color-selected':''} onClick={()=>setHighlightColor(c)}/>)}</div><div className="selection-actions"><button onClick={addHighlight}><Highlighter size={14}/> تظليل</button><input value={noteDraft} onChange={e=>setNoteDraft(e.target.value)} placeholder="أضف ملاحظة…"/><button onClick={saveNote} disabled={!noteDraft.trim()}><Save size={14}/> حفظ</button></div></div>}
          {marks.length===0 && !selection && <div className="empty"><Bookmark size={25}/><p>لم تحفظ أي مواضع بعد.</p><span>يمكنك حفظ موضعك الحالي أو تحديد نص لإضافة تظليل وملاحظة.</span></div>}
          {marks.map(m=><div className="mark-card" key={m.id}><button className="mark-main" onClick={()=>jump(m.cfi)}><span className="mark-type">{m.note?<StickyNote size={14}/>:m.color?<Highlighter size={14}/>:<Bookmark size={14}/>} {m.label || 'موضع محفوظ'}</span>{m.quote&&<p className="mark-quote">{m.quote}</p>}{m.note&&<p className="mark-note">{m.note}</p>}</button>{m.note&&<textarea value={m.note} onChange={e=>updateNote(m.id,e.target.value)} aria-label="تعديل الملاحظة"/>}<div className="mark-actions"><button onClick={()=>jump(m.cfi)}>انتقل إلى الموضع</button><button className="danger" onClick={()=>removeMark(m.id)}><Trash2 size={14}/> حذف</button></div></div>)}
        </div>}
      </aside>}

      <section className="reader-column">
        <div className="reader-heading">
          <div className="book-cover-mark"><BookOpen size={20}/></div>
          <div><span className="eyebrow">مساحة القراءة</span><h1>{title}</h1><p>{authors}</p></div>
          <button className="bookmark-current" onClick={addBookmark} title="حفظ موضع القراءة"><Bookmark size={17}/></button>
        </div>
        <div className="reader-frame" style={{maxWidth:width}}>
          {!ready && !error && <div className="loading"><div className="loader"/><strong>نهيّئ صفحات كتابك</strong><span>يتم تحميل النص والفهرس…</span></div>}
          {error && <div className="error-state"><BookOpen/><h3>لم نتمكن من فتح الكتاب</h3><p>{error}</p><button onClick={()=>window.location.reload()}>إعادة المحاولة</button></div>}
          <div ref={hostRef} className={`epub-host ${mode==='scrolled'?'scroll-mode':''}`} />
        </div>
        <div className="reader-bottom">
          <button className="nav-button" onClick={goPrev} disabled={!ready}><ChevronRight/><span>السابق</span></button>
          <div className="bottom-center"><span>{progress}% مقروء</span><div className="bottom-track"><div style={{width:`${progress}%`}}/></div></div>
          <button className="nav-button primary" onClick={goNext} disabled={!ready}><span>التالي</span><ChevronLeft/></button>
        </div>
        <div className="reader-footnote"><span>قراءة هادئة، على مهل.</span><button onClick={()=>setShowShortcuts(true)}><Keyboard size={13}/> اختصارات لوحة المفاتيح</button></div>
      </section>
    </main>

    <footer className="statusbar"><span><span className="status-dot"/> الكتاب مضمّن داخل التطبيق</span><span>تُحفظ العلامات والإعدادات على هذا الجهاز فقط</span></footer>

    {showShortcuts && <div className="modal-backdrop" onClick={()=>setShowShortcuts(false)}><div className="shortcuts-modal" onClick={e=>e.stopPropagation()}><div className="panel-head"><div className="panel-title"><Keyboard/><span>اختصارات لوحة المفاتيح</span></div><button className="icon-btn small" onClick={()=>setShowShortcuts(false)}><X/></button></div><div className="shortcut-list">{[['← / →','الصفحة السابقة / التالية'],['+ / −','تكبير / تصغير الخط'],['T','فتح الفهرس'],['S','فتح البحث'],['F','ملء الشاشة'],['Esc','إغلاق اللوحة'],['?','عرض هذه النافذة']].map(([k,v])=><div key={k}><kbd>{k}</kbd><span>{v}</span></div>)}</div></div></div>}
    {selection && panel!=='marks' && <button className="selection-float" onClick={()=>setPanel('marks')}><Highlighter size={16}/> تظليل أو إضافة ملاحظة</button>}
  </div>;
}
