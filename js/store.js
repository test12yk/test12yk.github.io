// 기기(브라우저)별 저장: localStorage 'myeonghwadam.v1'
// 저장된 오래된 기록에 새 필드가 없을 수 있으므로 load 때 항상 기본값으로 채운다.
import { PIECES } from './puzzle.js';

const KEY = 'myeonghwadam.v1';

const defaults = () => ({
  pieces: {},      // { workId: [조각 index...] } 맞힌 순서대로
  solved: {},      // { workId: [맞힌 문제 id...] } 맞힌 문제는 다시 안 나옴
  completed: {},   // { workId: '2026-11-03' }
  current: null,   // 지금 맞추는 퍼즐
  favorites: [],
  stats: { answered: 0, correct: 0, streak: 0, best: 0 },
});

function safeStorage(storage) {
  try { return storage ?? globalThis.localStorage; } catch { return null; }
}

export function createStore(storage) {
  const ls = safeStorage(storage);
  let state = defaults();
  try {
    const saved = JSON.parse(ls?.getItem(KEY) || 'null');
    if (saved && typeof saved === 'object') {
      const d = defaults();
      state = { ...d, ...saved, stats: { ...d.stats, ...(saved.stats || {}) } };
      if (typeof state.pieces !== 'object' || !state.pieces) state.pieces = {};
      if (typeof state.completed !== 'object' || !state.completed) state.completed = {};
      if (typeof state.solved !== 'object' || !state.solved) state.solved = {};
      if (!Array.isArray(state.favorites)) state.favorites = [];
    }
  } catch { /* 깨진 기록이면 새로 시작 */ }

  const save = () => { try { ls?.setItem(KEY, JSON.stringify(state)); } catch { /* 저장 불가(사생활 보호 모드 등) */ } };

  return {
    get state() { return state; },
    save,
    pieces: (id) => state.pieces[id] || [],
    solved: (id) => state.solved[id] || [],
    isComplete: (id) => (state.pieces[id] || []).length >= PIECES,
    setCurrent(id) { state.current = id; save(); },

    // 정답 처리: 맞힌 문제를 기록하고, 아직 없는 조각 하나를 무작위로 채운다. 채운 조각 index 반환(이미 완성이면 -1)
    addPiece(id, questionId = null, rnd = Math.random) {
      if (questionId && !(state.solved[id] || []).includes(questionId)) state.solved[id] = [...(state.solved[id] || []), questionId];
      const have = state.pieces[id] || [];
      const missing = [...Array(PIECES).keys()].filter(i => !have.includes(i));
      if (!missing.length) return -1;
      const idx = missing[Math.floor(rnd() * missing.length)];
      state.pieces[id] = [...have, idx];
      if (state.pieces[id].length >= PIECES) state.completed[id] = new Date().toISOString().slice(0, 10);
      save();
      return idx;
    },

    recordAnswer(correct) {
      const s = state.stats;
      s.answered++;
      if (correct) { s.correct++; s.streak++; s.best = Math.max(s.best, s.streak); } else s.streak = 0;
      save();
    },

    toggleFavorite(id) {
      const i = state.favorites.indexOf(id);
      if (i >= 0) state.favorites.splice(i, 1); else state.favorites.push(id);
      save();
      return i < 0;
    },
    isFavorite: (id) => state.favorites.includes(id),

    resetPuzzle(id) {
      delete state.pieces[id];
      delete state.solved[id];
      delete state.completed[id];
      save();
    },
  };
}
