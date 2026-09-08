/**
 * 목록 ↔ 지도 보기 방식의 URL 직렬화.
 *
 * 장소 찾기와 긴급 시설이 **같은 키(`view`)** 를 쓴다 — 아트보드가 두 화면에 같은
 * 세그먼트 컨트롤을 두므로 URL 도 같은 모양이어야 한다.
 *
 * 규약 (architecture-guide.md §10)
 *  - 기본값(`list`)은 URL 에서 생략한다 → 빈 URL = 목록
 *  - 잘못된 값은 예외 없이 기본값으로 떨어뜨린다
 *
 * **`view` 는 백엔드 파라미터가 아니다.** 화면 표현 상태이므로 API 쿼리에 섞이지
 * 않도록 `toPlaceApiQuery` 와 완전히 분리된 곳에 둔다.
 */

export const VIEW_MODES = ['list', 'map'] as const
export type ViewMode = (typeof VIEW_MODES)[number]

/**
 * 라이브러리 기본값. **화면이 자기 기본값을 갖는다** — 아래 `PLACES_DEFAULT_VIEW` 처럼
 * 호출부가 넘기면 그것이 이긴다.
 */
export const DEFAULT_VIEW_MODE: ViewMode = 'list'

/**
 * 장소 찾기(`/places`)의 기본 보기는 **지도**다.
 *
 * 이 화면에 오는 이유가 "제주 어디에 무엇이 있나" 이고, 그 질문에 먼저 답하는 것은
 * 목록이 아니라 지도다. 목록으로 열면 사용자가 매번 전환을 한 번 더 눌러야 했다.
 *
 * **긴급 시설(`/emergency`)은 그대로 목록이 먼저다.** 급할 때 필요한 것은 위치가 아니라
 * 전화번호이고, 지도 SDK 가 뜨기를 기다릴 여유가 없다. 그래서 기본값을 상수 하나로
 * 통일하지 않고 화면별로 둔다.
 */
export const PLACES_DEFAULT_VIEW: ViewMode = 'map'

const VIEW_KEY = 'view'

type RawParams = URLSearchParams | Record<string, string | string[] | undefined>

function read(params: RawParams, key: string): string | null {
  if (params instanceof URLSearchParams) return params.get(key)

  const value = params[key]
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

export function parseViewMode(
  params: RawParams,
  /** 이 화면의 기본 보기. 값이 없거나 잘못된 값이면 여기로 떨어진다 */
  defaultView: ViewMode = DEFAULT_VIEW_MODE,
): ViewMode {
  const raw = read(params, VIEW_KEY)
  return VIEW_MODES.includes(raw as ViewMode) ? (raw as ViewMode) : defaultView
}

/**
 * 기존 필터 쿼리에 보기 방식을 얹은 링크.
 *
 * **필터를 유지한 채 전환한다.** 목록에서 "실내만" 을 보던 사람이 지도로 넘어갔을 때
 * 조건이 풀리면 갑자기 마커가 늘어난다 (긴급 시설 아트보드 02 가 같은 지적을 한다).
 *
 * **생략되는 쪽은 그 화면의 기본값이다.** 장소 찾기는 지도가 기본이라 `/places` 가 지도이고
 * 목록이 `?view=list` 로 붙는다. `parseViewMode` 와 **같은 기본값을 넘겨야 한다** — 어긋나면
 * 링크가 가리키는 보기와 페이지가 파싱하는 보기가 달라져 전환이 먹지 않는다.
 */
export function viewModeHref(
  pathname: string,
  filterQuery: string,
  view: ViewMode,
  defaultView: ViewMode = DEFAULT_VIEW_MODE,
): string {
  const params = new URLSearchParams(filterQuery)

  if (view === defaultView) params.delete(VIEW_KEY)
  else params.set(VIEW_KEY, view)

  const query = params.toString()
  return query === '' ? pathname : `${pathname}?${query}`
}
