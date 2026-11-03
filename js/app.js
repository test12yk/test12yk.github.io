import { ARTISTS, WORKS, ARTIST_BY_ID, WORK_BY_ID, worksOf } from './data.js';
import { boardSvg, PIECES } from './puzzle.js';
import { nextQuestion } from './quiz.js';
import { createStore } from './store.js';
import { speakAll, stopSpeaking, ttsSupported } from './tts.js';

const store = createStore();
const $view = document.getElementById('view');
const $title = document.getElementById('title');
const $back = document.getElementById('back');

const esc = (s) => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const readyWorks = () => WORKS.filter(w => ARTIST_BY_ID[w.artist].ready);

// 날짜마다 바뀌는 오늘의 명화
function todaysWork() {
  const list = readyWorks();
  const day = Math.floor((Date.now() + 9 * 3600e3) / 86400e3); // 한국 시간 기준 날짜
  return list[day % list.length];
}

// 퍼즐 화면의 세션 상태 (새로고침하면 초기화돼도 괜찮은 것들)
// answered: 맞힌 보기 index / wrongs: 틀린 보기들 / retryPrompt: "다시 풀기·정답 보기" 고르는 중 / revealed: 정답 보기를 누름
const session = { question: null, answered: null, wrongs: [], retryPrompt: false, revealed: false, recent: [], fresh: -1, workTab: 'story' };
function resetQuestion() {
  Object.assign(session, { question: null, answered: null, wrongs: [], retryPrompt: false, revealed: false, fresh: -1 });
}

// ───────── 공통 조각 ─────────
const pieceCount = (id) => store.pieces(id).length;

function puzzleBadge(id) {
  const n = pieceCount(id);
  if (n >= PIECES) return '<span class="badge done">🧩 완성</span>';
  if (n > 0) return `<span class="badge">🧩 ${n}/${PIECES}</span>`;
  return '';
}

function workCard(w, { showArtist = true } = {}) {
  const a = ARTIST_BY_ID[w.artist];
  return `<a class="work-card" href="#/work/${w.id}">
    <div class="thumb"><img src="${w.thumb}" alt="" loading="lazy">${puzzleBadge(w.id)}</div>
    <div class="wc-title">${esc(w.title)}</div>
    ${showArtist ? `<div class="wc-sub">${esc(a.name)} · ${esc(w.year)}</div>` : `<div class="wc-sub">${esc(w.year)}</div>`}
  </a>`;
}

function miniPuzzle(w) {
  const n = pieceCount(w.id);
  return `<a class="mini-puzzle" href="#/puzzle/${w.id}">
    <div class="mini-board">${boardSvg(w, store.pieces(w.id), { image: w.thumb, outlines: n < PIECES })}</div>
    <div class="wc-title">${n > 0 ? esc(w.title) : '???'}</div>
    <div class="wc-sub">${esc(ARTIST_BY_ID[w.artist].name)}</div>
    <div class="bar"><span style="width:${(n / PIECES) * 100}%"></span></div>
  </a>`;
}

// ───────── 화면들 ─────────
function homeView() {
  const t = todaysWork();
  const a = ARTIST_BY_ID[t.artist];
  const cur = store.state.current && WORK_BY_ID[store.state.current];
  const doneCount = readyWorks().filter(w => store.isComplete(w.id)).length;
  const s = store.state.stats;
  const continueCard = cur && !store.isComplete(cur.id)
    ? `<a class="card continue" href="#/puzzle/${cur.id}">
        <div class="mini-board small">${boardSvg(cur, store.pieces(cur.id), { image: cur.thumb })}</div>
        <div><div class="eyebrow">이어서 맞추기</div><div class="h3">${pieceCount(cur.id) ? esc(cur.title) : '새 그림'}</div>
        <div class="muted">${pieceCount(cur.id)}/${PIECES} 조각 · 문제를 맞히면 조각이 채워져요</div></div>
      </a>`
    : `<a class="card continue cta" href="#/puzzles">
        <div class="big-emoji">🧩</div>
        <div><div class="eyebrow">명화 퍼즐</div><div class="h3">문제를 풀고 그림을 완성해 보세요</div>
        <div class="muted">맞힐 때마다 퍼즐 조각이 하나씩 채워져요</div></div>
      </a>`;

  return `
    <section class="today">
      <div class="eyebrow">오늘의 명화</div>
      <a href="#/work/${t.id}" class="today-img"><img src="${t.image}" alt="${esc(t.title)}"></a>
      <h2 class="serif">${esc(t.title)}</h2>
      <div class="muted">${esc(a.name)} · ${esc(t.year)}</div>
      <p class="lead">${esc(t.summary)}</p>
      <a class="btn" href="#/work/${t.id}">이야기 읽기 →</a>
    </section>
    ${continueCard}
    <section>
      <div class="section-head"><h3>작가</h3><a href="#/artists">전체 보기</a></div>
      <div class="hscroll">
        ${ARTISTS.filter(x => x.ready).map(x => `<a class="artist-chip" href="#/artist/${x.id}">
          <img src="${worksOf(x.id)[0].thumb}" alt=""><span>${esc(x.name)}</span></a>`).join('')}
      </div>
    </section>
    <section class="stats">
      <div><b>${doneCount}</b><span>완성한 퍼즐<br>/ ${readyWorks().length}점</span></div>
      <div><b>${s.answered ? Math.round((s.correct / s.answered) * 100) : 0}%</b><span>정답률<br>${s.correct}/${s.answered}</span></div>
      <div><b>${s.best}</b><span>최고<br>연속 정답</span></div>
    </section>`;
}

function artistsView() {
  return `<p class="muted pad">작가를 눌러 생애와 작품을 만나 보세요.</p>
    <div class="artist-list">
    ${ARTISTS.map(a => {
      const works = a.ready ? worksOf(a.id) : [];
      return `<a class="artist-row${a.ready ? '' : ' soon'}" href="#/artist/${a.id}">
        <div class="ar-img">${works[0] ? `<img src="${works[0].thumb}" alt="">` : '<span>🖼</span>'}</div>
        <div class="ar-body"><div class="h3">${esc(a.name)}</div>
          <div class="muted">${esc(a.years)} · ${esc(a.nation)} · ${esc(a.movement)}</div>
          <div class="ar-tag">${a.ready ? `${works.length}점` : '준비 중'}</div></div>
      </a>`;
    }).join('')}
    </div>`;
}

function artistView(id) {
  const a = ARTIST_BY_ID[id];
  if (!a) return notFound();
  const head = `<header class="artist-head">
      <div class="eyebrow">${esc(a.nation)} · ${esc(a.movement)}</div>
      <h2 class="serif">${esc(a.name)}</h2>
      <div class="muted">${esc(a.nameOrig)} · ${esc(a.years)}</div>
      <p class="lead">"${esc(a.tagline)}"</p>
    </header>`;
  if (!a.ready) return `${head}<div class="card soon-card">이 작가의 작품과 이야기는 곧 추가될 예정이에요. 🎨</div>`;
  return `${head}
    <section class="prose">${a.bio.map(p => `<p>${esc(p)}</p>`).join('')}</section>
    <section><h3>생애</h3><ol class="timeline">
      ${a.timeline.map(([y, t]) => `<li><b>${esc(y)}</b><span>${esc(t)}</span></li>`).join('')}
    </ol></section>
    <section><h3>작품</h3><div class="grid">${worksOf(id).map(w => workCard(w, { showArtist: false })).join('')}</div></section>`;
}

function workView(id) {
  const w = WORK_BY_ID[id];
  if (!w) return notFound();
  const a = ARTIST_BY_ID[w.artist];
  const tab = session.workTab;
  const siblings = worksOf(w.artist);
  const i = siblings.indexOf(w);
  const prev = siblings[(i - 1 + siblings.length) % siblings.length];
  const next = siblings[(i + 1) % siblings.length];
  const n = pieceCount(w.id);
  const puzzleLabel = n >= PIECES ? '🧩 완성한 퍼즐' : n ? `🧩 퍼즐 ${n}/${PIECES}` : '🧩 퍼즐 맞추기';

  const hotspots = w.details.map((d, k) =>
    `<button class="hotspot" data-act="hotspot" data-k="${k}" style="left:${d.x}%;top:${d.y}%" aria-label="${k + 1}. ${esc(d.title)}">${k + 1}</button>`).join('');

  const body = {
    story: `<div class="prose">${w.story.map(p => `<p>${esc(p)}</p>`).join('')}</div>`,
    details: `<ol class="detail-list">${w.details.map((d, k) => `<li id="dt-${k}" data-act="hotspot" data-k="${k}"><b>${k + 1}. ${esc(d.title)}</b><span>${esc(d.text)}</span></li>`).join('')}</ol>`,
    background: `<div class="prose">${w.background.map(p => `<p>${esc(p)}</p>`).join('')}</div>
      <p class="credit">이미지: <a href="${w.credit.source}" target="_blank" rel="noopener">위키미디어 공용</a> (${esc(w.credit.license)})</p>`,
  }[tab];

  return `
    <figure class="art${tab === 'details' ? ' show-hotspots' : ''}" style="aspect-ratio:${w.width}/${w.height}">
      <img src="${w.image}" alt="${esc(w.title)}" data-act="zoom">
      ${hotspots}
    </figure>
    ${tab === 'details' ? '<div class="hs-caption" id="hs-caption">그림 위의 번호를 눌러 보세요.</div>' : ''}
    <header class="work-head">
      <h2 class="serif">${esc(w.title)}</h2>
      <div class="muted orig">${esc(w.titleOrig)}</div>
      <a class="artist-link" href="#/artist/${a.id}">${esc(a.name)}</a>
      <dl class="meta">
        <div><dt>연도</dt><dd>${esc(w.year)}</dd></div>
        <div><dt>재료</dt><dd>${esc(w.medium)}</dd></div>
        <div><dt>크기</dt><dd>${esc(w.size)}</dd></div>
        <div><dt>소장</dt><dd>${esc(w.museum)}, ${esc(w.city)}</dd></div>
      </dl>
    </header>
    <div class="actions">
      <button class="btn ghost" data-act="fav" data-id="${w.id}" aria-pressed="${store.isFavorite(w.id)}">${store.isFavorite(w.id) ? '♥ 저장됨' : '♡ 저장'}</button>
      ${ttsSupported() ? `<button class="btn ghost" data-act="tts" data-id="${w.id}">🔊 이야기 듣기</button>` : ''}
      <a class="btn" href="#/puzzle/${w.id}">${puzzleLabel}</a>
    </div>
    <div class="tabs" role="tablist">
      ${[['story', '이야기'], ['details', '숨은 그림'], ['background', '배경']].map(([k, label]) =>
        `<button role="tab" aria-selected="${tab === k}" data-act="tab" data-tab="${k}">${label}</button>`).join('')}
    </div>
    <section class="tab-body">${body}</section>
    <nav class="pager">
      <a href="#/work/${prev.id}">← ${esc(prev.title)}</a>
      <a href="#/work/${next.id}">${esc(next.title)} →</a>
    </nav>`;
}

function puzzlesView() {
  const list = readyWorks();
  const done = list.filter(w => store.isComplete(w.id)).length;
  return `<p class="muted pad">문제를 맞힐 때마다 조각이 하나씩 채워져요. 9조각을 모으면 그림 완성! (${done}/${list.length} 완성)</p>
    <div class="grid puzzles">${list.map(miniPuzzle).join('')}</div>`;
}

function puzzleView(id) {
  const w = WORK_BY_ID[id];
  if (!w || !ARTIST_BY_ID[w.artist].ready) return notFound();
  if (store.state.current !== id) {
    store.setCurrent(id);
    resetQuestion();
  }
  const have = store.pieces(id);
  const complete = have.length >= PIECES;

  const board = `<div class="board-wrap${complete ? ' complete' : ''}">${boardSvg(w, have, { fresh: session.fresh, outlines: !complete })}</div>
    <div class="progress"><div class="bar"><span style="width:${(have.length / PIECES) * 100}%"></span></div>
      <span>${have.length}/${PIECES}</span>${store.state.stats.streak > 1 ? `<span class="streak">🔥 ${store.state.stats.streak}연속</span>` : ''}</div>`;

  if (complete) {
    return `${board}
      <div class="card done-card">
        <div class="big-emoji">🎉</div>
        <h2 class="serif">「${esc(w.title)}」 완성!</h2>
        <div class="muted">${esc(ARTIST_BY_ID[w.artist].name)} · ${esc(w.year)}</div>
        <p>${esc(w.summary)}</p>
        <div class="actions center">
          <a class="btn" href="#/work/${w.id}">이야기 읽기</a>
          <a class="btn ghost" href="#/puzzles">다른 퍼즐</a>
        </div>
        <button class="link-btn" data-act="reset-puzzle" data-id="${w.id}">이 퍼즐 처음부터 다시 맞추기</button>
      </div>`;
  }

  if (!session.question) session.question = nextQuestion(id, session.recent);
  const q = session.question;
  const { answered, wrongs, retryPrompt, revealed } = session;
  const done = answered !== null || revealed;
  const choiceBtns = q.choices.map((c, i) => {
    let cls = '';
    if (wrongs.includes(i)) cls = ' wrong';
    else if (done) cls = i === q.answer ? ' correct' : ' dim';
    const disabled = done || retryPrompt || wrongs.includes(i);
    return `<button class="choice${cls}" data-act="answer" data-i="${i}" ${disabled ? 'disabled' : ''}>${esc(c)}</button>`;
  }).join('');
  const storyLink = q.work !== id ? `<a href="#/work/${q.work}">「${esc(WORK_BY_ID[q.work].title)}」 이야기 보기</a>` : '';
  const nextBtn = `<button class="btn wide" data-act="next">${have.length >= PIECES ? '완성된 그림 보기' : '다음 문제'}</button>`;
  let feedback = '';
  if (answered !== null) {
    feedback = `<div class="feedback ok">
        <b>${wrongs.length ? '다시 풀어서 맞혔어요! 조각 하나 획득 🧩' : '정답이에요! 조각 하나 획득 🧩'}</b>
        <span>${esc(q.explain || '')}</span>${storyLink}
      </div>${nextBtn}`;
  } else if (revealed) {
    feedback = `<div class="feedback no">
        <b>정답은 "${esc(q.choices[q.answer])}"예요.</b>
        <span>${esc(q.explain || '')}</span>${storyLink}
      </div>${nextBtn}`;
  } else if (retryPrompt) {
    feedback = `<div class="feedback no"><b>아쉬워요!</b><span>다시 풀어서 맞히면 조각을 받을 수 있어요.</span></div>
      <div class="retry-btns">
        <button class="btn" data-act="retry">다시 풀기</button>
        <button class="btn ghost" data-act="reveal">정답 보기</button>
      </div>`;
  } else if (wrongs.length) {
    feedback = '<p class="muted retry-hint">줄 그어진 답을 빼고 다시 골라 보세요.</p>';
  }

  return `${board}
    <section class="quiz card">
      ${q.image ? `<img class="q-img" src="${q.image}" alt="문제 그림">` : ''}
      <div class="q-prompt">${esc(q.prompt)}</div>
      <div class="choices">${choiceBtns}</div>
      ${feedback}
    </section>`;
}

function savedView() {
  const favs = store.state.favorites.map(id => WORK_BY_ID[id]).filter(Boolean);
  const done = readyWorks().filter(w => store.isComplete(w.id));
  return `
    <section><h3>♥ 저장한 그림</h3>
      ${favs.length ? `<div class="grid">${favs.map(w => workCard(w)).join('')}</div>` : '<p class="muted">그림 화면에서 ♡ 저장을 누르면 여기에 모여요.</p>'}
    </section>
    <section><h3>🧩 완성한 퍼즐</h3>
      ${done.length ? `<div class="grid">${done.map(w => workCard(w)).join('')}</div>` : '<p class="muted">아직 완성한 퍼즐이 없어요. 첫 그림을 완성해 보세요!</p>'}
    </section>
    <a class="card about-link" href="#/about">ℹ️ 앱 정보 · 이미지 출처 · 개인정보</a>`;
}

function aboutView() {
  return `<section class="prose">
      <h3>명화담</h3>
      <p>명화와 그 그림에 얽힌 이야기를 만나고, 퀴즈를 풀어 퍼즐 조각을 모으는 앱이에요. 작가와 작품은 계속 늘어날 예정이에요.</p>
      <h3>이미지 출처</h3>
      <p>모든 그림 이미지는 저작권이 끝난 퍼블릭 도메인(또는 CC0) 작품으로, 위키미디어 공용에서 가져왔어요. 이야기와 설명, 퀴즈는 직접 쓴 글이에요.</p>
      <ul class="credits">${readyWorks().map(w => `<li><a href="${w.credit.source}" target="_blank" rel="noopener">${esc(ARTIST_BY_ID[w.artist].name)}, 「${esc(w.title)}」</a> · ${esc(w.credit.license)}</li>`).join('')}</ul>
      <h3>개인정보</h3>
      <p>이 앱은 어떤 개인정보도 수집하거나 서버로 보내지 않아요. 퍼즐 진행 기록과 저장한 그림은 이 기기의 브라우저 안에만 저장돼요. <a href="privacy.html">개인정보처리방침</a></p>
    </section>
    <button class="btn ghost danger" data-act="reset-all">모든 기록 지우기</button>`;
}

const notFound = () => `<div class="card">페이지를 찾을 수 없어요. <a href="#/">홈으로</a></div>`;

// ───────── 라우터 ─────────
const ROUTES = [
  [/^\/?$/, () => ['명화담', homeView(), 'home']],
  [/^\/artists$/, () => ['작가', artistsView(), 'artists']],
  [/^\/artist\/([\w-]+)$/, (id) => [ARTIST_BY_ID[id]?.name || '작가', artistView(id), 'artists', true]],
  [/^\/work\/([\w-]+)$/, (id) => [WORK_BY_ID[id]?.title || '작품', workView(id), 'artists', true]],
  [/^\/puzzles$/, () => ['퍼즐', puzzlesView(), 'puzzles']],
  [/^\/puzzle\/([\w-]+)$/, (id) => ['퍼즐', puzzleView(id), 'puzzles', true]],
  [/^\/saved$/, () => ['보관함', savedView(), 'saved']],
  [/^\/about$/, () => ['앱 정보', aboutView(), 'saved', true]],
];

let lastPath = null;
function render() {
  const path = location.hash.replace(/^#/, '') || '/';
  if (path !== lastPath) {
    stopSpeaking();
    session.workTab = 'story';
  }
  for (const [re, fn] of ROUTES) {
    const m = path.match(re);
    if (!m) continue;
    const [title, html, tab, sub] = fn(...m.slice(1));
    $title.textContent = title;
    $back.hidden = !sub;
    $view.innerHTML = html;
    document.title = title === '명화담' ? '명화담' : `${title} · 명화담`;
    document.querySelectorAll('.tabbar a').forEach(a => a.setAttribute('aria-current', a.dataset.tab === tab ? 'page' : 'false'));
    break;
  }
  if (path !== lastPath) window.scrollTo(0, 0);
  lastPath = path;
}

// ───────── 이벤트 ─────────
function openZoom(src, alt) {
  const el = document.createElement('div');
  el.className = 'zoom';
  el.innerHTML = `<div class="zoom-scroll"><img src="${src}" alt="${esc(alt)}"></div>
    <div class="zoom-bar"><button data-z="-">－</button><button data-z="+">＋</button><button data-z="x">닫기</button></div>`;
  let scale = 1;
  const img = el.querySelector('img');
  el.addEventListener('click', (e) => {
    const z = e.target.dataset.z;
    if (z === 'x' || e.target === el) { el.remove(); return; }
    if (z === '+' || (e.target === img && scale < 3)) scale = Math.min(3, scale + 1);
    else if (z === '-' || e.target === img) scale = z === '-' ? Math.max(1, scale - 1) : 1;
    img.style.width = `${scale * 100}%`;
  });
  document.body.appendChild(el);
}

// 답을 고른 뒤 아래쪽 버튼(다시 풀기/다음 문제)이 화면 밖이면 보이게 내려 준다
function showQuizButtons() {
  document.querySelector('.quiz .retry-btns, .quiz [data-act="next"]')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

document.addEventListener('click', (e) => {
  const t = e.target.closest('[data-act]');
  if (!t) return;
  const act = t.dataset.act;
  const path = location.hash.replace(/^#/, '');

  if (act === 'answer') {
    if (session.answered !== null || session.revealed || session.retryPrompt) return;
    const id = path.split('/')[2];
    const i = Number(t.dataset.i);
    if (session.wrongs.includes(i)) return;
    const correct = i === session.question.answer;
    const firstTry = session.wrongs.length === 0;
    if (firstTry) {
      store.recordAnswer(correct); // 정답률·연속 정답은 첫 시도 기준
      session.recent = [...session.recent, session.question.id].slice(-8);
    }
    if (correct) {
      session.answered = i;
      session.fresh = store.addPiece(id);
    } else {
      session.wrongs.push(i);
      session.retryPrompt = true;
    }
    render();
    showQuizButtons();
  } else if (act === 'retry') {
    session.retryPrompt = false;
    render();
  } else if (act === 'reveal') {
    session.retryPrompt = false;
    session.revealed = true;
    render();
    showQuizButtons();
  } else if (act === 'next') {
    resetQuestion();
    render();
  } else if (act === 'fav') {
    store.toggleFavorite(t.dataset.id);
    render();
  } else if (act === 'tab') {
    session.workTab = t.dataset.tab;
    render();
    // 숨은 그림은 그림 위 번호를 봐야 하므로 그림이 보이게 올려 준다
    if (t.dataset.tab === 'details') document.querySelector('.art')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  } else if (act === 'hotspot') {
    const k = t.dataset.k;
    if (session.workTab !== 'details') { session.workTab = 'details'; render(); }
    document.querySelectorAll('.hotspot, .detail-list li').forEach(el => el.classList.toggle('active', el.dataset.k === k));
    // 설명은 그림 바로 아래 캡션에 보여 준다 (목록을 누른 경우엔 그림이 보이게 올려 줌)
    const d = WORK_BY_ID[path.split('/')[2]]?.details[k];
    const cap = document.getElementById('hs-caption');
    if (d && cap) cap.innerHTML = `<b>${Number(k) + 1}. ${esc(d.title)}</b>${esc(d.text)}`;
    if (!t.classList.contains('hotspot')) document.querySelector('.art')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  } else if (act === 'zoom') {
    if (session.workTab === 'details') return;
    openZoom(t.src, t.alt);
  } else if (act === 'tts') {
    const w = WORK_BY_ID[t.dataset.id];
    if (t.classList.toggle('playing')) {
      t.textContent = '⏹ 그만 듣기';
      speakAll([`${w.title}. ${ARTIST_BY_ID[w.artist].name}.`, ...w.story], () => { t.classList.remove('playing'); t.textContent = '🔊 이야기 듣기'; });
    } else {
      stopSpeaking();
      t.textContent = '🔊 이야기 듣기';
    }
  } else if (act === 'reset-puzzle') {
    if (confirm('이 퍼즐을 처음부터 다시 맞출까요?')) {
      store.resetPuzzle(t.dataset.id);
      resetQuestion();
      render();
    }
  } else if (act === 'reset-all') {
    if (confirm('퍼즐 기록, 저장한 그림, 통계를 모두 지울까요? 되돌릴 수 없어요.')) {
      try { localStorage.removeItem('myeonghwadam.v1'); } catch { /* 무시 */ }
      location.hash = '#/';
      location.reload();
    }
  }
});

$back.addEventListener('click', () => {
  if (history.length > 1) history.back(); else location.hash = '#/';
});

window.addEventListener('hashchange', render);
render();

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
