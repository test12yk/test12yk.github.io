// node tests/test.mjs
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { ARTISTS, WORKS, ARTIST_BY_ID, WORK_BY_ID } from '../js/data.js';
import { piecePaths, boardSvg, seededRandom, PIECES } from '../js/puzzle.js';
import { nextQuestion, questionsFor, josa } from '../js/quiz.js';
import { createStore } from '../js/store.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log('  ✓', name); } catch (e) { failed++; console.log('  ✗', name, '\n    ', e.message); }
}
const assert = (cond, msg) => { if (!cond) throw new Error(msg); };

test('작가 id가 겹치지 않고, 준비된 작가는 bio/timeline이 있다', () => {
  assert(new Set(ARTISTS.map(a => a.id)).size === ARTISTS.length, '중복 작가 id');
  for (const a of ARTISTS.filter(a => a.ready)) assert(a.bio?.length && a.timeline?.length, `${a.id} bio/timeline 없음`);
});

test('작품마다 작가가 있고 준비된 작가 소속이다', () => {
  assert(new Set(WORKS.map(w => w.id)).size === WORKS.length, '중복 작품 id');
  for (const w of WORKS) assert(ARTIST_BY_ID[w.artist]?.ready, `${w.id}의 작가가 없거나 준비 중`);
});

test('준비된 작가는 작품이 1점 이상 있다', () => {
  for (const a of ARTISTS.filter(a => a.ready)) assert(WORKS.some(w => w.artist === a.id), `${a.id} 작품 없음`);
});

test('이미지/썸네일 파일이 모두 있다', () => {
  for (const w of WORKS) {
    assert(existsSync(join(root, w.image)), `${w.image} 없음`);
    assert(existsSync(join(root, w.thumb)), `${w.thumb} 없음`);
    assert(existsSync(join(root, w.zoom)), `${w.zoom} 없음`);
    assert(w.width > 0 && w.height > 0, `${w.id} 크기 없음`);
    assert(/^https:\/\/commons\.wikimedia\.org\//.test(w.credit.source), `${w.id} 출처 없음`);
  }
});

test('필수 글(이야기/배경/요약)이 채워져 있다', () => {
  for (const w of WORKS) {
    assert(w.story.length >= 3, `${w.id} 이야기 부족`);
    assert(w.background.length >= 1, `${w.id} 배경 없음`);
    assert(w.summary && w.museum && w.city && w.year, `${w.id} 기본 정보 누락`);
  }
});

test('숨은 그림 좌표가 0~100 안이다', () => {
  for (const w of WORKS) {
    assert(w.details.length >= 3, `${w.id} 숨은 그림 3개 미만`);
    for (const d of w.details) assert(d.x >= 0 && d.x <= 100 && d.y >= 0 && d.y <= 100, `${w.id} ${d.title} 좌표 이상`);
  }
});

test('이야기 퀴즈: 보기 4개, 중복 없음, 해설 있음', () => {
  for (const w of WORKS) for (const q of w.quiz) {
    assert(q.choices.length === 4, `${w.id} "${q.q}" 보기 ${q.choices.length}개`);
    assert(new Set(q.choices).size === 4, `${w.id} "${q.q}" 보기 중복`);
    assert(q.explain, `${w.id} "${q.q}" 해설 없음`);
  }
});

test('자동 생성 문제도 모두 보기 4개, 정답 index가 맞다', () => {
  const rnd = seededRandom('t');
  for (const w of WORKS) for (const q of questionsFor(w, rnd)) {
    assert(q.choices.length === 4 && new Set(q.choices).size === 4, `${q.id} 보기 이상: ${q.choices}`);
    assert(q.answer >= 0 && q.answer < 4, `${q.id} 정답 index 이상`);
  }
});

test('작품마다 문제가 조각 수(9)와 같고, 문제 id가 겹치지 않는다', () => {
  for (const w of WORKS) {
    const qs = questionsFor(w);
    assert(qs.length === PIECES, `${w.id} 문제 ${qs.length}개`);
    assert(new Set(qs.map(q => q.id)).size === PIECES, `${w.id} 문제 id 중복`);
    assert(new Set(qs.map(q => q.prompt)).size === PIECES, `${w.id} 같은 질문 중복`);
  }
});

test('퀴즈는 그 작품 문제만 내고, 맞힌 문제는 다시 안 내고, 같은 문제를 연달아 안 낸다', () => {
  const rnd = seededRandom('flow');
  for (const w of WORKS) {
    const solved = [];
    let last = null;
    for (let i = 0; i < PIECES; i++) {
      const q = nextQuestion(w.id, solved, last, rnd);
      assert(q.work === w.id, `${w.id}인데 ${q.work} 문제`);
      assert(!solved.includes(q.id), `${q.id} 재출제`);
      assert(q.id !== last || PIECES - solved.length === 1, `${q.id} 연속 출제`);
      solved.push(q.id); last = q.id;
    }
    assert(solved.length === PIECES, '9문제를 다 못 풂');
  }
});

test('움직이는 이야기: 모든 작품에 있고, 장면·효과 값이 올바르다', () => {
  const FX = ['twinkle', 'glow', 'shimmer', 'clouds', 'motes', 'notes'];
  for (const w of WORKS) {
    assert(w.film, `${w.id} 움직이는 이야기 없음`);
    for (const fx of w.film.effects) {
      assert(FX.includes(fx.type), `${w.id} 모르는 효과: ${fx.type}`);
      for (const r of [fx.rect].filter(Boolean)) assert(r.length === 4 && r.every(v => v >= 0 && v <= 100), `${w.id} 효과 영역 이상`);
      for (const [x, y] of fx.points || []) assert(x >= 0 && x <= 100 && y >= 0 && y <= 100, `${w.id} 효과 좌표 이상`);
    }
    const sc = w.film.scenes;
    assert(sc.length >= 2, `${w.id} 장면 부족`);
    for (const s of sc) {
      for (const c of [s, s.to].filter(Boolean)) {
        assert(c.x >= 0 && c.x <= 100 && c.y >= 0 && c.y <= 100 && c.z >= 1 && c.z <= 4, `${w.id} 카메라 값 이상: ${JSON.stringify(c)}`);
      }
      assert(s.title || (Number.isInteger(s.p) && w.story[s.p]), `${w.id} 없는 문단 번호: ${s.p}`);
    }
    const used = sc.filter(s => !s.title).map(s => s.p);
    assert(w.story.every((_, i) => used.includes(i)), `${w.id} 빠진 이야기 문단이 있음`);
  }
});

test('조사 붙이기', () => {
  assert(josa('고흐', '은/는') === '고흐는', josa('고흐', '은/는'));
  assert(josa('김홍도', '을/를') === '김홍도를', josa('김홍도', '을/를'));
  assert(josa('별이 빛나는 밤', '을/를') === '별이 빛나는 밤을', '받침 처리');
});

test('퍼즐: 9조각 path, 같은 시드는 같은 모양, 내부 변에만 탭이 있다', () => {
  const a = piecePaths('starry-night', 1200, 950), b = piecePaths('starry-night', 1200, 950);
  assert(a.length === PIECES, '조각 수');
  assert(a.every((p, i) => p.d === b[i].d), '시드 재현 안 됨');
  assert(a.every(p => p.d.startsWith('M') && p.d.endsWith('Z')), 'path 형식');
  // 내부 변에는 탭(C 곡선)이 있어야 한다: 가운데 조각은 네 변 모두 곡선
  assert((a[4].d.match(/C/g) || []).length === 16, '가운데 조각 탭 수');
  assert((a[0].d.match(/C/g) || []).length === 8, '모서리 조각 탭 수');
});

test('퍼즐 보드 SVG: 맞힌 조각만 이미지로 그린다', () => {
  const w = WORK_BY_ID['milkmaid'];
  const svg = boardSvg(w, [0, 4]);
  assert((svg.match(/<image /g) || []).length === 2, '이미지 조각 수');
  assert((svg.match(/class="pz-slot"/g) || []).length === 7, '빈 칸 수');
});

function memStorage(init = {}) {
  const m = new Map(Object.entries(init));
  return { getItem: k => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k), _m: m };
}

test('저장소: 조각 9개를 모으면 완성 처리, 이후엔 -1', () => {
  const s = createStore(memStorage());
  const rnd = seededRandom('s');
  const got = new Set();
  for (let i = 0; i < PIECES; i++) got.add(s.addPiece('bedroom', `bedroom:q${i}`, rnd));
  assert(got.size === PIECES, '조각 중복');
  assert(s.isComplete('bedroom') && s.state.completed.bedroom, '완성 처리 안 됨');
  assert(s.solved('bedroom').length === PIECES, '맞힌 문제 기록 누락');
  assert(s.addPiece('bedroom', 'bedroom:q9', rnd) === -1, '완성 후 추가됨');
});

test('저장소: 옛 기록(필드 누락)이나 깨진 기록도 안전하게 불러온다', () => {
  const old = createStore(memStorage({ 'myeonghwadam.v1': JSON.stringify({ pieces: { seodang: [1, 2] } }) }));
  assert(old.pieces('seodang').length === 2, '기존 조각 유실');
  assert(Array.isArray(old.solved('seodang')) && old.solved('seodang').length === 0, 'solved 기본값 누락');
  assert(Array.isArray(old.state.favorites) && old.state.stats.best === 0, '기본값 누락');
  old.recordAnswer(true);
  assert(old.state.stats.correct === 1, '통계 기록 실패');
  const broken = createStore(memStorage({ 'myeonghwadam.v1': '{깨짐' }));
  assert(broken.pieces('x').length === 0, '깨진 기록 처리 실패');
});

test('저장소: 즐겨찾기 토글과 연속 정답 기록', () => {
  const s = createStore(memStorage());
  assert(s.toggleFavorite('mudong') === true && s.isFavorite('mudong'), '추가 실패');
  assert(s.toggleFavorite('mudong') === false && !s.isFavorite('mudong'), '삭제 실패');
  s.recordAnswer(true); s.recordAnswer(true); s.recordAnswer(false); s.recordAnswer(true);
  assert(s.state.stats.best === 2 && s.state.stats.streak === 1, '연속 기록 이상');
});

test('서비스워커 캐시 목록의 파일이 모두 있다', () => {
  const sw = readFileSync(join(root, 'sw.js'), 'utf8');
  const files = [...sw.matchAll(/'([\w./-]+\.(?:html|css|js|webmanifest|png))'/g)].map(m => m[1]);
  for (const f of files) assert(existsSync(join(root, f)), `${f} 없음`);
  for (const w of WORKS) assert(sw.includes(`'${w.id}'`), `sw.js 썸네일 목록에 ${w.id} 없음`);
});

console.log(`\n${passed}개 통과, ${failed}개 실패`);
process.exit(failed ? 1 : 0);
