'use client'

import { useState } from 'react'

import { BottomSheet } from '@/components/bottom-sheet'
import { Button } from '@/components/button'
import { Chip, ChipGroup } from '@/components/chip'
import { ChevronDownIcon } from '@/components/icons'
import { ScrollRailArrows, useScrollRail } from '@/components/scroll-rail'
import { facilityCounts, labelWithCount } from '@/features/emergency/facility-filters'
import { MAX_RADIUS_METERS } from '@/lib/api/emergency'
import { formatDistance } from '@/lib/format/distance'
import { messages } from '@/lib/messages'
import { cn } from '@/lib/utils/cn'
import {
  DEFAULT_FACILITY_FILTERS,
  FACILITY_TYPE_CODES,
  type FacilityFilters,
  type NearbyFacilityItem,
} from '@/types/emergency'

/**
 * 반경 선택지.
 *
 * **`widen()` 의 ×2 사다리와 상한을 그대로 따른다** (`emergency-view` 시절의 10 → 20 →
 * 40 → 50). 두 경로가 다른 값을 쓰면 0건 화면의 "반경 넓히기" 를 누른 뒤 칩이 목록에
 * 없는 값을 가리킨다.
 */
export const RADIUS_OPTIONS = [10_000, 20_000, 40_000, MAX_RADIUS_METERS] as const

/**
 * 지도 보기의 필터 줄 — 패널 머리와 시트 툴바가 같은 것을 쓴다.
 *
 * **`/places` 의 `PlaceMapFilterBar` 와 같은 자리·같은 문법이다.** 1행은 유형 축
 * 가로 스크롤러, 2행은 나머지 축이다.
 *
 * **개수는 호출부가 넘긴 배열에서 센다.** 지도 갈래는 **영역 안 · `applyFilters` 전**
 * 배열을 넘긴다 — 캡션이 "지도에 보이는 12곳" 인데 칩이 "병원 120" 이면 두 숫자가
 * 서로를 부정하고, 다른 조건이 이미 걸린 배열을 세면 칩이 화면 목록과 같은 수가 되어
 * 아무것도 알려주지 못한다 (`facilityCounts` 머리주석).
 *
 * **반경이 이 줄에 있는 이유:** 이 화면은 지도를 옮겨도 재조회하지 않으므로
 * (거리가 내 위치 기준으로 남아야 한다) 반경이 "더 넓게 찾기" 의 유일한 손잡이다.
 * 0건 화면에만 두면 지도에서는 닿을 수 없다.
 */
export function EmergencyFilterBar({
  facilities,
  filters,
  onFiltersChange,
  radius,
  onRadiusChange,
  showCounts,
  className,
}: {
  /** **영역 안 · 필터 적용 전** 배열 */
  facilities: NearbyFacilityItem[]
  filters: FacilityFilters
  onFiltersChange: (next: FacilityFilters) => void
  radius: number
  onRadiusChange: (next: number) => void
  /** `countsAreComplete` 결과. false 면 칩에서 숫자를 뺀다 */
  showCounts: boolean
  className?: string
}) {
  const [open, setOpen] = useState(false)
  // 시트 초안. 열 때 현재 값을 복사하고 적용 전까지 조회를 건드리지 않는다
  const [draft, setDraft] = useState(radius)

  const counts = facilityCounts(facilities)
  const rail = useScrollRail<HTMLDivElement>()

  /*
    **반경은 `dirty` 에 넣지 않는다.** 필터가 아니라 조회 파라미터다 — "초기화" 가
    반경까지 되돌리면 넓혀 찾던 사용자가 조건 하나를 끄려다 결과를 통째로 잃는다.
  */
  const dirty =
    filters.type !== DEFAULT_FACILITY_FILTERS.type ||
    filters.open24Only !== DEFAULT_FACILITY_FILTERS.open24Only ||
    filters.openNowOnly !== DEFAULT_FACILITY_FILTERS.openNowOnly

  return (
    <div className={cn('flex min-w-0 flex-col gap-1.5', className)}>
      {/* ── 1행: 유형 ─────────────────────────────────────────────────────
          `.scroll-rail`(globals.css)이 화살표를 앉히는 기준면이고 **묶음 자신이
          스크롤러**다. 바깥 div 를 스크롤러로 삼으면 마지막 칩이 잘린다 */}
      <div className="scroll-rail">
        <ChipGroup
          ref={rail.ref}
          onScroll={rail.onScroll}
          label={messages.emergency.typeGroupLabel}
          exclusive
          className={cn('flex scrollbar-none gap-1.5 overflow-x-auto', rail.fadeClassName)}
        >
          <Chip
            exclusive
            selected={filters.type === null}
            onSelect={() => onFiltersChange({ ...filters, type: null })}
          >
            {labelWithCount(messages.emergency.typeAll, counts.all, showCounts)}
          </Chip>
          {FACILITY_TYPE_CODES.map((code) => (
            <Chip
              key={code}
              exclusive
              selected={filters.type === code}
              onSelect={() => onFiltersChange({ ...filters, type: code })}
            >
              {labelWithCount(messages.emergency.typeByCode[code], counts.byType[code], showCounts)}
            </Chip>
          ))}
        </ChipGroup>

        <ScrollRailArrows
          rail={rail}
          prevLabel={messages.place.filterTypePrev}
          nextLabel={messages.place.filterTypeNext}
        />
      </div>

      {/* ── 2행: 반경 · 영업 조건 · 초기화 ──────────────────────────────── */}
      <div className="flex min-w-0 flex-wrap items-center gap-1.5">
        <Chip
          selected={radius !== RADIUS_OPTIONS[0]}
          expanded={open}
          onSelect={() => {
            setDraft(radius)
            setOpen(true)
          }}
          className="shrink-0"
        >
          {messages.emergency.radiusLabel.replace('{radius}', formatDistance(radius))}
          <ChevronDownIcon size={16} />
        </Chip>

        <ChipGroup label={messages.emergency.narrowGroupLabel} className="flex gap-1.5">
          <Chip
            selected={filters.open24Only}
            onSelect={() => onFiltersChange({ ...filters, open24Only: !filters.open24Only })}
          >
            {labelWithCount(messages.emergency.open24, counts.open24, showCounts)}
          </Chip>
          <Chip
            selected={filters.openNowOnly}
            onSelect={() => onFiltersChange({ ...filters, openNowOnly: !filters.openNowOnly })}
          >
            {labelWithCount(messages.emergency.openNow, counts.openNow, showCounts)}
          </Chip>
        </ChipGroup>

        {dirty && (
          <Chip
            selected={false}
            onSelect={() => onFiltersChange(DEFAULT_FACILITY_FILTERS)}
            className="shrink-0"
          >
            {messages.place.resetFilters}
          </Chip>
        )}
      </div>

      {/* 백엔드 스키마가 화면에 알리라고 명시한 사실이다 */}
      {filters.open24Only && (
        <p className="text-caption text-fg-muted break-keep">{messages.emergency.open24Note}</p>
      )}

      <BottomSheet
        open={open}
        onClose={() => setOpen(false)}
        title={messages.emergency.radiusSheetTitle}
        footer={
          <div className="flex gap-2">
            <Button variant="secondary" size="lg" className="flex-1" onClick={() => setOpen(false)}>
              {messages.place.filterCancel}
            </Button>
            <Button
              variant="primary"
              size="lg"
              className="flex-2"
              onClick={() => {
                onRadiusChange(draft)
                setOpen(false)
              }}
            >
              {messages.place.filterApply}
            </Button>
          </div>
        }
      >
        <ChipGroup
          label={messages.emergency.radiusGroupLabel}
          exclusive
          className="flex flex-wrap gap-1.5 px-4 py-3"
        >
          {RADIUS_OPTIONS.map((option) => (
            <Chip
              key={option}
              exclusive
              selected={draft === option}
              onSelect={() => setDraft(option)}
            >
              {formatDistance(option)}
            </Chip>
          ))}
        </ChipGroup>
      </BottomSheet>
    </div>
  )
}
