import { isPlaceId } from '@/lib/place/place-id'

/**
 * 지도 보기에서 고른 장소 — `?place={placeId}` (#1227).
 *
 * **URL 에 둔다** (architecture-guide.md §10). 새로고침 · 공유 · 뒤로가기가 같은 미리보기를
 * 복원해야 한다. 필터 · 보기 키와 섞이지 않는다 — 필터 링크(`placeFilterHref`)는 이 키를
 * 싣지 않아, **필터를 바꾸면 미리보기가 닫힌다.** 결과 목록이 바뀌는 순간이라 의도다.
 */
export const PLACE_PREVIEW_KEY = 'place'

/** 장소 id 모양이 아니면 `null` 이다 — 손으로 만든 주소가 조회를 쏘지 않게 한다 */
export function readPlacePreview(params: URLSearchParams): string | null {
  const raw = params.get(PLACE_PREVIEW_KEY)
  return raw !== null && isPlaceId(raw) ? raw : null
}

/**
 * 현재 주소(경로 + 쿼리 + 해시)에서 `place` 만 바꾼 주소. `null` 이면 지운다.
 *
 * 순수 함수로 둔 이유: 미리보기는 `window.history` 로 주소를 바꾼다(`usePlacePreview`) —
 * 조립을 떼어 두면 node 테스트로 잠글 수 있다.
 */
export function placePreviewHref(current: string, placeId: string | null): string {
  const url = new URL(current, 'http://localhost')

  if (placeId === null) url.searchParams.delete(PLACE_PREVIEW_KEY)
  else url.searchParams.set(PLACE_PREVIEW_KEY, placeId)

  const query = url.searchParams.toString()
  return `${url.pathname}${query === '' ? '' : `?${query}`}${url.hash}`
}

/** 서버 페이지의 `searchParams` 레코드에서 읽는다 — 프리페치용 (#1227 · architecture-guide §9) */
export function readPlacePreviewParam(value: string | string[] | undefined): string | null {
  return typeof value === 'string'
    ? readPlacePreview(new URLSearchParams({ [PLACE_PREVIEW_KEY]: value }))
    : null
}

/**
 * 미리보기를 뺀 **조건** — `place` 를 지우고 키 순으로 줄 세운 쿼리. 미리보기를 쌓을 때와 닫을 때를 견준다
 * (`placePreviewHistoryAction` 의 `baseChanged`). 줄 세우는 것은 같은 조건이 조립 순서만 달라 "바뀜" 으로 읽히지
 * 않게 하려는 것이다.
 */
export function placePreviewBaseQuery(search: string): string {
  const params = new URLSearchParams(search)
  params.delete(PLACE_PREVIEW_KEY)
  params.sort()
  return params.toString()
}

export type PlacePreviewHistoryAction = 'none' | 'push' | 'replace' | 'back'

/**
 * 고르기 · 닫기가 기록을 어떻게 바꿀지 (#1227). 실행은 `usePlacePreview` 가 한다.
 *
 * - 처음 열기 = push, 다른 장소 = replace, 같은 장소 = none.
 * - 닫기는 **이 화면이 쌓은 칸 위일 때만** back, 아니면 replace(공유 링크로 들어온 칸을 back 하면
 *   화면을 떠난다). 이미 닫혀 있으면 none.
 *
 * `pushed` 는 호출부가 쥔 표시다 — 뒤로 · 앞으로 가기(`popstate`)가 오면 `false` 로 돌린다. 쌓은 칸을
 * 지나 공유 링크 칸으로 돌아왔는데 표시가 남아 있으면 ✕ 가 사이트 밖으로 back 한다(리뷰 지적).
 *
 * `baseChanged` — 쌓은 뒤 **조건(`place` 를 뺀 쿼리, `placePreviewBaseQuery`)이 바뀌었나.** 바뀌었으면 쌓은
 * 칸이어도 replace 로 닫는다. 반려견을 바꾸면 체구 필터 맞춤이 미리보기 칸을 `replace` 로 덮는데(#1301
 * `keepPreview`), 그때 back 하면 열기 전 칸 — 옛 반려견의 체구 값 — 으로 돌아가 결과가 되감긴다(#1301 리뷰 B1).
 */
export function placePreviewHistoryAction(params: {
  currentId: string | null
  placeId: string | null
  pushed: boolean
  baseChanged: boolean
}): PlacePreviewHistoryAction {
  const { currentId, placeId, pushed, baseChanged } = params

  if (placeId === null) {
    if (currentId === null) return 'none'
    return pushed && !baseChanged ? 'back' : 'replace'
  }

  if (placeId === currentId) return 'none'
  return currentId === null ? 'push' : 'replace'
}
