/**
 * 쿠키 이름만 담는 모듈.
 *
 * middleware.ts 는 Edge Runtime 에서 돌기 때문에 node:crypto 를 쓰는
 * session-crypto.ts 를 끌어올 수 없다. 이름만 필요한 곳은 이 파일을 import 한다.
 */
export const SESSION_COOKIE_NAME = 'hdg_session'
