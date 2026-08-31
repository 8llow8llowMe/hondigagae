import { safeReturnTo } from '@/lib/http/redirect'

/**
 * 소셜 로그인 왕복 동안 복귀 경로를 보관한다.
 *
 * **URL 에 싣지 않는다.** 소셜 로그인은 우리 주소 → 제공자 → 우리 콜백으로 값이 오가는데,
 * 그 경로에 복귀 주소를 실으면 오픈 리다이렉트 표면이 그만큼 넓어진다 (정본 D3-3).
 * `sessionStorage` 는 탭 단위·같은 오리진이라 왕복 한 번을 버티기에 딱 맞다.
 *
 * **꺼낼 때 반드시 `safeReturnTo` 를 통과시킨다.** 우리가 넣은 값이라도 저장소는
 * 브라우저에 있어 사용자가 콘솔로 바꿀 수 있다 — 신뢰 경계 밖이다.
 *
 * `sessionStorage` 접근 자체가 던질 수 있다 (사파리 비공개 모드·사이트 데이터 차단).
 * 복귀 경로를 못 들고 있는 것은 로그인을 막을 이유가 아니므로 조용히 `/` 로 떨어진다.
 */
const KEY = 'hondigagae.oauth.returnTo'

export function rememberReturnTo(path: string): void {
  try {
    globalThis.sessionStorage?.setItem(KEY, path)
  } catch {
    // 저장이 안 되면 콜백이 '/' 로 보낸다. 로그인 자체는 성립한다
  }
}

/** 읽고 지운다. 왕복 1회용이라 남겨 두면 다음 로그인이 엉뚱한 곳으로 간다 */
export function takeReturnTo(): string {
  let raw: string | null = null
  try {
    raw = globalThis.sessionStorage?.getItem(KEY) ?? null
    globalThis.sessionStorage?.removeItem(KEY)
  } catch {
    raw = null
  }
  return safeReturnTo(raw)
}
