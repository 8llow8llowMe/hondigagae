'use client'

import { useState } from 'react'

import { BottomSheet } from '@/components/bottom-sheet'
import { Button } from '@/components/button'
import { Chip, ChipGroup } from '@/components/chip'
import { FilterListHeading } from '@/components/filter-list'
import { CheckIcon, ChevronDownIcon, SlidersIcon } from '@/components/icons'
import { useSelectedPet } from '@/features/nav/use-selected-pet'
import { CONTENT_TYPE_LABEL, SIGUNGU_LABEL } from '@/features/place/filter-labels'
import {
  ContentTypeField,
  IndoorField,
  PetSizeField,
  RegionField,
} from '@/features/place/place-filter-fields'
import { usePlaceFilterNav } from '@/features/place/use-place-filter-nav'
import { messages } from '@/lib/messages'
import { DEFAULT_PLACE_FILTERS, toPlaceFilterQuery } from '@/lib/url/place-filters'
import type { PlaceFilters } from '@/types/place'

/** 열려 있는 시트. `null` 이면 닫힘 */
type OpenSheet = 'contentType' | 'region' | 'more'

/**
 * 모바일 필터 — 아트보드 `01 목록 — 모바일` + `02 필터 시트`.
 *
 * **상시 칩 3개 + 더보기**다. `SegmentedTabs`(밑줄 탭)를 쓰지 않는다 —
 * `docs/design-system-adoption.md` §6-2 가 그렇게 예상했지만 아트보드 6개 절 어디에도
 * 밑줄 탭이 없다. 밑줄 탭은 디자인 가이드 §5 의 일반 규칙이고 이 화면에는 적용되지 않았다.
 * **화면 정본은 아트보드다.**
 *
 * **칩은 즉시 반영, 시트는 적용 버튼으로 확정한다** (아트보드 02 절). 시트는 여러 축을 한 번에
 * 고르는 자리라 한 칸 누를 때마다 결과가 뒤에서 바뀌면 무엇을 고르는 중인지 알 수 없다.
 * 취소하면 원래 값으로 돌아간다.
 */
export function PlaceFilterChips({ filters }: { filters: PlaceFilters }) {
  const { apply, reset } = usePlaceFilterNav()
  const { pet } = useSelectedPet()

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

  const allowedOnly = filters.petAllowanceType === 'ALLOWED'
  const regionLabel =
    filters.sigunguCode === null
      ? messages.place.filterRegionLabel
      : (SIGUNGU_LABEL[filters.sigunguCode] ?? messages.place.filterRegionLabel)
  const contentTypeLabel =
    filters.contentType === null
      ? messages.place.filterContentTypeLabel
      : CONTENT_TYPE_LABEL[filters.contentType]
  // "더보기" 안의 두 축 중 하나라도 걸려 있으면 칩이 켜져 있어야 한다 — 접힌 곳에 걸린
  // 필터는 결과만 줄이고 이유는 보이지 않는다
  const moreActive = filters.indoor !== null || filters.petSizeType !== null

  const dirty = toPlaceFilterQuery(filters) !== toPlaceFilterQuery(DEFAULT_PLACE_FILTERS)

  return (
    <div className="border-border border-b px-4 py-3 md:px-10">
      <ChipGroup label={messages.place.filterTitle} className="flex flex-wrap gap-1.5">
        <Chip
          selected={allowedOnly}
          onSelect={() => apply({ ...filters, petAllowanceType: allowedOnly ? null : 'ALLOWED' })}
        >
          {allowedOnly && <CheckIcon size={16} strokeWidth={2} />}
          {messages.place.filterAllowedOnly}
        </Chip>

        <Chip
          selected={filters.contentType !== null}
          expanded={open === 'contentType'}
          onSelect={() => openSheet('contentType')}
        >
          {contentTypeLabel}
          <ChevronDownIcon size={16} />
        </Chip>

        <Chip
          selected={filters.sigunguCode !== null}
          expanded={open === 'region'}
          onSelect={() => openSheet('region')}
        >
          {regionLabel}
          <ChevronDownIcon size={16} />
        </Chip>

        <Chip selected={moreActive} expanded={open === 'more'} onSelect={() => openSheet('more')}>
          <SlidersIcon size={16} />
          {messages.place.filterMore}
        </Chip>

        {dirty && (
          <Chip selected={false} onSelect={reset}>
            {messages.place.resetFilters}
          </Chip>
        )}
      </ChipGroup>

      <BottomSheet
        open={open === 'contentType'}
        onClose={() => setOpen(null)}
        title={messages.place.filterContentTypeLabel}
        footer={<SheetFooter onCancel={() => setOpen(null)} onApply={applyDraft} />}
      >
        <ContentTypeField filters={draft} onChange={setDraft} />
      </BottomSheet>

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
        <FilterListHeading>{messages.place.filterIndoorLabel}</FilterListHeading>
        <IndoorField filters={draft} onChange={setDraft} />

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

/**
 * 시트 하단 확정 줄.
 *
 * 가이드 §5-2 는 주요 버튼에 결과 수를 쓰라고 한다("27곳 보기"). **건수를 쓸 수 없다** —
 * `SliceResponse` 가 총 건수를 주지 않는다. 숫자 없이도 결과를 가리키는 문구로 대신한다
 * ("이 조건으로 보기"). "적용" 은 쓰지 않는다 — 무엇이 적용되는지 말하지 않는다.
 */
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
