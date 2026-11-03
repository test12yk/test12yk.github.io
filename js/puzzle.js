// 직소 퍼즐 조각 모양(SVG path) 생성 + 보드 렌더링. DOM 없이 문자열만 만든다(테스트 가능).

export const ROWS = 3, COLS = 3, PIECES = ROWS * COLS;

// 작품 id로 시드를 만들어 항상 같은 조각 모양이 나오게 한다
export function seededRandom(seedStr) {
  let h = 2166136261;
  for (const ch of seedStr) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
}

// 0→1 직선 위의 볼록 탭 템플릿 [along, out]. 0.5 기준 좌우 대칭이라 반대로 따라가도 같은 곡선이 된다.
const TAB = [
  [[0.40, 0], [0.42, 0.05], [0.38, 0.10]],
  [[0.33, 0.20], [0.45, 0.27], [0.50, 0.27]],
  [[0.55, 0.27], [0.67, 0.20], [0.62, 0.10]],
  [[0.58, 0.05], [0.60, 0], [0.65, 0]],
];

const f = (n) => Math.round(n * 10) / 10;

// p→q 변 하나. sign: +1 바깥으로 볼록, -1 안으로 오목, 0 직선(테두리)
function edge(p, q, sign) {
  if (!sign) return ` L${f(q[0])},${f(q[1])}`;
  const dx = q[0] - p[0], dy = q[1] - p[1];
  const len = Math.hypot(dx, dy), ux = dx / len, uy = dy / len;
  const nx = uy, ny = -ux; // 시계 방향으로 돌 때 바깥쪽 법선
  const pt = ([a, b]) => `${f(p[0] + ux * a * len + nx * b * len * sign)},${f(p[1] + uy * a * len + ny * b * len * sign)}`;
  let d = ` L${pt([0.35, 0])}`;
  for (const [c1, c2, e] of TAB) d += ` C${pt(c1)} ${pt(c2)} ${pt(e)}`;
  return d + ` L${f(q[0])},${f(q[1])}`;
}

// 모든 조각의 path를 만든다. 내부 변마다 볼록/오목 방향을 시드로 정함
export function piecePaths(seed, width, height, rows = ROWS, cols = COLS) {
  const rnd = seededRandom(seed);
  const h = [], v = [];
  for (let r = 0; r < rows; r++) {
    h[r] = []; v[r] = [];
    for (let c = 0; c < cols; c++) {
      h[r][c] = rnd() < 0.5 ? 1 : -1; // r행 위쪽 변 (r>0일 때만 사용)
      v[r][c] = rnd() < 0.5 ? 1 : -1; // c열 왼쪽 변 (c>0일 때만 사용)
    }
  }
  const pw = width / cols, ph = height / rows;
  const paths = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x0 = c * pw, y0 = r * ph, x1 = x0 + pw, y1 = y0 + ph;
      const top = r === 0 ? 0 : -h[r][c];
      const right = c === cols - 1 ? 0 : v[r][c + 1];
      const bottom = r === rows - 1 ? 0 : h[r + 1][c];
      const left = c === 0 ? 0 : -v[r][c];
      let d = `M${f(x0)},${f(y0)}`;
      d += edge([x0, y0], [x1, y0], top);
      d += edge([x1, y0], [x1, y1], right);
      d += edge([x1, y1], [x0, y1], bottom);
      d += edge([x0, y1], [x0, y0], left);
      paths.push({ d: d + ' Z', cx: x0 + pw / 2, cy: y0 + ph / 2 });
    }
  }
  return paths;
}

let uid = 0;
// 퍼즐 보드 SVG. revealed: 맞힌 조각 index 배열, fresh: 방금 맞힌 조각(애니메이션)
export function boardSvg(work, revealed, { fresh = -1, image = work.image, outlines = true } = {}) {
  const W = work.width, H = work.height;
  const paths = piecePaths(work.id, W, H);
  const id = `pz${++uid}`;
  const got = new Set(revealed);
  const sw = Math.max(W, H) / 260;
  let defs = '', body = '', lines = '';
  paths.forEach((p, i) => {
    if (got.has(i)) {
      defs += `<clipPath id="${id}-${i}"><path d="${p.d}"/></clipPath>`;
      body += `<g class="pz-piece${i === fresh ? ' pz-fresh' : ''}"><image href="${image}" width="${W}" height="${H}" clip-path="url(#${id}-${i})" preserveAspectRatio="none"/></g>`;
    } else {
      body += `<path class="pz-slot" d="${p.d}"/>`;
    }
    if (outlines) lines += `<path class="pz-line${got.has(i) ? ' got' : ''}" d="${p.d}" stroke-width="${f(sw)}"/>`;
  });
  return `<svg class="pz-board" viewBox="0 0 ${W} ${H}" role="img" aria-label="${work.title} 퍼즐, ${revealed.length}/${PIECES}조각"><defs>${defs}</defs>${body}${lines}</svg>`;
}
