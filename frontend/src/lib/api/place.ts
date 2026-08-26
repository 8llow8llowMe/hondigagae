import { paths } from '@/lib/api/paths'
import { toPlaceApiQuery } from '@/lib/url/place-filters'
import type { SliceResponse } from '@/types/api'
import type { PlaceFilters, PlaceSummary } from '@/types/place'

export type PlaceSlice = SliceResponse<PlaceSummary>

/** 경로·파라미터만 만든다. 전송은 client.ts / server.ts 가 나눠 담당한다 */
export function placeListPath(filters: PlaceFilters, cursor: string | null): string {
  return paths.places.list(toPlaceApiQuery(filters, cursor))
}

export function placeDetailPath(placeId: string): string {
  return paths.places.detail(placeId)
}

/**
 * 다음 페이지 커서.
 *
 * 백엔드 `lastPlaceId` 는 "직전 응답의 마지막 placeId" 다.
 * `hasNext` 가 false 이거나 결과가 비면 더 부르지 않는다.
 */
export function nextPlaceCursor(page: PlaceSlice | undefined): string | undefined {
  if (page === undefined || !page.hasNext) return undefined

  const last = page.contents.at(-1)
  // hasNext 가 true 인데 contents 가 비면 커서를 만들 수 없다 — 무한 루프를 막는다
  return last?.placeId
}
