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
  /*
    **검색어도 `dirty` 다** (#584). 레일에는 검색 입력이 없지만 `초기화` 는
    `DEFAULT_FACILITY_FILTERS` 로 통째로 되돌아가 검색어까지 지운다 — 그 사실을 `dirty` 가
    모르면 검색어만 걸린 상태에서 버튼이 사라져, 되돌릴 것이 남았는데 손잡이가 없다.
  */
  const dirty =
    filters.type !== DEFAULT_FACILITY_FILTERS.type ||
    filters.open24Only !== DEFAULT_FACILITY_FILTERS.open24Only ||
    filters.openNowOnly !== DEFAULT_FACILITY_FILTERS.openNowOnly ||
    filters.keyword !== DEFAULT_FACILITY_FILTERS.keyword

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
        **영업 조건이 첫 축이다** (#654 E-3).

        여기는 오래 **반경**이 첫 축이었다 — *"지도를 옮겨도 재조회하지 않으므로 반경이
        «더 넓게 찾기» 의 유일한 손잡이고 나머지 축은 그 안을 좁힌다"* (#535). 그 말은
        지금도 맞지만 **순서의 근거로는 약하다**: 반경을 넓히는 사람은 이미 결과를 보고
        부족하다고 판단한 사람이라 축을 찾아 내려갈 여유가 있다. 급한 사용자가 처음
        찾는 것은 `지금 진료중` 이고(감사 E-3 — 그 축이 여섯 번째였다), 그 칩은 이제
        **기본이 켜져 있어** 레일 맨 위에서 "왜 목록이 짧은가" 에 바로 답한다.

        모바일 칩 줄과 같은 순서다 (`EmergencyFilterChips`) — 두 표면이 다른 순서로
        같은 축을 늘어놓으면 폭을 바꿨을 때 사용자가 다시 배워야 한다.
      */}
      <FilterListHeading>{messages.emergency.narrowGroupLabel}</FilterListHeading>
      <NarrowFields
        filters={filters}
        onChange={onFiltersChange}
        counts={counts}
        showCounts={showCounts}
      />

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
        <FilterListHeading>{messages.emergency.radiusGroupLabel}</FilterListHeading>
        <RadiusField radius={radius} onChange={onRadiusChange} />
      </div>
    </div>
  )
}
