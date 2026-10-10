/**
 * 장소 상세에서 **떠난 장소 찾기 화면**으로 돌아갈 주소 (#1272).
 *
 * `PlaceBackLink` 가 `/places` 로 고정이었는데 기본 보기가 지도(`PLACES_DEFAULT_VIEW`)라, 목록 보기에서
 * 들어온 사람도 지도로 돌아갔다 — 고른 필터까지 잃었다. 그래서 `/places` 를 보는 동안 주소(경로 + 쿼리)를
 * 기억해 두고 링크가 그리로 간다. 브라우저 뒤로 가기는 원래 맞게 돌아간다 — 이것은 **화면의 링크** 몫이다.
 *
 * **URL 에 싣지 않는다.** 상세 주소(`/places/{id}`)는 공유 · 검색 유입의 정본이라 `?from=` 을 붙이면
 * 같은 장소가 여러 주소가 된다. `sessionStorage` 는 탭 단위라 "이 탭에서 방금 보던 화면" 과 뜻이 같다
 * (선례: `lib/auth/oauth-return-to.ts`).
 *
 * **꺼낼 때 검사한다**(`safePlacesHref`) — 저장소는 브라우저에 있어 신뢰 경계 밖이다. 장소 찾기
 * 주소(`/places` + 쿼리)가 아니면 `/places` 로 떨어진다. 저장소가 없거나 던지면 역시 `/places` 다 —
 * 돌아갈 곳을 모르는 것은 예전 동작 그대로일 뿐이다.
 */
export const PLACES_PATH = '/places'

const KEY = 'hondigagae.places.returnHref'
// 줄바꿈 · 제어 문자가 섞인 값은 주소로 쓰지 않는다
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/

/*
  `no-restricted-globals` 를 줄 단위로 끄는 근거는 `oauth-return-to.ts` 와 같다 — 규칙이 막으려는 것은
  토큰 · 세션을 브라우저 storage 에 두는 것이고(`auth-guide.md` §2), 여기 담기는 것은 화면 주소다.
*/
function storage(): Storage | null {
  try {
    // eslint-disable-next-line no-restricted-globals -- 토큰이 아니라 돌아갈 화면 주소다 (#1272)
    return typeof sessionStorage === 'undefined' ? null : sessionStorage
  } catch {
    return null
  }
}

/** 장소 찾기 주소(`/places` 또는 `/places?…`)면 그대로, 아니면 `/places` */
export function safePlacesHref(raw: string | null | undefined): string {
  if (typeof raw !== 'string' || CONTROL_CHARS.test(raw)) return PLACES_PATH
  if (raw === PLACES_PATH || raw.startsWith(`${PLACES_PATH}?`)) return raw
  return PLACES_PATH
}

export function rememberPlacesHref(href: string): void {
  try {
    storage()?.setItem(KEY, href)
  } catch {
    // 기억하지 못하면 링크가 `/places` 로 간다 — 예전 동작이다
  }
}

/** 읽기만 한다 — 상세를 여러 번 오가도 같은 화면으로 돌아가야 한다 */
export function readPlacesHref(): string {
  try {
    return safePlacesHref(storage()?.getItem(KEY))
  } catch {
    return PLACES_PATH
  }
}
