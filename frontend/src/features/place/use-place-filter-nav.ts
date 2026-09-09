'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'

import { DEFAULT_PLACE_FILTERS, toPlaceFilterQuery } from '@/lib/url/place-filters'
import {
  parseViewMode,
  PLACES_DEFAULT_VIEW,
  type ViewMode,
  viewModeHref,
} from '@/lib/url/view-mode'
import type { PlaceFilters } from '@/types/place'

/**
 * 필터가 바뀐 뒤의 주소. **훅에서 떼어 둔 순수 함수다** — 회귀가 난 곳이 조립 규칙이라
 * 라우터 없이 그것만 고정할 수 있어야 한다 (docs/testing-guide.md §1).
 */
export function placeFilterHref(pathname: string, filters: PlaceFilters, view: ViewMode): string {
  return viewModeHref(pathname, toPlaceFilterQuery(filters), view, PLACES_DEFAULT_VIEW)
}

/**
 * 필터를 URL 에 반영한다 — architecture-guide.md §10 (필터·정렬·탭은 `searchParams`).
 *
 * **`replace` 다.** 필터 한 번 만질 때마다 히스토리가 쌓이면 뒤로가기가 필터 되감기가 되고,
 * 목록에서 상세로 갔다가 돌아오는 정상 경로가 묻힌다.
 *
 * 데스크톱 레일 · 모바일 칩 · 더보기 시트가 **같은 함수를 쓴다** — 세 곳이 각자
 * `router.replace` 를 조립하면 `scroll: false` 하나만 빠져도 화면이 튄다.
 *
 * **`viewModeHref` 로 조립한다.** 조건만 새로 쓰면 `view` 가 떨어지는데, 이 화면의 기본
 * 보기는 **지도**라(`PLACES_DEFAULT_VIEW`) `?view=list` 가 사라지는 순간 목록에서 필터를
 * 만진 사용자가 지도로 튕겨 나간다. 긴급 시설이 같은 함정을 같은 방법으로 막는다
 * (`features/emergency/use-emergency-nav.ts`) — 링크를 만드는 곳이 페이지(토글)와 여기
 * 둘인데, 둘 다 같은 함수를 거쳐야 한쪽만 규칙이 어긋나는 일이 없다.
 *
 * **`reset` 도 `view` 를 지킨다.** 초기화가 바꾸는 것은 조건이지 보고 있는 화면이 아니다.
 */
export function usePlaceFilterNav(): {
  apply: (next: PlaceFilters) => void
  reset: () => void
} {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const view = parseViewMode(searchParams, PLACES_DEFAULT_VIEW)

  function go(filters: PlaceFilters) {
    router.replace(placeFilterHref(pathname, filters, view), { scroll: false })
  }

  return {
    apply: go,
    reset: () => go(DEFAULT_PLACE_FILTERS),
  }
}
