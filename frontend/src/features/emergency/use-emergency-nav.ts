'use client'

import { useMemo } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

import {
  type EmergencyBoardParams,
  parseEmergencyBoardParams,
  toEmergencyBoardQuery,
  widen,
} from '@/lib/url/emergency-filters'
import { EMERGENCY_DEFAULT_VIEW, parseViewMode, viewModeHref } from '@/lib/url/view-mode'
import type { FacilityFilters } from '@/types/emergency'

/**
 * 긴급 시설 화면의 조건을 URL 에서 읽고 URL 에 쓴다 — architecture-guide.md §10
 * (필터·정렬·탭은 `searchParams`).
 *
 * **`usePlaceFilterNav` 와 한 가지가 다르다: 여기는 읽기까지 한다.** `/places` 는 서버
 * 프리페치가 있어 `page.tsx` 가 `searchParams` 를 읽고 훅은 쓰기만 하지만, 이 화면은
 * 좌표가 브라우저에만 있어 프리페치가 없다 (§9 확정표). 읽기를 페이지에 두면 지도 →
 * 패널 → 시트로 조건을 prop 으로 꿰야 하고, 그 사슬 어딘가가 빠지면 두 갈래가 다른
 * 조건을 본다.
 *
 * **`replace` 다.** 칩 한 번 누를 때마다 히스토리가 쌓이면 뒤로가기가 필터 되감기가 되고,
 * 목록에서 상세로 갔다가 돌아오는 정상 경로가 묻힌다.
 *
 * **`viewModeHref` 로 조립한다.** 조건만 새로 쓰면 `view` 가 떨어져 필터를 만질 때마다
 * 지도가 목록으로 튄다. 링크를 만드는 곳이 페이지(토글)와 여기 둘인데, 둘 다 같은
 * 함수를 거쳐야 한 쪽만 규칙이 어긋나는 일이 없다.
 */
export function useEmergencyNav(): EmergencyBoardParams & {
  setFilters: (next: FacilityFilters) => void
  setRadius: (next: number) => void
  widenRadius: () => void
} {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  /*
    **`searchParams` 로 메모한다 (review #353 Minor).** 메모 없이 매 렌더
    `parseEmergencyBoardParams` 를 새로 부르면 `filters` 가 매번 새 객체 참조가
    된다 — `EmergencyMapView` 의 `useMemo(..., [inBounds, board.filters])` 가
    그 참조를 의존성으로 쓰므로 절대 캐시에 걸리지 않고, 그 아래 `pins` 도 매번
    새 배열이 되어 `MapCanvas` 가 시트 드래그·패널 접기 같은 무관한 렌더마다
    최대 136개 오버레이를 다시 만든다. `searchParams` 는 URL 이 실제로 바뀔
    때만 새 참조이므로 그것을 키로 쓰면 충분하다.
  */
  const { filters, radius } = useMemo(() => parseEmergencyBoardParams(searchParams), [searchParams])
  const view = parseViewMode(searchParams, EMERGENCY_DEFAULT_VIEW)

  function apply(next: EmergencyBoardParams) {
    const href = viewModeHref(pathname, toEmergencyBoardQuery(next), view, EMERGENCY_DEFAULT_VIEW)
    router.replace(href, { scroll: false })
  }

  return {
    filters,
    radius,
    setFilters: (next) => apply({ filters: next, radius }),
    setRadius: (next) => apply({ filters, radius: next }),
    widenRadius: () => apply({ filters, radius: widen(radius) }),
  }
}
