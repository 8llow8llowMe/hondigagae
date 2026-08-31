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

/*
  `no-restricted-globals` 를 **줄 단위로 끄고 근거를 남긴다** (eslint.config.mjs 헤더 규약).

  `globalThis.sessionStorage` 로 쓰면 규칙이 bare identifier 만 보므로 조용히 통과하는데,
  그러면 다음 사람이 **토큰을** 같은 형태로 넣어도 lint 가 아무 말을 하지 않는다.
  규칙이 막으려는 것은 storage 접근 자체가 아니라 `auth-guide.md` §2 의 "토큰·세션을
  브라우저 storage 에 두지 않는다" 이고, 여기 담기는 것은 토큰이 아니라 복귀 경로다.

  SSR 에서는 `sessionStorage` 가 정의되지 않아 `typeof` 로 먼저 본다 (모듈 스코프가 아니라
  함수 안이므로 서버 렌더에는 도달하지 않지만, 이 모듈은 client 전용 표시가 없다).
*/
function storage(): Storage | null {
  try {
    // eslint-disable-next-line no-restricted-globals -- 토큰이 아니라 복귀 경로다 (소셜콜백-세부명세.md D3-3)
    return typeof sessionStorage === 'undefined' ? null : sessionStorage
  } catch {
    // 접근자 자체가 던진다 (사이트 데이터 차단)
    return null
  }
}

export function rememberReturnTo(path: string): void {
  try {
    storage()?.setItem(KEY, path)
  } catch {
    // 저장이 안 되면 콜백이 '/' 로 보낸다. 로그인 자체는 성립한다
  }
}

/** 읽고 지운다. 왕복 1회용이라 남겨 두면 다음 로그인이 엉뚱한 곳으로 간다 */
export function takeReturnTo(): string {
  let raw: string | null = null
  try {
    const store = storage()
    raw = store?.getItem(KEY) ?? null
    store?.removeItem(KEY)
  } catch {
    raw = null
  }
  return safeReturnTo(raw)
}
