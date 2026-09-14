'use client'

import { useState } from 'react'

import { BottomSheet } from '@/components/bottom-sheet'
import { Button } from '@/components/button'
import { Chip, ChipGroup } from '@/components/chip'
import { FilterListHeading } from '@/components/filter-list'
import { CheckIcon, ChevronDownIcon, SlidersIcon } from '@/components/icons'
import { ScrollRailArrows, useScrollRail } from '@/components/scroll-rail'
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
import { INSET_BLEED_CLASS, INSET_CLASS } from '@/lib/ui/inset'
import { DEFAULT_PLACE_FILTERS, toPlaceFilterQuery } from '@/lib/url/place-filters'
import { cn } from '@/lib/utils/cn'
import type { PlaceFilters } from '@/types/place'

/** 열려 있는 시트. `null` 이면 닫힘 */
type OpenSheet = 'contentType' | 'region' | 'more'

/**
 * 모바일 필터 — 아트보드 `01 목록 — 모바일` + `02 필터 시트`.
 *
 * **상시 칩 3개 + 더보기**다. 밑줄 탭을 쓰지 않는다 —
 * `docs/design-system-adoption.md` §6-2 가 그렇게 예상했지만 아트보드 6개 절 어디에도
 * 밑줄 탭이 없다. 밑줄 탭은 디자인 가이드 §5 의 일반 규칙이고 이 화면에는 적용되지 않았다.
 * **화면 정본은 아트보드다.**
 *
 * **칩은 즉시 반영, 시트는 적용 버튼으로 확정한다** (아트보드 02 절). 시트는 여러 축을 한 번에
 * 고르는 자리라 한 칸 누를 때마다 결과가 뒤에서 바뀌면 무엇을 고르는 중인지 알 수 없다.
 * 취소하면 원래 값으로 돌아간다.
 */
export function PlaceFilterChips({
  filters,
  /** 미로그인이면 반려견 목록을 조회하지 않는다 — 크기 축 컨트롤이 빠진다 (#200) */
  authed,
  divider = false,
  className,
}: {
  filters: PlaceFilters
  authed: boolean
  /**
   * 아래 구분선. **기본은 없다** (#556) — 이제 두 사용처가 모두 카드 머리 안이고
   * (`Surface fill`), 머리 자신이 아래 선을 그으므로 여기서 또 그으면 2px 로 겹친다.
   * `EmergencyFilterChips` 가 먼저 같은 이유로 갖고 있던 prop 이고 기본값도 같다.
   */
  divider?: boolean
  /** 레이아웃 유틸리티만 — 폭에 따라 숨기는 `lg:hidden` 이 이것으로 온다 */
  className?: string
}) {
  const { apply, reset } = usePlaceFilterNav()
  const { pet } = useSelectedPet(authed)

  const rail = useScrollRail<HTMLDivElement>()

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
    <>
      {/*
        **인셋은 카드 축(`card`, 16/20)이다** (#457). 예전에는 `md:px-10` 을 직접 적어
        768 에서 스택 인셋 24 위에 40 이 얹혀 글줄이 64 에 섰다 — 바로 아래 카드 제목
        (24+1+20 = 45)과 19px 갈렸다. 칩은 카드 밖 도구지만(#439) **L0 위에 놓이는 블록도
        카드 안 글줄과 같은 축**이어야 한다 (`lib/ui/inset.ts` 의 `card` 주석, #451).

        카드 테두리 1px 만큼(44 vs 45) 남는 차이는 #443 · #447 과 같은 의도다.

        **`border-b` 는 `divider` 로 갈렸다** (#556). L0 위 스트립이던 동안에는 아래 카드와
        자기를 가르는 줄이 필요했는데, 이제 두 사용처가 모두 카드 **머리 안**이라 머리가
        그 줄을 긋는다. 선은 padding 밖이라 켜면 전폭 그대로다.

        ── 줄바꿈이 아니라 가로 스크롤이다 (#531)

        칩이 넷~다섯(초기화 포함)이라 375 에서 **두 줄로 접혔고**, 그 두 줄이 화면 첫
        화면을 통째로 먹었다. 지도 갈래의 같은 축(`PlaceMapFilterBar`)은 이미 가로
        스크롤러라 두 갈래가 다른 문법을 쓰고 있었다.

        **`ChipGroup` 자신이 스크롤러다** — 바깥 div 를 스크롤러로 삼으면 넘치는 방향의
        `padding-right` 가 무시돼 마지막 칩이 여백 없이 잘린다 (`scroll-rail.tsx` 머리주석).
        그래서 인셋은 `INSET_BLEED_CLASS.card` 로 바깥 padding 을 상쇄하고 같은 값을 안쪽에
        되돌린다 — 칩은 화면 끝까지 이어져 스크롤되되 첫 칩은 16 에 선다.
      */}
      <div
        className={cn(
          'scroll-rail py-3',
          divider && 'border-border border-b',
          INSET_CLASS.card,
          className,
        )}
      >
        <ChipGroup
          ref={rail.ref}
          onScroll={rail.onScroll}
          label={messages.place.filterTitle}
          className={cn(
            'flex scrollbar-none gap-1.5 overflow-x-auto',
            INSET_BLEED_CLASS.card,
            rail.fadeClassName,
          )}
        >
          {/* 스크롤러 안에서는 칩이 줄어들면 안 된다 — `shrink-0` 이 없으면 flex 가
              칩을 쥐어짜 글자가 잘리고, 넘치지 않으니 스크롤도 생기지 않는다 */}
          <Chip
            className="shrink-0"
            selected={allowedOnly}
            onSelect={() => apply({ ...filters, petAllowanceType: allowedOnly ? null : 'ALLOWED' })}
          >
            {allowedOnly && <CheckIcon size={16} strokeWidth={2} />}
            {messages.place.filterAllowedOnly}
          </Chip>

          <Chip
            className="shrink-0"
            selected={filters.contentType !== null}
            expanded={open === 'contentType'}
            onSelect={() => openSheet('contentType')}
          >
            {contentTypeLabel}
            <ChevronDownIcon size={16} />
          </Chip>

          <Chip
            className="shrink-0"
            selected={filters.sigunguCode !== null}
            expanded={open === 'region'}
            onSelect={() => openSheet('region')}
          >
            {regionLabel}
            <ChevronDownIcon size={16} />
          </Chip>

          <Chip
            className="shrink-0"
            selected={moreActive}
            expanded={open === 'more'}
            onSelect={() => openSheet('more')}
          >
            <SlidersIcon size={16} />
            {messages.place.filterMore}
          </Chip>

          {dirty && (
            <Chip className="shrink-0" selected={false} onSelect={reset}>
              {messages.place.resetFilters}
            </Chip>
          )}
        </ChipGroup>

        <ScrollRailArrows
          rail={rail}
          prevLabel={messages.place.filterTypePrev}
          nextLabel={messages.place.filterTypeNext}
        />
      </div>

      {/*
        **시트는 `.scroll-rail` 밖이다.** 그 클래스는 `position: relative` 만이 아니라
        `contain: layout` 을 함께 걸고(`app/globals.css`), **`contain: layout` 은
        `position: fixed` 자손의 containing block 이 된다** — 안에 두면 전면을 덮어야 할
        시트가 칩 한 줄 크기로 갇힌다.
      */}
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
    </>
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
