'use client'

import { FilterListHeading } from '@/components/filter-list'
import { NarrowFields, RadiusField, TypeField } from '@/features/emergency/emergency-filter-fields'
import { messages } from '@/lib/messages'
import { DEFAULT_FACILITY_FILTERS, type FacilityFilters } from '@/types/emergency'

/**
 * 데스크톱 필터 레일 — `/places` 의 `PlaceFilterRail` 과 같은 자리(좌 280 sticky) · 같은 문법.
 *
 * **레일은 즉시 반영한다.** 세로 공간이 있어 전체 축이 한눈에 보이고 결과가 옆에서 같이
 * 바뀌므로 확정 단계가 필요 없다. 모바일 시트만 적용 버튼을 갖는다.
 *
 * **`PlaceFilterRail` 과 달리 URL 을 직접 만지지 않는다.** 이 화면은 조회에 좌표가 필요해
 * 서버 프리페치가 없고, 조건·반경·개수를 `useEmergencyBoard` 가 쥐고 있다. 그래서 레일은
 * 값을 받고 `onChange` 만 부르는 순수 컨트롤이고, URL 반영은 보드가 한다 (#419).
 *
 * **반경은 `초기화` 가 건드리지 않는다.** 필터가 아니라 조회 파라미터라 `dirty` 산식에서
 * 뺀다 — 넓혀 찾던 사용자가 조건 하나를 끄려다 결과를 통째로 잃는다.
 */
export function EmergencyFilterRail({
  filters,
  onFiltersChange,
  radius,
  onRadiusChange,
  counts,
  showCounts,
}: {
  filters: FacilityFilters
  onFiltersChange: (next: FacilityFilters) => void
  radius: number
  onRadiusChange: (next: number) => void
  counts: {
    all: number
    byType: Record<string, number>
    open24: number
    openNow: number
  }
  showCounts: boolean
}) {
  const dirty =
    filters.type !== DEFAULT_FACILITY_FILTERS.type ||
    filters.open24Only !== DEFAULT_FACILITY_FILTERS.open24Only ||
    filters.openNowOnly !== DEFAULT_FACILITY_FILTERS.openNowOnly

  return (
    <div className="filter-rail pb-5">
      <div className="filter-rail-title flex items-baseline justify-between gap-2 px-5 pt-5 pb-3">
        <h2 className="text-body-1 text-fg font-semibold">{messages.place.filterTitle}</h2>
        {/* 걸린 필터가 없으면 초기화할 것이 없다 — 누를 수 없는 버튼을 남기지 않는다 */}
        {dirty && (
          <button
            type="button"
            onClick={() => onFiltersChange(DEFAULT_FACILITY_FILTERS)}
            className="text-body-2 text-link hover:text-link-hover focus-visible:ring-brand-500 -mr-1 inline-flex min-h-11 items-center rounded-sm px-1 font-semibold focus-visible:ring-2 focus-visible:outline-none"
          >
            {messages.place.resetFilters}
          </button>
        )}
      </div>

      {/*
        **반경이 첫 축이다.** 이 화면은 지도를 옮겨도 재조회하지 않으므로(거리가 내 위치
        기준으로 남아야 한다) 반경이 "더 넓게 찾기" 의 유일한 손잡이고, 나머지 축은 그 안을
        좁힌다. 부제(`emergencySummaryLine`)가 반경을 맨 앞에 두는 것과 같은 순서다.
      */}
      <FilterListHeading>{messages.emergency.radiusGroupLabel}</FilterListHeading>
      <RadiusField radius={radius} onChange={onRadiusChange} />

      <div className="border-border mt-3 border-t">
        <FilterListHeading>{messages.emergency.typeGroupLabel}</FilterListHeading>
        <TypeField
          filters={filters}
          onChange={onFiltersChange}
          counts={counts}
          showCounts={showCounts}
        />
      </div>

      <div className="border-border mt-3 border-t">
        <FilterListHeading>{messages.emergency.narrowGroupLabel}</FilterListHeading>
        <NarrowFields
          filters={filters}
          onChange={onFiltersChange}
          counts={counts}
          showCounts={showCounts}
        />
      </div>
    </div>
  )
}
