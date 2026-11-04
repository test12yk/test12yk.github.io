// 움직이는 이야기: 그림 위를 카메라가 이동하며 이야기 문단을 읽어 주는 전체 화면 재생기.
// 작품 데이터의 film = { effect, scenes: [{ title | p, x, y, z, to? }] } 를 사용한다.
import { ARTIST_BY_ID } from './data.js';
import { speakOne, stopSpeaking, ttsSupported } from './tts.js';

const MOVE_SEC = 2.4;                       // 장면 사이 카메라 이동 시간
const readSec = (text) => Math.max(5, text.length * 0.13); // 소리 없이 볼 때 문단당 시간

const esc = (s) => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function openFilm(work, { onQuiz } = {}) {
  const film = work.film;
  const artist = ARTIST_BY_ID[work.artist];
  const scenes = film.scenes;
  let idx = 0, paused = false, muted = !ttsSupported(), timers = [], token = 0;

  const el = document.createElement('div');
  el.className = 'film';
  el.innerHTML = `
    <div class="film-stage">
      <div class="film-cam">
        <img src="${work.image}" alt="${esc(work.title)}">
        ${film.effect?.type === 'twinkle' ? film.effect.points.map(([x, y, big], i) =>
          `<span class="twinkle${big ? ' big' : ''}" style="left:${x}%;top:${y}%;animation-delay:${(i * 0.37) % 2.6}s"></span>`).join('') : ''}
      </div>
    </div>
    <div class="film-title"><div class="eyebrow">움직이는 이야기</div><h2 class="serif">${esc(work.title)}</h2><div>${esc(artist.name)} · ${esc(work.year)}</div></div>
    <div class="film-caption" aria-live="polite"></div>
    <div class="film-end">
      <div class="big-emoji">🎬</div>
      <h2 class="serif">이야기를 다 봤어요!</h2>
      <p>이제 퀴즈를 풀고 「${esc(work.title)}」 퍼즐 조각을 받아 볼까요?</p>
      <div class="film-end-btns">
        <button class="btn" data-f="quiz">퀴즈 풀고 조각 받기 →</button>
        <button class="btn ghost" data-f="replay">처음부터 다시 보기</button>
      </div>
    </div>
    <div class="film-top">
      <div class="film-dots">${scenes.map(() => '<i></i>').join('')}</div>
      <button class="film-btn" data-f="close" aria-label="닫기">✕</button>
    </div>
    <div class="film-bar">
      <button class="film-btn" data-f="prev" aria-label="이전 장면">⏮</button>
      <button class="film-btn main" data-f="pause" aria-label="일시정지">⏸</button>
      <button class="film-btn" data-f="next" aria-label="다음 장면">⏭</button>
      ${ttsSupported() ? `<button class="film-btn" data-f="mute" aria-label="소리">${muted ? '🔇' : '🔊'}</button>` : ''}
    </div>`;

  const stage = el.querySelector('.film-stage');
  const cam = el.querySelector('.film-cam');
  const img = cam.querySelector('img');
  const caption = el.querySelector('.film-caption');
  const dots = [...el.querySelectorAll('.film-dots i')];

  // 그림을 화면에 꼭 맞게(contain) 놓고, (x, y)%를 화면 가운데로, z배 확대. 그림 밖이 보이지 않게 이동 범위를 제한
  function camTransform({ x, y, z }) {
    const W = cam.offsetWidth, H = cam.offsetHeight;
    const vw = stage.clientWidth, vh = stage.clientHeight;
    const clamp = (v, max) => Math.max(-max, Math.min(max, v));
    const tx = clamp(-(x / 100 - 0.5) * W * z, Math.max(0, (W * z - vw) / 2));
    const ty = clamp(-(y / 100 - 0.5) * H * z, Math.max(0, (H * z - vh) / 2));
    return `translate(${tx}px, ${ty}px) scale(${z})`;
  }
  function moveCam(target, sec, easing = 'ease-in-out') {
    cam.style.transition = `transform ${sec}s ${easing}`;
    cam.style.transform = camTransform(target);
  }
  function fitCam() {
    const ratio = work.width / work.height;
    const vw = stage.clientWidth, vh = stage.clientHeight;
    const w = Math.min(vw, vh * ratio);
    cam.style.width = `${w}px`;
    cam.style.height = `${w / ratio}px`;
  }

  const later = (fn, sec) => timers.push(setTimeout(fn, sec * 1000));
  const clearTimers = () => { timers.forEach(clearTimeout); timers = []; };

  function play(i) {
    clearTimers();
    stopSpeaking();
    const my = ++token;
    idx = Math.max(0, Math.min(i, scenes.length));
    el.classList.toggle('ended', idx === scenes.length);
    dots.forEach((d, k) => d.classList.toggle('on', k <= idx));
    if (idx === scenes.length) { // 엔딩
      el.classList.remove('show-title');
      caption.textContent = '';
      moveCam({ x: 50, y: 50, z: 1 }, MOVE_SEC);
      return;
    }
    const sc = scenes[idx];
    const text = sc.title ? `${work.title}. ${artist.name}, ${work.year}.` : work.story[sc.p];
    el.classList.toggle('show-title', !!sc.title);
    caption.textContent = sc.title ? '' : text;
    moveCam(sc, MOVE_SEC);
    // 도착 후 문단을 읽는 동안 천천히: to가 있으면 그쪽으로, 없으면 살짝 다가가기
    const drift = sc.to || { x: sc.x, y: sc.y, z: sc.z * 1.07 };
    const dur = sc.title ? 4 : readSec(text);
    later(() => { if (!paused) moveCam(drift, dur + 2, 'linear'); }, MOVE_SEC);

    const advance = () => { if (my === token && !paused) play(idx + 1); };
    if (!muted && speakOne(text, () => later(advance, 0.8))) {
      later(advance, dur * 2.2 + 4); // 음성이 끝 신호를 안 주는 기기 대비
    } else {
      later(advance, MOVE_SEC + dur);
    }
  }

  function showPaused(p) {
    paused = p;
    el.classList.toggle('paused', p);
    const btn = el.querySelector('[data-f="pause"]');
    btn.textContent = p ? '▶' : '⏸';
    btn.setAttribute('aria-label', p ? '재생' : '일시정지');
  }
  function setPaused(p) {
    showPaused(p);
    if (p) {
      clearTimers();
      stopSpeaking();
      token++;
      const now = getComputedStyle(cam).transform; // 지금 위치에서 멈춤
      cam.style.transition = 'none';
      cam.style.transform = now;
    } else {
      play(idx); // 현재 장면을 처음부터 다시
    }
  }

  function close() {
    clearTimers();
    stopSpeaking();
    token++;
    window.removeEventListener('resize', onResize);
    document.removeEventListener('keydown', onKey);
    document.body.classList.remove('film-open');
    el.remove();
  }

  el.addEventListener('click', (e) => {
    const f = e.target.closest('[data-f]')?.dataset.f;
    if (!f) return;
    if (f === 'close') close();
    else if (f === 'pause') setPaused(!paused);
    else if (f === 'next') { showPaused(false); play(idx + 1); }
    else if (f === 'prev') { showPaused(false); play(idx - 1); }
    else if (f === 'replay') { showPaused(false); play(0); }
    else if (f === 'quiz') { close(); onQuiz?.(); }
    else if (f === 'mute') {
      muted = !muted;
      e.target.textContent = muted ? '🔇' : '🔊';
      if (!paused) play(idx);
    }
  });
  const onResize = () => { fitCam(); if (!paused) moveCam(scenes[idx] || { x: 50, y: 50, z: 1 }, 0.3); };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  window.addEventListener('resize', onResize);
  document.addEventListener('keydown', onKey);

  document.body.classList.add('film-open');
  document.body.appendChild(el);
  const start = () => { fitCam(); cam.style.transform = camTransform({ x: 50, y: 50, z: 1 }); play(0); };
  if (img.complete) start(); else img.addEventListener('load', start, { once: true });
}
