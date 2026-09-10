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

/**
 * 백엔드 `@Max(50)`. 지도는 목록보다 많이 받는다 — 화면에 보이는 마커가 곧 결과라
 * 20개에서 끊기면 "지도에 보이는 곳 8" 같은 개수 표기가 실제와 어긋난다.
 */
export const NEARBY_MAX_SIZE = 50

/**
 * 주변 장소 조회 경로.
 *
 * **필터를 목록과 같은 이름으로 함께 보낸다.** 아트보드 05 는 목록에서 "병원만" 을
 * 보던 사람이 지도로 넘어왔을 때 조건이 유지되기를 기대한다. `lastPlaceId`·`size`
 * 규칙만 다르고 나머지 파라미터는 `GET /places` 와 동일하다 (PlaceWebController 실측).
 */
export function nearbyPlacesPath(
  center: { lat: number; lng: number },
  radius: number,
  filters: PlaceFilters,
  size: number = NEARBY_MAX_SIZE,
): string {
  const params = new URLSearchParams({
    lat: String(center.lat),
    lng: String(center.lng),
    radius: String(Math.round(radius)),
  })

  // areaCode 는 보내지 않는다 — 반경이 이미 범위를 정한다. 둘을 함께 보내면
  // 지역 경계 밖으로 지도를 옮겼을 때 조용히 0건이 된다
  if (filters.contentType !== null) params.set('contentType', filters.contentType)
  if (filters.petAllowanceType !== null) params.set('petAllowanceType', filters.petAllowanceType)
  if (filters.indoor !== null) params.set('indoor', String(filters.indoor))
  if (filters.allowedPetSize !== null) params.set('allowedPetSize', filters.allowedPetSize)
  if (filters.petSizeType !== null) params.set('petSizeType', filters.petSizeType)
  if (filters.petWeightKg !== null) params.set('petWeightKg', String(filters.petWeightKg))
  if (filters.sourceCategory !== null) params.set('sourceCategory', filters.sourceCategory)
  if (filters.keyword !== null) params.set('keyword', filters.keyword)
  params.set('size', String(size))

  return paths.places.nearby(params.toString())
}
