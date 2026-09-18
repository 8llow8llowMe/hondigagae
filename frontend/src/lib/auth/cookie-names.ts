/**
 * 쿠키 이름만 담는 모듈.
 *
 * proxy.ts 처럼 쿠키 이름만 필요한 곳이 session.ts 를 임포트하면
 * node:crypto 와 env 검증(`env.server.ts` 의 모듈 로드 시점 파싱)까지 함께 끌려온다.
 * 임포트 표면을 최소로 유지한다.
 */
export const SESSION_COOKIE_NAME = 'hdg_session'

/**
 * 소셜 로그인 CSRF state 를 담는 **BFF 자체 쿠키** (#689).
 *
 * `SESSION_COOKIE_NAME` 과 따로 두는 이유: `/authorize` 시점에는 아직 로그인 전이라
 * 세션 쿠키가 없다. 거기에 state 를 넣으려면 "토큰 없는 세션" 이라는 상태를 새로
 * 만들어야 하고, 그러면 `readSession() !== null` 이 곧 로그인이라는 전제가 깨진다.
 *
 * 게이트웨이가 쓰는 이름(`oauthState`)과 일부러 다르게 둔다 — 값이 봉인돼 있어 형식이
 * 다르고, 이름까지 같으면 프록시 경계에서 어느 쪽 쿠키인지 구분되지 않는다.
 */
export const OAUTH_STATE_COOKIE_NAME = 'hdg_oauth_state'
