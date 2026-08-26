/**
 * 쿠키 이름만 담는 모듈.
 *
 * proxy.ts 처럼 쿠키 이름만 필요한 곳이 session.ts 를 임포트하면
 * node:crypto 와 env 검증(`env.server.ts` 의 모듈 로드 시점 파싱)까지 함께 끌려온다.
 * 임포트 표면을 최소로 유지한다.
 */
export const SESSION_COOKIE_NAME = 'hdg_session'
