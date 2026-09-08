'use client'

import { useState } from 'react'

import { BottomSheet } from '@/components/bottom-sheet'
import { Button } from '@/components/button'
import { Chip, ChipGroup } from '@/components/chip'
import { FilterListHeading } from '@/components/filter-list'
import { ChevronDownIcon, SlidersIcon } from '@/components/icons'
import { useSelectedPet } from '@/features/nav/use-selected-pet'
import {
  CONTENT_TYPE_FILTER_ORDER,
  CONTENT_TYPE_LABEL,
  SIGUNGU_LABEL,
} from '@/features/place/filter-labels'
import {
  IndoorField,
  PetAllowanceField,
  PetSizeField,
  RegionField,
} from '@/features/place/place-filter-fields'
import { usePlaceFilterNav } from '@/features/place/use-place-filter-nav'
import { messages } from '@/lib/messages'
import { DEFAULT_PLACE_FILTERS, toPlaceFilterQuery } from '@/lib/url/place-filters'
import { cn } from '@/lib/utils/cn'
import type { ContentTypeCode, PlaceFilters } from '@/types/place'

/** 열려 있는 시트. `null` 이면 닫힘 */
type OpenSheet = 'region' | 'more'

/**
 * 지도 보기의 필터 줄 — **유형을 가로로 펼친 토글 + 나머지 축은 시트 트리거.**
 *
 * **지도 보기에는 필터 컨트롤이 아예 없었다.** 데스크톱 레일은 지도를 세 번 접어서
 * 쓸 수 없고(`app/(main)/places/(list)/page.tsx` 주석), 모바일 칩 줄은 목록에만
 * 붙어 있었다. 그래서 지도에서 조건을 좁히려면 목록으로 되돌아가야 했다.
 *
 * 그 자리에는 "지도에 보이는 곳 20" 이라는 **제목**이 있었다. 제목이 할 일이 없는
 * 자리다 — 패널이 무엇인지는 안에 든 목록이 이미 말한다. 개수는 목록 위 캡션으로
 * 내리고, 이 자리는 사용자가 실제로 만질 것에 준다.
 *
 * **유형만 펼친다.** 8종 + "전체" 라 가로로 나열되는 것이 자연스럽고, 지도에서 가장
 * 자주 바꾸는 축이다. 지역(3갈래)·동반·실내·크기는 값을 고르기보다 조합해서 확정하는
 * 축이라 시트로 남긴다 — 가로줄에 다 펼치면 스크롤이 길어져 유형이 묻힌다.
 *
 * **유형은 라디오다.** 백엔드 `contentType` 이 단일 `@RequestParam` 이라 여러 개를 보낼
 * 수 없고, "전체" 칩이 해제 역할을 맡는다 (`ContentTypeField` 와 같은 판단).
 */
export function PlaceMapFilterBar({
  filters,
  /** 미로그인이면 반려견 목록을 조회하지 않는다 — 크기 축 컨트롤이 빠진다 (#200) */
  authed,
  className,
}: {
  filters: PlaceFilters
  authed: boolean
  className?: string
}) {
  const { apply, reset } = usePlaceFilterNav()
  const { pet } = useSelectedPet(authed)

  const [open, setOpen] = useState<OpenSheet | null>(null)
  // 시트 초안. 열 때 현재 값을 복사하고 적용 전까지 URL 을 건드리지 않는다
  const [draft, setDraft] = useState<PlaceFilters>(filters)

  function openSheet(sheet: OpenSheet) {
    setDraft(filters)
    setOpen(sheet)
  }

  function applyDraft() {
    apply(draft)
    setOpen(null)
  }

  const regionLabel =
    filters.sigunguCode === null
      ? messages.place.filterRegionLabel
      : (SIGUNGU_LABEL[filters.sigunguCode] ?? messages.place.filterRegionLabel)

  /*
    시트 안의 세 축 중 하나라도 걸려 있으면 트리거가 켜져 있어야 한다 — 접힌 곳에 걸린
    필터는 결과만 줄이고 이유는 보이지 않는다. **동반 축이 여기 포함된다**: 목록 칩 줄과
    달리 이 줄에는 "동반 가능만" 상시 칩이 없다(유형에 자리를 줬다).
  */
  const moreActive =
    filters.petAllowanceType !== null || filters.indoor !== null || filters.petSizeType !== null

  const dirty = toPlaceFilterQuery(filters) !== toPlaceFilterQuery(DEFAULT_PLACE_FILTERS)

  return (
    <div className={cn('flex min-w-0 items-center gap-1.5', className)}>
      {/*
        유형만 가로 스크롤한다 — 지역·더보기는 항상 보여야 한다. 둘을 한 스크롤러에 넣으면
        조건을 조합하려는 사용자가 매번 끝까지 밀어야 한다.
        스크롤바는 감춘다(`scrollbar-none`) — 지도 위에 얹히는 줄이라 두 줄로 보인다
      */}
      <ChipGroup
        label={messages.place.filterContentTypeLabel}
        exclusive
        className="flex min-w-0 flex-1 scrollbar-none gap-1.5 overflow-x-auto"
      >
        <Chip
          exclusive
          selected={filters.contentType === null}
          onSelect={() => apply({ ...filters, contentType: null })}
        >
          {messages.place.filterAll}
        </Chip>
        {CONTENT_TYPE_FILTER_ORDER.map((code: ContentTypeCode) => (
          <Chip
            key={code}
            exclusive
            selected={filters.contentType === code}
            onSelect={() => apply({ ...filters, contentType: code })}
          >
            {CONTENT_TYPE_LABEL[code]}
          </Chip>
        ))}
      </ChipGroup>

      {/* 구분선 — 왼쪽은 값을 고르는 축, 오른쪽은 시트를 여는 트리거다 */}
      <span aria-hidden className="bg-border h-6 w-px shrink-0" />

      <Chip
        selected={filters.sigunguCode !== null}
        expanded={open === 'region'}
        onSelect={() => openSheet('region')}
        className="shrink-0"
      >
        {regionLabel}
        <ChevronDownIcon size={16} />
      </Chip>

      {/* 아이콘만 둔다 — 지도 위 줄이라 폭이 없고, 이름은 `aria-label` · `title` 이 맡는다 */}
      <Chip
        selected={moreActive}
        expanded={open === 'more'}
        onSelect={() => openSheet('more')}
        className="w-11 shrink-0 justify-center px-0"
        label={messages.place.filterMore}
      >
        <SlidersIcon size={16} />
      </Chip>

      {dirty && (
        <Chip selected={false} onSelect={reset} className="shrink-0">
          {messages.place.resetFilters}
        </Chip>
      )}

      <BottomSheet
        open={open === 'region'}
        onClose={() => setOpen(null)}
        title={messages.place.filterRegionLabel}
        footer={<SheetFooter onCancel={() => setOpen(null)} onApply={applyDraft} />}
      >
        <RegionField filters={draft} onChange={setDraft} />
      </BottomSheet>

      <BottomSheet
        open={open === 'more'}
        onClose={() => setOpen(null)}
        title={messages.place.filterMore}
        footer={<SheetFooter onCancel={() => setOpen(null)} onApply={applyDraft} />}
      >
        <FilterListHeading>{messages.place.filterPetAllowanceLabel}</FilterListHeading>
        <PetAllowanceField filters={draft} onChange={setDraft} />

        <div className="border-border border-t">
          <FilterListHeading>{messages.place.filterIndoorLabel}</FilterListHeading>
          <IndoorField filters={draft} onChange={setDraft} />
        </div>

        {/* 제목은 `PetSizeField` 가 그린다 — 반려견이 없으면 절 전체가 사라져야 한다 */}
        <PetSizeField
          filters={draft}
          onChange={setDraft}
          pet={pet}
          heading={messages.place.filterPetSizeLabel}
        />
      </BottomSheet>
    </div>
  )
}

/** 시트 하단 확정 줄 — 목록 칩 줄과 같은 규칙이다 ("적용" 을 쓰지 않는다) */
function SheetFooter({ onCancel, onApply }: { onCancel: () => void; onApply: () => void }) {
  return (
    <div className="flex gap-2">
      <Button variant="secondary" size="lg" className="flex-1" onClick={onCancel}>
        {messages.place.filterCancel}
      </Button>
      <Button variant="primary" size="lg" className="flex-2" onClick={onApply}>
        {messages.place.filterApply}
      </Button>
    </div>
  )
}
