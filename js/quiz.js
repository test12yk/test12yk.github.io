// 작품별 퀴즈. 한 작품 = 9문제(이야기 문제 6 + 자동 문제 3) = 퍼즐 9조각.
// 문제 id(`작품id:story0` 등)는 맞힌 기록으로 저장되므로 바꾸지 말 것.
import { ARTISTS, WORKS, ARTIST_BY_ID, WORK_BY_ID } from './data.js';

export function shuffle(arr, rnd = Math.random) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// 받침에 맞는 조사 붙이기: josa('고흐', '은/는') → '고흐는'
export function josa(word, pair) {
  const code = word.charCodeAt(word.length - 1);
  const hasFinal = code >= 0xac00 && code <= 0xd7a3 && (code - 0xac00) % 28 !== 0;
  const [withFinal, without] = pair.split('/');
  return word + (hasFinal ? withFinal : without);
}

// 「제목」 뒤 조사: tj('해바라기', '을/를') → '「해바라기」를'
const tj = (title, pair) => `「${title}」` + josa(title, pair).slice(title.length);

const uniq = (arr) => [...new Set(arr)];

// 정답 + 오답 후보에서 4지선다 만들기
function choicesFrom(answer, pool, rnd) {
  const wrong = shuffle(uniq(pool).filter(x => x !== answer), rnd).slice(0, 3);
  const choices = shuffle([answer, ...wrong], rnd);
  return { choices, answer: choices.indexOf(answer) };
}

const artistNames = ARTISTS.map(a => a.name);
const nations = uniq(ARTISTS.map(a => a.nation));
const museums = uniq(WORKS.map(w => w.museum));

// 작품 하나의 문제 전부 (보기 순서는 매번 섞임)
export function questionsFor(work, rnd = Math.random) {
  const artist = ARTIST_BY_ID[work.artist];
  const qs = [];
  const add = (id, data) => qs.push({ id: `${work.id}:${id}`, work: work.id, ...data });

  work.quiz.forEach((s, i) => {
    add(`story${i}`, { prompt: s.q, ...choicesFrom(s.choices[0], s.choices, rnd), explain: s.explain });
  });
  add('artistOfTitle', {
    prompt: `${tj(work.title, '을/를')} 그린 화가는?`,
    ...choicesFrom(artist.name, artistNames, rnd),
    explain: `${tj(work.title, '은/는')} ${artist.name}의 작품이에요.`,
  });
  add('museum', {
    prompt: `${tj(work.title, '은/는')} 지금 어디에 소장돼 있을까?`,
    ...choicesFrom(work.museum, museums, rnd),
    explain: `${work.city}의 ${work.museum}에 있어요.`,
  });
  add('nation', {
    prompt: `${tj(work.title, '을/를')} 그린 화가는 어느 나라 사람일까?`,
    ...choicesFrom(artist.nation, nations, rnd),
    explain: `${josa(artist.name, '은/는')} ${artist.nation}의 화가예요.`,
  });
  return qs;
}

// 이 작품에서 아직 안 맞힌 문제 하나. 방금 낸 문제(lastId)는 가능하면 피한다.
export function nextQuestion(workId, solved = [], lastId = null, rnd = Math.random) {
  const all = questionsFor(WORK_BY_ID[workId], rnd);
  let pool = all.filter(q => !solved.includes(q.id));
  if (!pool.length) pool = all;
  const notLast = pool.filter(q => q.id !== lastId);
  if (notLast.length) pool = notLast;
  return pool[Math.floor(rnd() * pool.length)];
}
