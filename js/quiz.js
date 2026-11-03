// 퀴즈 문제 생성. 지금 맞추는 퍼즐 그림(target)의 이미지는 절대 문제에 보여 주지 않는다.
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

const pick = (arr, rnd) => arr[Math.floor(rnd() * arr.length)];
const uniq = (arr) => [...new Set(arr)];

// 정답 + 오답 후보에서 4지선다 만들기
function choicesFrom(answer, pool, rnd) {
  const wrong = shuffle(uniq(pool).filter(x => x !== answer), rnd).slice(0, 3);
  const choices = shuffle([answer, ...wrong], rnd);
  return { choices, answer: choices.indexOf(answer) };
}

const readyWorks = () => WORKS.filter(w => ARTIST_BY_ID[w.artist]?.ready);
const artistNames = ARTISTS.map(a => a.name);
const nations = uniq(ARTISTS.map(a => a.nation));

// 작품 하나에 대해 만들 수 있는 모든 문제 (showImage=false면 그림을 보여 주는 문제는 제외)
export function questionsFor(work, { showImage }, rnd) {
  const artist = ARTIST_BY_ID[work.artist];
  const qs = [];
  const add = (id, data) => qs.push({ id: `${work.id}:${id}`, work: work.id, ...data });

  work.quiz.forEach((s, i) => {
    const { choices, answer } = choicesFrom(s.choices[0], s.choices, rnd);
    add(`story${i}`, { kind: 'story', prompt: s.q, choices, answer, explain: s.explain });
  });

  add('artistOfTitle', {
    kind: 'text', prompt: `${tj(work.title, '을/를')} 그린 화가는?`,
    ...choicesFrom(artist.name, artistNames, rnd),
    explain: `${tj(work.title, '은/는')} ${artist.name}의 작품이에요.`,
  });
  const museums = uniq(WORKS.map(w => w.museum));
  add('museum', {
    kind: 'text', prompt: `${tj(work.title, '은/는')} 지금 어느 미술관에 있을까?`,
    ...choicesFrom(work.museum, museums, rnd),
    explain: `${work.city}의 ${work.museum}에 있어요.`,
  });
  add('nation', {
    kind: 'text', prompt: `${tj(work.title, '을/를')} 그린 화가는 어느 나라 사람일까?`,
    ...choicesFrom(artist.nation, nations, rnd),
    explain: `${josa(artist.name, '은/는')} ${artist.nation}의 화가예요.`,
  });

  if (showImage) {
    add('artistOfImage', {
      kind: 'image', image: work.thumb, prompt: '이 그림을 그린 화가는?',
      ...choicesFrom(artist.name, artistNames, rnd),
      explain: `${artist.name}의 ${tj(work.title, '이에요/예요')}.`,
    });
    add('titleOfImage', {
      kind: 'image', image: work.thumb, prompt: '이 그림의 제목은?',
      ...choicesFrom(work.title, WORKS.map(w => w.title), rnd),
      explain: `${artist.name}의 「${work.title}」(${work.year}) 작품이에요.`,
    });
  }
  return qs;
}

// 다음 문제 하나. 목표 그림 관련 문제 60%, 다른 그림 문제 40%. recent에 있는 문제는 피한다.
export function nextQuestion(targetId, recent = [], rnd = Math.random) {
  const target = WORK_BY_ID[targetId];
  const own = questionsFor(target, { showImage: false }, rnd);
  const others = readyWorks().filter(w => w.id !== targetId)
    .flatMap(w => questionsFor(w, { showImage: true }, rnd));
  const avoid = new Set(recent);
  const fresh = (list) => list.filter(q => !avoid.has(q.id));
  let pool = rnd() < 0.6 ? fresh(own) : fresh(others);
  if (!pool.length) pool = fresh([...own, ...others]);
  if (!pool.length) pool = [...own, ...others];
  return pick(pool, rnd);
}
