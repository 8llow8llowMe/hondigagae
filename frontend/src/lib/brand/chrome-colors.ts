/**
 * 브라우저·OS 크롬에 넘기는 색 — 아트보드 `혼디가개 브랜드 자산` 5절.
 *
 * **이 파일만 raw hex 를 쓴다.** 다른 곳에서 따라 하지 않는다.
 *
 * 이유: 이 값들이 가는 곳은 CSS 가 아니라 **`<meta>` / `<link>` 속성**이다.
 * `theme-color` 는 안드로이드 크롬이 상태바를 칠할 때, `mask-icon` 의 `color` 는
 * 사파리가 고정 탭 실루엣에 입힐 때 읽는다. 둘 다 CSS 변수를 해석하지 않으므로
 * `var(--brand-500)` 을 넘기면 그냥 무시된다.
 *
 * **값이 갈리는 것은 테스트가 막는다** — `chrome-colors.test.ts` 가 `tokens.css` 의
 * `--brand-500` · `--bg` 와 대조한다. `token-sync.test.ts` 가 `DESIGN.md` ↔ `tokens.css`
 * 를 지키는 것과 같은 방식이다 (이슈 #50: 손으로 맞추기로 한 값은 반드시 갈라진다).
 */

/**
 * `--brand-500`. 사파리 고정 탭 실루엣 색.
 *
 * **인터페이스 밖이라 브랜드 컬러가 맞다.** 파비콘·앱 아이콘·고정 탭이 사는 곳은 우리
 * UI 가 아니라 브라우저 탭이고, 네이버·유튜브 아이콘과 나란히 놓인다. 거기서 무채색은
 * 그냥 사라진다 — 아트보드가 "예외가 아니라 규칙" 이라고 못박았다.
 */
// eslint-disable-next-line no-restricted-syntax -- 위 주석 참고: meta/link 속성은 CSS 변수를 못 읽는다
export const MASK_ICON_COLOR = '#2E9B6B'

/**
 * `--bg`. PWA 상태바 색.
 *
 * **초록이 아니라 흰색이다.** 상태바가 헤더와 이어져야 하는데 헤더 배경이 흰색이다
 * (`--bg`). 초록을 넣으면 상태바만 색 띠로 떠 보인다 (아트보드 5절).
 *
 * `public/site.webmanifest` 의 `theme_color` 와 **같은 값이어야 한다** — 매니페스트가
 * 있는 설치형에서는 그쪽이 이기므로 두 값이 갈리면 설치 전후로 상태바 색이 바뀐다.
 */
// eslint-disable-next-line no-restricted-syntax -- 위 주석 참고: meta/link 속성은 CSS 변수를 못 읽는다
export const THEME_COLOR = '#FFFFFF'
