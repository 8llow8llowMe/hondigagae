'use client'

import { Chip, ChipGroup } from '@/components/chip'
import { ScrollRailArrows, useScrollRail } from '@/components/scroll-rail'
import { EmergencyRadiusChip } from '@/features/emergency/emergency-radius-chip'
import { facilityCounts, labelWithCount } from '@/features/emergency/facility-filters'
import { messages } from '@/lib/messages'
import { cn } from '@/lib/utils/cn'
import {
  DEFAULT_FACILITY_FILTERS,
  FACILITY_TYPE_CODES,
  type FacilityFilters,
  type NearbyFacilityItem,
} from '@/types/emergency'

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
 * **검색어만 예외다** (#584) — 호출부가 `narrowByKeyword` 로 **먼저 좁혀** 넘긴다. 검색어는
 * 축이 아니라 범위라, 칩을 눌러도 검색어는 유지된다: 검색 중에 칩이 반경 전량의 수를
 * 말하면 눌러서 실제로 나오는 개수와 어긋난다.
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
  /** **영역 안 · 검색어까지만 적용한** 배열 (머리주석) — 칩 축은 아직 걸지 않는다 */
  facilities: readonly NearbyFacilityItem[]
  filters: FacilityFilters
  onFiltersChange: (next: FacilityFilters) => void
  radius: number
  onRadiusChange: (next: number) => void
  /** `countsAreComplete` 결과. false 면 칩에서 숫자를 뺀다 */
  showCounts: boolean
  className?: string
}) {
  const counts = facilityCounts(facilities)
  const rail = useScrollRail<HTMLDivElement>()

  /*
    **반경은 `dirty` 에 넣지 않는다.** 필터가 아니라 조회 파라미터다 — "초기화" 가
    반경까지 되돌리면 넓혀 찾던 사용자가 조건 하나를 끄려다 결과를 통째로 잃는다.

    반경도 URL 에 실리지만(`?radius=40000`) 그 구분은 그대로다 — `EmergencyBoardParams`
    가 반경을 `filters` 밖에 두는 이유가 이것이다 (`lib/url/emergency-filters.ts`).
    칩과 시트 자체는 `EmergencyRadiusChip` 이 갖는다 (#537) — 목록 갈래의 모바일 필터에도
    같은 손잡이가 필요해져 떼어냈다.
  */
  const dirty =
    filters.type !== DEFAULT_FACILITY_FILTERS.type ||
    filters.open24Only !== DEFAULT_FACILITY_FILTERS.open24Only ||
    filters.openNowOnly !== DEFAULT_FACILITY_FILTERS.openNowOnly ||
    /*
      **지도 갈래에는 검색 입력이 없다** (#584 — `/places` 와 같은 판단). 그래서 목록에서
      좁혀 온 검색어를 푸는 손잡이가 이 `초기화` 하나뿐이고, `dirty` 가 검색어를 모르면
      그 하나마저 사라진다.
    */
    filters.keyword !== DEFAULT_FACILITY_FILTERS.keyword

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
        <EmergencyRadiusChip radius={radius} onRadiusChange={onRadiusChange} />

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
    </div>
  )
}
