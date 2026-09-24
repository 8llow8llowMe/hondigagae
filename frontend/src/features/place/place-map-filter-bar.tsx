'use client'

import { useState } from 'react'

import { BottomSheet } from '@/components/bottom-sheet'
import { Button } from '@/components/button'
import { Chip, ChipGroup } from '@/components/chip'
import { FilterListHeading } from '@/components/filter-list'
import { ChevronDownIcon, SlidersIcon } from '@/components/icons'
import { ScrollRailArrows, useScrollRail } from '@/components/scroll-rail'
import { useSelectedPet } from '@/features/nav/use-selected-pet'
import {
  CONTENT_TYPE_FILTER_ORDER,
  CONTENT_TYPE_LABEL,
  SIGUNGU_LABEL,
} from '@/features/place/filter-labels'
import { IndoorField, PetSizeField, RegionField } from '@/features/place/place-filter-fields'
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
 * 자주 바꾸는 축이다. 지역(3갈래)·실내·크기는 값을 고르기보다 조합해서 확정하는
 * 축이라 시트로 남긴다 — 가로줄에 다 펼치면 스크롤이 길어져 유형이 묻힌다.
 *
 * **두 줄이다.** 한 줄에 유형·지역·더보기를 다 두면 400 폭에서 유형이 세 개만 보이고,
 * 뒤쪽 유형(쇼핑·여행코스)에 **닿을 방법이 없었다** — 트랙패드 가로 스크롤을 아는
 * 사용자에게만 열린 기능이었다. 1행은 유형 전용 스크롤러 + 원형 화살표,
 * 2행은 **동반 가능만 · 지역 · 더보기**다.
 *
 * **동반 축은 2행 맨 왼쪽 토글이다.** 시트 안에 있던 동안에는 이 서비스의 존재 이유인
 * 조건이 두 단계 뒤에 접혀 있었다 — 반려견과 갈 수 있는 곳을 찾으러 온 화면이다.
 * `ALLOWED` 한 갈래만 쓰는 축이라 시트를 열 이유가 없고, 목록 칩 줄이 이미 같은 자리에
 * 같은 토글을 둔다 (`place-filter-chips.tsx`) — 두 보기에서 같게 생겨야 한 번만 배운다.
 *
 * "더 있다" 신호(fade 마스크 + 원형 화살표)는 **홈의 가로 줄과 같은 `ScrollRail` 을 쓴다.**
 * 같은 사실을 말하는 컨트롤이 화면마다 다르게 생기면 사용자가 두 번 배운다.
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

  const allowedOnly = filters.petAllowanceType === 'ALLOWED'

  /*
    시트 안의 두 축 중 하나라도 걸려 있으면 트리거가 켜져 있어야 한다 — 접힌 곳에 걸린
    필터는 결과만 줄이고 이유는 보이지 않는다. **동반 축은 이제 여기서 빠진다**:
    2행 토글로 나왔으므로 시트에 함께 두면 같은 필터를 두 곳에서 만지게 된다.
  */
  const moreActive = filters.indoor !== null || filters.petSizeType !== null

  const dirty = toPlaceFilterQuery(filters) !== toPlaceFilterQuery(DEFAULT_PLACE_FILTERS)

  const rail = useScrollRail<HTMLDivElement>()

  return (
    <div className={cn('flex min-w-0 flex-col gap-1.5', className)}>
      {/*
        ── 1행: 유형 ───────────────────────────────────────────────────────

        `.scroll-rail`(globals.css)이 화살표를 앉히는 기준면이고, **묶음 자신이
        스크롤러**다. 바깥 div 를 스크롤러로 삼으면 넘치는 방향의 끝 여백이 사라져
        마지막 칩이 잘린다 (`components/scroll-rail.tsx` 머리주석).
      */}
      <div className="scroll-rail">
        <ChipGroup
          ref={rail.ref}
          onScroll={rail.onScroll}
          label={messages.place.filterContentTypeLabel}
          exclusive
          // `py-1.5 -my-1.5`: 칩의 히트 띠가 `overflow-x-auto` 에 잘리지 않게 (#905 R3 · emergency-filter-bar 와 같다)
          className={cn(
            '-my-1.5 flex scrollbar-none gap-1.5 overflow-x-auto py-1.5',
            rail.fadeClassName,
          )}
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

        <ScrollRailArrows
          rail={rail}
          prevLabel={messages.place.filterTypePrev}
          nextLabel={messages.place.filterTypeNext}
        />
      </div>

      {/* ── 2행: 동반 가능만 · 지역 · 더보기 ──────────────────────────────── */}
      <div className="flex min-w-0 items-center gap-1.5">
        {/*
          즉시 반영이다 — 시트가 아니라 토글이라 "적용" 이 없다 (아트보드 02 절의 규칙).

          **선택 표시는 칩의 tint 하나다** (#393). 예전에는 여기에만 체크 아이콘을 덧댔는데,
          바로 윗줄의 유형 칩들이 같은 `Chip` 으로 tint 만 바꾸고 있어 **한 필터 묶음 안에서
          선택을 말하는 방법이 두 가지**가 됐다. 아이콘이 붙은 칩만 다른 종류의 컨트롤처럼
          보인다. `Chip` 은 tint 와 함께 weight 도 올리므로 색 하나에만 기대지 않는다.
        */}
        <Chip
          selected={allowedOnly}
          onSelect={() => apply({ ...filters, petAllowanceType: allowedOnly ? null : 'ALLOWED' })}
          className="shrink-0"
        >
          {messages.place.filterAllowedOnly}
        </Chip>

        <Chip
          selected={filters.sigunguCode !== null}
          expanded={open === 'region'}
          onSelect={() => openSheet('region')}
          className="shrink-0"
        >
          {regionLabel}
          <ChevronDownIcon size={16} />
        </Chip>

        {/* 자기 줄을 가졌으니 글자를 되살린다 — 한 줄이던 때는 폭이 없어 아이콘만 뒀다 */}
        <Chip
          selected={moreActive}
          expanded={open === 'more'}
          onSelect={() => openSheet('more')}
          className="shrink-0"
        >
          <SlidersIcon size={16} />
          {messages.place.filterMore}
        </Chip>

        {dirty && (
          <Chip selected={false} onSelect={reset} className="shrink-0">
            {messages.place.resetFilters}
          </Chip>
        )}
      </div>

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
        {/* 동반 축은 2행 토글로 나갔다 — 시트의 첫 절이 실내다. 위에 구분선을 두지 않는다 */}
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
