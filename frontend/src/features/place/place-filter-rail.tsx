'use client'

import { FilterListHeading } from '@/components/filter-list'
import { useSelectedPet } from '@/features/nav/use-selected-pet'
import {
  ContentTypeField,
  IndoorField,
  PetAllowanceField,
  PetSizeField,
  RegionField,
} from '@/features/place/place-filter-fields'
import { usePlaceFilterNav } from '@/features/place/use-place-filter-nav'
import { messages } from '@/lib/messages'
import { DEFAULT_PLACE_FILTERS, toPlaceFilterQuery } from '@/lib/url/place-filters'
import type { PlaceFilters } from '@/types/place'

/**
 * 데스크톱 필터 레일 — 아트보드 `03 목록 — 데스크톱` (좌 280 sticky).
 *
 * **레일은 즉시 반영한다.** 세로 공간이 있어 전체 축이 한눈에 보이고 결과가 옆에서 같이
 * 바뀌므로 확정 단계가 필요 없다. 모바일 시트만 적용 버튼을 갖는다 (아트보드 02).
 *
 * 축 사이는 1px 구분선으로 잇는다 — 같은 묶음(필터) 안이라 8px 밴드를 쓰지 않는다
 * (디자인 가이드 §4).
 */
export function PlaceFilterRail({
  filters,
  /** 미로그인이면 반려견 목록을 조회하지 않는다 — 크기 축 컨트롤이 빠진다 (#200) */
  authed,
}: {
  filters: PlaceFilters
  authed: boolean
}) {
  const { apply, reset } = usePlaceFilterNav()
  const { pet } = useSelectedPet(authed)

  const dirty = toPlaceFilterQuery(filters) !== toPlaceFilterQuery(DEFAULT_PLACE_FILTERS)

  return (
    <div className="filter-rail pb-5">
      <div className="filter-rail-title flex items-baseline justify-between gap-2 px-5 pt-5 pb-3">
        <h2 className="text-body-1 text-fg font-semibold">{messages.place.filterTitle}</h2>
        {/* 걸린 필터가 없으면 초기화할 것이 없다 — 누를 수 없는 버튼을 남기지 않는다 */}
        {dirty && (
          <button
            type="button"
            onClick={reset}
            className="text-body-2 text-link hover:text-link-hover focus-visible:ring-brand-500 -mr-1 inline-flex min-h-11 items-center rounded-sm px-1 font-semibold focus-visible:ring-2 focus-visible:outline-none"
          >
            {messages.place.resetFilters}
          </button>
        )}
      </div>

      {/*
        **첫 축은 제목 줄 선에서 띄운다** (#934). 제목 아래 선(#553, `.filter-rail-title`)이 생긴 뒤로
        첫 축만 축 제목이 없어 첫 행이 그 선에 0px 로 붙어 있었다. 다른 축은 선 아래에
        제목(`pt-4`)이 여백을 만든다 — 여기는 제목이 없으니 축 끝 여백(`mt-3`)과 같은 12 를 둔다.
      */}
      <div className="pt-3">
        <PetAllowanceField filters={filters} onChange={apply} />
        <PetSizeField filters={filters} onChange={apply} pet={pet} />
      </div>

      <div className="border-border mt-3 border-t">
        <FilterListHeading>{messages.place.filterRegionLabel}</FilterListHeading>
        <RegionField filters={filters} onChange={apply} />
      </div>

      <div className="border-border mt-3 border-t">
        <FilterListHeading>{messages.place.filterContentTypeLabel}</FilterListHeading>
        <ContentTypeField filters={filters} onChange={apply} />
      </div>

      <div className="border-border mt-3 border-t">
        <FilterListHeading>{messages.place.filterIndoorLabel}</FilterListHeading>
        <IndoorField filters={filters} onChange={apply} />
      </div>
    </div>
  )
}
