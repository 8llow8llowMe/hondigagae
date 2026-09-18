'use client'

import { useCallback, useMemo, useRef } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

import type { JejuRegionCode } from '@/lib/geo/jeju-regions'
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
  /** 권역을 URL 에 쓴다. `null` 이면 `region` 키를 지운다 (#674) */
  setRegionCode: (next: JejuRegionCode | null) => void
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
    때만 새 참조이므로 그것을 키로 쓰면 충분하다. `regionCode` 는 문자열이라
    같은 메모에 얹어도 참조가 새로 생기지 않는다 (#674).
  */
  const { filters, radius, regionCode } = useMemo(
    () => parseEmergencyBoardParams(searchParams),
    [searchParams],
  )
  const view = parseViewMode(searchParams, EMERGENCY_DEFAULT_VIEW)

  /*
    **"최신값 ref" 패턴이 필요하다 (#674).** `useEmergencyBoard` 의 `locate`·`researchAt`·
    `researchAtRegion` 은 `setSearchCenter`(useState 세터)와 나란히 `setRegionCode` 를
    쓰고, 그중 `locate` 는 마운트 전용 effect(`useEffect(() => locate(), [locate])`)의
    유일한 의존성이다 — useState 세터처럼 **참조가 영원히 바뀌지 않아야** 그 effect가
    마운트 때 한 번만 돈다.

    그런데 `setRegionCode` 는 "지금의 `filters`·`radius` 는 그대로 두고 `regionCode` 만
    바꿔 쓴다" 를 하려면 현재 값을 알아야 한다. `useCallback` 의존성에 `filters`·`radius`
    를 넣으면 검색어 하나만 바꿔도 `setRegionCode` 참조가 바뀌고, 그 여파로 `locate` 가
    다시 만들어져 마운트 effect가 또 돈다(좌표 재요청) — 최악은 사용자가 방금 고른 권역이
    직후에 도로 지워지는 것이다(권역 선택 → 리렌더 → effect 재실행 → `setRegionCode(null)`).

    **ref 에 최신 값을 담아 두고 콜백은 `router` 하나에만 의존하면** 함수 참조가 영원히
    그대로면서도 호출 시점에는 항상 최신 URL 값을 읽는다.
  */
  const latestRef = useRef({ params: { filters, radius, regionCode }, view, pathname })
  latestRef.current = { params: { filters, radius, regionCode }, view, pathname }

  const apply = useCallback(
    (partial: Partial<EmergencyBoardParams>) => {
      const { params, view, pathname } = latestRef.current
      const next: EmergencyBoardParams = { ...params, ...partial }
      const href = viewModeHref(pathname, toEmergencyBoardQuery(next), view, EMERGENCY_DEFAULT_VIEW)
      router.replace(href, { scroll: false })
    },
    [router],
  )

  const setFilters = useCallback((next: FacilityFilters) => apply({ filters: next }), [apply])
  const setRadius = useCallback((next: number) => apply({ radius: next }), [apply])
  const widenRadius = useCallback(
    () => apply({ radius: widen(latestRef.current.params.radius) }),
    [apply],
  )
  const setRegionCode = useCallback(
    (next: JejuRegionCode | null) => apply({ regionCode: next }),
    [apply],
  )

  return {
    filters,
    radius,
    regionCode,
    setFilters,
    setRadius,
    widenRadius,
    setRegionCode,
  }
}
