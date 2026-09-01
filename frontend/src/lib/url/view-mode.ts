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

export const DEFAULT_VIEW_MODE: ViewMode = 'list'

const VIEW_KEY = 'view'

type RawParams = URLSearchParams | Record<string, string | string[] | undefined>

function read(params: RawParams, key: string): string | null {
  if (params instanceof URLSearchParams) return params.get(key)

  const value = params[key]
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

export function parseViewMode(params: RawParams): ViewMode {
  const raw = read(params, VIEW_KEY)
  return VIEW_MODES.includes(raw as ViewMode) ? (raw as ViewMode) : DEFAULT_VIEW_MODE
}

/**
 * 기존 필터 쿼리에 보기 방식을 얹은 링크.
 *
 * **필터를 유지한 채 전환한다.** 목록에서 "실내만" 을 보던 사람이 지도로 넘어갔을 때
 * 조건이 풀리면 갑자기 마커가 늘어난다 (긴급 시설 아트보드 02 가 같은 지적을 한다).
 */
export function viewModeHref(pathname: string, filterQuery: string, view: ViewMode): string {
  const params = new URLSearchParams(filterQuery)

  if (view === DEFAULT_VIEW_MODE) params.delete(VIEW_KEY)
  else params.set(VIEW_KEY, view)

  const query = params.toString()
  return query === '' ? pathname : `${pathname}?${query}`
}
