'use client'

import { useState } from 'react'

import { BottomSheet } from '@/components/bottom-sheet'
import { Button } from '@/components/button'
import { Chip, ChipGroup } from '@/components/chip'
import { ScrollRailArrows, useScrollRail } from '@/components/scroll-rail'
import { PetSwitcherSlot } from '@/features/nav/pet-switcher-slot'
import { useSelectedPet } from '@/features/nav/use-selected-pet'
import {
  PLACE_KIND_FILTER_ORDER,
  PLACE_KIND_LABEL,
  placeKindOf,
  withPlaceKind,
} from '@/features/place/filter-labels'
import { mapSheetFilterCount } from '@/features/place/map-filter-count'
import {
  PlaceMapFilterButton,
  PlaceMapFilterSheetFields,
} from '@/features/place/place-map-filter-sheet'
import { usePlaceFilterNav } from '@/features/place/use-place-filter-nav'
import { messages } from '@/lib/messages'
import { DEFAULT_PLACE_FILTERS, toPlaceFilterQuery } from '@/lib/url/place-filters'
import { cn } from '@/lib/utils/cn'
import type { PlaceFilters } from '@/types/place'

/**
 * 지도 보기의 필터 줄 — **한 줄 + 필터 시트** (#1314, 장소-지도필터-한줄-세부명세).
 *
 * ```text
 * [≡ 필터 n] │ [◉ 몽실이 ▾] [동반 가능만] [전체] [관광지] [음식점] … [초기화] →
 * └ 고정 ──────────────────┘ └ 가로 스크롤러 ─────────────────────────────┘
 * ```
 *
 * 도킹 패널(≥1024) · 모바일 시트 툴바(<1024) · 담기 지도가 **이 한 벌을 그대로** 쓴다 — 폭으로 갈라 두 모양을 두면
 * 1023 ↔ 1024 를 넘을 때 같은 조건이 다른 자리로 옮겨 가 다시 배운다 (D1-2).
 *
 * **지도 보기에는 필터 컨트롤이 아예 없었다.** 데스크톱 레일은 지도를 세 번 접어서 쓸 수 없고, 모바일 칩 줄은 목록에만
 * 붙어 있었다. 그래서 지도에서 조건을 좁히려면 목록으로 되돌아가야 했다. 그 자리의 제목("지도에 보이는 곳 20")은
 * 목록 위 캡션으로 내리고 이 자리는 사용자가 실제로 만질 것에 준다.
 *
 * **두 줄(44 + 6 + 44)이던 것을 한 줄로 줄였다** (#1314). 시트 `mid` 에서 목록이 한 행 남짓만 보였다. 줄이는 방법은
 * 카카오맵 · 네이버지도와 같다 — **자주 바꾸는 축은 줄에 펼치고, 조합해서 확정하는 축은 시트 하나로 접는다.**
 *
 * - **맨 앞 `필터` 버튼** — 지역 · 실내/야외 · 체구를 **한 시트**에서 고른다. 예전에는 `지역` · `더보기` 가 각자 시트라
 *   조건 둘을 바꾸려면 시트를 두 번 열었다. 숫자는 **접혀서 안 보이는** 축만 센다(`mapSheetFilterCount`)
 * - **`동반 가능만` 은 레일 안 첫 칩**이다 — 이 서비스의 존재 이유인 조건이라 시트에 접지 않는다. 목록 칩 줄이 같은
 *   토글을 둔다(`place-filter-chips.tsx`). 보이는 글자만 짧고(`동반 가능만`) 접근 이름은 `반려견 동반 가능만` 그대로
 * - **유형은 라디오다.** 백엔드 `contentType` 이 단일 `@RequestParam` 이라 여러 개를 보낼 수 없고, `전체` 칩이 해제다
 * - **`초기화` 는 스크롤러 끝**(dirty 일 때만, 즉시 · 전량 · 검색어 포함) — 목록 칩 줄 · 긴급 지도 줄과 한 규칙이다.
 *   시트 안에는 두지 않는다(D8-3)
 *
 * **칩은 전부 `sm`** — 모바일 시각 36 · 누르는 자리 46, 768 이상 44 (`DESIGN.md` §7 "지도 화면의 칩은 모바일 36").
 * `/emergency` 지도 줄과 같은 크기다.
 *
 * **레일 칩은 즉시, 시트는 확정**이다 (아트보드 02 규칙). 여러 축을 한 번에 고르는 자리라 누를 때마다 뒤에서 결과가
 * 바뀌면 무엇을 고르는 중인지 모른다. **바뀐 것이 없으면 URL 을 건드리지 않고 닫기만** 한다 — 같은 값을 다시
 * `replace` 하면 `?place=` 가 떨어져 옆 미리보기가 이유 없이 닫힌다.
 *
 * "더 있다" 신호(fade 마스크 + 원형 화살표)는 홈 · 긴급 · 목록 칩 줄과 같은 `ScrollRail` 이다.
 *
 * **`petSwitch` 를 켜면 `필터` 뒤에 반려견 칩이 선다** (#1301, 장소-반려견칩-세부명세). 판정 · 체구 필터가 쓰는
 * 반려견을 판정이 쓰이는 자리에서 바꾼다 — 지도 아일랜드는 띠 헤더(스위처)를 걷어서(#1300) 다른 바꿀 곳이 없다.
 */
export function PlaceMapFilterBar({
  filters,
  /** 미로그인이면 반려견 목록을 조회하지 않는다 — 크기 축 컨트롤 · 반려견 칩이 빠진다 (#200) */
  authed,
  /**
   * `필터` 뒤 반려견 칩. **기본 끔** — `PlaceMapView` 가 `island` 일 때만 켠다(`petSwitch={island}`). 칩이 필요한
   * 곳 = 띠 헤더 스위처가 걷힌 곳이라 같은 조건 하나로 묶으면 스위처와 칩이 한 화면에 둘 서지 않는다 (D1-2)
   */
  petSwitch = false,
  className,
}: {
  filters: PlaceFilters
  authed: boolean
  petSwitch?: boolean
  className?: string
}) {
  const { apply, reset } = usePlaceFilterNav()
  const { pet } = useSelectedPet(authed)
  const kind = placeKindOf(filters)

  const [sheetOpen, setSheetOpen] = useState(false)
  // 시트 초안. 열 때 현재 값을 복사하고 확정 전까지 URL 을 건드리지 않는다
  const [draft, setDraft] = useState<PlaceFilters>(filters)

  function openSheet() {
    setDraft(filters)
    setSheetOpen(true)
  }

  function applyDraft() {
    /*
      **바뀐 것이 없으면 닫기만 한다** (#1314 D1-2). 비교는 `dirty` 와 같은 직렬화(`toPlaceFilterQuery`)다 — URL 에
      실리는 모양이 같으면 같은 조건이다. 다시 `replace` 하면 `?place=` 가 떨어져 미리보기가 닫힌다.
    */
    if (toPlaceFilterQuery(draft) !== toPlaceFilterQuery(filters)) apply(draft)
    setSheetOpen(false)
  }

  const allowedOnly = filters.petAllowanceType === 'ALLOWED'
  const sheetCount = mapSheetFilterCount(filters)
  const dirty = toPlaceFilterQuery(filters) !== toPlaceFilterQuery(DEFAULT_PLACE_FILTERS)

  const rail = useScrollRail<HTMLDivElement>()

  // 미로그인에는 반려견 목록을 조회하지 않는다 — 칩도 없다 (D5)
  const showPetSwitch = petSwitch && authed

  return (
    <div className={cn('flex min-w-0 items-center gap-1.5', className)}>
      <PlaceMapFilterButton count={sheetCount} expanded={sheetOpen} onSelect={openSheet} />

      {/* `필터` 는 값을 고르는 칩이 아니라 시트를 여는 버튼이라 칩 줄과 갈라 보인다 (D1-2 구분선) */}
      <span aria-hidden className="bg-border h-5 w-px shrink-0" />

      {/*
        반려견 칩은 **스크롤러 밖 고정**이다 (#1301 D1-2 · #1314 D8-1) — `overflow-x-auto` 안이면 메뉴 팝오버가 세로까지
        잘리고, 칩이 레일과 함께 밀려 사라진다. 고정이라 메뉴 · `menuPlacement` 가 한 글자도 바뀌지 않는다.
      */}
      {showPetSwitch && <PetSwitcherSlot variant="chip" />}

      {/*
        `.scroll-rail`(globals.css)이 화살표를 앉히는 기준면이고 **스크롤러 자신이 flex 컨테이너**다 — 바깥 div 를
        스크롤러로 삼으면 넘치는 방향의 끝 여백이 사라져 마지막 칩이 잘린다 (`components/scroll-rail.tsx`).
        `EmergencyFilterBar` 와 같은 짜임이다: 스크롤러는 레이아웃일 뿐 이름을 갖지 않고, 유형 축은 안의 `radiogroup` 이다.
      */}
      <div className="scroll-rail min-w-0 flex-1">
        <div
          ref={rail.ref}
          onScroll={rail.onScroll}
          className={cn(
            // `py-1.5 -my-1.5`: 칩의 히트 띠가 `overflow-x-auto` 에 잘리지 않게 (#905 R3 · emergency-filter-bar 와 같다)
            '-my-1.5 flex min-w-0 scrollbar-none items-center gap-1.5 overflow-x-auto py-1.5',
            rail.fadeClassName,
          )}
        >
          {/*
            즉시 반영이다 — 시트가 아니라 토글이라 "적용" 이 없다. **선택 표시는 칩의 tint 하나다** (#393) — 옆 유형
            칩들과 같은 방법으로 말해야 한 묶음 안에서 다른 종류의 컨트롤처럼 보이지 않는다.
          */}
          <Chip
            size="sm"
            selected={allowedOnly}
            onSelect={() => apply({ ...filters, petAllowanceType: allowedOnly ? null : 'ALLOWED' })}
            className="shrink-0"
          >
            <span className="sr-only">{`${messages.place.filterAllowedOnlyPrefix} `}</span>
            {messages.place.filterAllowedOnlyShort}
          </Chip>

          <ChipGroup
            label={messages.place.filterContentTypeLabel}
            exclusive
            className="flex shrink-0 gap-1.5"
          >
            <Chip
              size="sm"
              exclusive
              selected={kind === null}
              onSelect={() => apply(withPlaceKind(filters, null))}
            >
              {messages.place.filterAll}
            </Chip>
            {/* 카페는 음식점 바로 뒤 한 선택지다 — 유형이 아니라 원천 분류다 (#1156) */}
            {PLACE_KIND_FILTER_ORDER.map((option) => (
              <Chip
                key={option}
                size="sm"
                exclusive
                selected={kind === option}
                onSelect={() => apply(withPlaceKind(filters, option))}
              >
                {PLACE_KIND_LABEL[option]}
              </Chip>
            ))}
          </ChipGroup>

          {dirty && (
            <Chip size="sm" selected={false} onSelect={reset} className="shrink-0">
              {messages.place.resetFilters}
            </Chip>
          )}
        </div>

        <ScrollRailArrows
          rail={rail}
          prevLabel={messages.place.filterTypePrev}
          nextLabel={messages.place.filterTypeNext}
        />
      </div>

      <BottomSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title={messages.place.filterTitle}
        footer={<SheetFooter onCancel={() => setSheetOpen(false)} onApply={applyDraft} />}
      >
        <PlaceMapFilterSheetFields filters={draft} onChange={setDraft} pet={pet} />
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
