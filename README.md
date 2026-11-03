# 명화담

명화와 그 그림에 얽힌 이야기를 읽고, 퀴즈를 풀어 명화 퍼즐을 완성하는 웹앱(PWA).

- 빌드 없음 (바닐라 JS 모듈)
- 실행: `python3 -m http.server 8091` → http://localhost:8091
- 테스트: `node tests/test.mjs`

## 구조

| 파일 | 역할 |
|---|---|
| `js/data.js` | 작가·작품 콘텐츠 (이야기, 숨은 그림, 배경, 퀴즈) |
| `js/quiz.js` | 작품별 문제 9개(이야기 문제 6 + 자동 3) = 퍼즐 9조각. 맞힌 문제는 다시 안 나옴 |
| `js/puzzle.js` | 직소 조각 SVG 생성/렌더링 (작품 id 시드로 모양 고정) |
| `js/store.js` | 기기별 저장 (`localStorage` 키 `myeonghwadam.v1`) |
| `js/app.js` | 화면/라우터 (`#/`, `#/artists`, `#/artist/:id`, `#/work/:id`, `#/quiz/:id`, `#/puzzles`, `#/puzzle/:id`, `#/saved`, `#/about`) |
| `sw.js` | 오프라인 캐시. 배포할 때마다 `VERSION` 올리기 |
| `images/` | 그림(긴 변 1600px, q85), `images/full/`(2800px, 확대 보기용), `images/thumb/`(600px), 출처 `images/_sources.json` |

## 작품 추가하는 법

1. **저작권 확인**: 작가 사후 70년이 지난 퍼블릭 도메인 작품만. 위키미디어 공용 파일의 라이선스가 Public domain / CC0인지 확인.
2. 이미지 저장: 위키미디어 API로 `iiurlwidth=3840` 고해상도를 받아 PIL로 `images/<id>.jpg`(긴 변 1600, q85), `images/full/<id>.jpg`(2800, q82), `images/thumb/<id>.jpg`(600, q80) 생성 — 이미 압축된 작은 이미지를 다시 압축하면 흐려지니 꼭 큰 원본에서 만들 것
   - **받은 파일이 정말 그 그림인지 눈으로 확인할 것** (예: "Starry Night" 파일명이 「론강의 별이 빛나는 밤」인 경우가 있었음)
3. `js/data.js`의 `WORKS`에 작품 추가, 아래쪽 `IMG`에 `[가로, 세로, 출처 URL]` 추가
   - `quiz`는 **작품마다 정확히 6문제** (자동 3문제와 합쳐 9조각), `choices`는 **첫 번째가 정답** (화면에서는 섞여 나옴)
   - `details`의 x, y는 그림 왼쪽 위 기준 퍼센트
   - 사실 확인이 안 되는 내용은 "~라는 해석이 있어요"처럼 단정하지 않기
4. 새 작가라면 `ARTISTS`에서 `ready: true`로 바꾸고 `bio`, `timeline` 작성
5. `sw.js`의 썸네일 목록에 id 추가 + `VERSION` 올리기
6. `node tests/test.mjs` 통과 확인

## 흐름

작품 이야기 → [퀴즈 풀고 조각 받기] → 그 그림 문제 1개 → 맞히면 조각 획득 → [다음 작품](완성 안 한 다음 그림) 또는 [이 그림 문제 하나 더]. 틀리면 다시 풀기/정답 보기.

## 저장 데이터 주의

`pieces`는 `{작품 id: [조각 index]}`, `solved`는 `{작품 id: [문제 id]}`로 저장되므로 **작품 id와 문제 순서(story0~5)는 바꾸거나 지우지 말 것** (기존 진행이 사라짐). 퍼즐 칸 수(3×3)를 바꾸면 기존 기록과 안 맞으니 바꿀 때는 마이그레이션 필요.

## 배포 / 스토어

- 무료: GitHub Pages. 구글 플레이(TWA) 등록까지 생각하면 저장소 이름을 `<계정>.github.io`로 해서 사이트 최상위 주소에 올릴 것 (`/.well-known/assetlinks.json`을 둘 수 있어야 함)
- 경로는 전부 상대 경로라 하위 경로에 올려도 동작함
- 개인정보처리방침: `privacy.html`
