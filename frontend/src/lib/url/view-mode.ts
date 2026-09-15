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
 */
export const PLACES_DEFAULT_VIEW: ViewMode = 'map'

/**
 * 긴급 시설(`/emergency`)의 기본 보기는 **목록**이다 (#639).
 *
 * #353 이 한동안 지도로 뒀다가 되돌렸다. 되돌린 근거는 원래의 근거와 같다 —
 * *"급할 때 필요한 것은 위치가 아니라 전화번호이고, 지도 SDK 를 기다릴 여유가 없다."*
 * #353 은 그것을 모바일 시트(중간 단계로 열림)와 SDK 실패 폴백으로 지킬 수 있다고 봤는데,
 * **390px 실측에서 첫 화면이 `이 지역 42곳 · 14곳 · 21곳` 클러스터 알약이 겹친 지도**였다
 * (UI/UX 감사 E-1). 읽을 수 있는 것이 하나도 없는 화면을 급할 때 여는 사람에게 먼저 준
 * 셈이다. 스크린리더 사용자에게는 첫 콘텐츠가 통째로 캔버스였다.
 *
 * 지도는 카드 제목 줄 `ViewToggle` 로 **한 탭** 거리에 그대로 있고, 링크는 `?view=map` 이다.
 *
 * **폭에 따라 가르지 않는다** (세부명세 D8-2). `view` 는 URL 파라미터라 데스크톱만 지도로
 * 열면 같은 링크가 기기마다 다른 화면을 연다.
 *
 * `PLACES_DEFAULT_VIEW` 와 **값이 갈렸다.** 두 상수를 따로 둔 규약이 존재하는 이유가
 * 이것이다 — 한쪽을 바꿔도 다른 쪽이 따라 움직이지 않는다.
 */
export const EMERGENCY_DEFAULT_VIEW: ViewMode = 'list'

/**
 * 장소 담기(`/plans/[planId]/days/[day]/add`)의 기본 보기도 **지도**다 (#370).
 *
 * 장소를 고르는 행위가 `/places` 와 같은데 한쪽만 목록이면, 담기 화면에서만 위치 감각을
 * 잃는다 — 그날 담은 다른 곳과 얼마나 떨어져 있는지가 하루 동선의 전부다.
 *
 * **`PLACES_DEFAULT_VIEW` 를 그대로 쓰지 않는다.** 값은 지금 같지만 이 파일의 규약이
 * "화면이 자기 기본값을 갖는다" 이고, 긴급 시설이 목록으로 남은 것이 그 규약의 존재
 * 이유다. 한 상수를 두 화면이 나눠 쓰면 한쪽 기본값을 바꿀 때 다른 쪽이 따라 움직인다.
 */
export const PLAN_ADD_DEFAULT_VIEW: ViewMode = 'map'

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
