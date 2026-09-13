'use client'

import { Chip, ChipGroup } from '@/components/chip'
import { EmergencyRadiusChip } from '@/features/emergency/emergency-radius-chip'
import { EmergencyTypeSegment } from '@/features/emergency/emergency-type-segment'
import { type facilityCounts, labelWithCount } from '@/features/emergency/facility-filters'
import { messages } from '@/lib/messages'
import { type Inset, INSET_CLASS } from '@/lib/ui/inset'
import { cn } from '@/lib/utils/cn'
import type { FacilityFilters } from '@/types/emergency'

/** `facilityCounts` 의 결과 — 개수는 표면이 세서 넘긴다 (공통명세 E0) */
export type FacilityCounts = ReturnType<typeof facilityCounts>

/**
 * 목록 갈래의 모바일 필터 — 아트보드 `혼디가개 긴급 시설` 01(모바일).
 *
 * **`EmergencySection` 에서 떼어냈다** (3층 표면, #460). 칩은 목록을 좁히는 **도구**이고
 * 카드는 그 결과를 담는다 — `/places`(#439) · `/plans`(#445) 와 같은 판정이라 카드 **밖**에
 * 서야 하는데, 섹션 안에 있으면 카드 안에 갇힌다. 그래서 이 묶음과 목록이 다른 컴포넌트다.
 *
 * ── 축을 둘로 갈랐다 (#537)
 *
 * 예전에는 **칩 다섯 개가 두 줄**이었다. 윗줄(전체·병원·약국)은 택일이고 아랫줄
 * (24시간·지금 진료중)은 다중인데 생김새가 같아, 성격이 정반대인 두 축이 한 덩어리로
 * 읽혔다. 지금은 택일 축이 꽉 찬 세그먼트(`EmergencyTypeSegment`), 다중 축이 칩 한 줄이다.
 *
 * **반경이 이 줄에 올라왔다.** 이전에는 모바일에서 반경을 바꾸려면 지도 갈래의 툴바로
 * 갔다 와야 했다 — 목록에는 0건 화면의 "더 넓게 찾기" 뿐이라, 결과가 있는데 부족한
 * 사용자는 넓힐 방법이 없었다. 데스크톱은 레일의 `RadiusField` 가 이미 그 구멍을 막고
 * 있었고(#535) 모바일만 남아 있었다.
 *
 * **반경 칩이 24시간·진료중과 한 줄인 것은 셋 다 "결과를 넓히거나 좁히는" 손잡이이기
 * 때문이지 셋이 같은 축이라서가 아니다.** 반경은 조회 파라미터라 `초기화` 가 건드리지
 * 않고(`EmergencyRadiusChip` 머리주석) 시트로 값을 고르며, 나머지 둘은 `ChipGroup` 안의
 * 토글이다 — 보조기기에는 그 구분이 role 로 그대로 나간다.
 *
 * **좌우 인셋은 담는 곳이 정한다** (`inset.ts`). 목록 갈래는 `SurfaceStack` 안 카드 밖이라
 * `card`(768 에서 24 + 20 = 44, 카드 제목 45 와 1px 차이 — #443 이 정한 의도) 이고,
 * 지도 SDK 폴백은 카드도 스택도 없는 페이지라 `main`(40) 이다.
 *
 * **`lg:hidden` 은 호출부가 건다.** 폴백에는 레일이 없어 데스크톱에서도 남아야 한다 —
 * 카카오 키 도메인이 안 맞을 때 **항상** 오는 경로라 예외가 아니다 (공통명세 E0 · E5).
 *
 * **아래 선은 `divider` 로 컴포넌트가 소유한다** — `className` 은 배치 유틸리티만 받는다
 * (`component-guide.md` §3). 목록 갈래는 카드 위 간격(8/24)이 경계라 선이 없고, 폴백은 카드
 * 없는 페이지에 안내 줄과 이어 서므로 L0 위 스트립처럼 선을 긋는다.
 */
export function EmergencyFilterChips({
  filters,
  onFiltersChange,
  radius,
  onRadiusChange,
  counts,
  showCounts,
  inset = 'card',
  divider = false,
  className,
}: {
  filters: FacilityFilters
  onFiltersChange: (next: FacilityFilters) => void
  radius: number
  onRadiusChange: (next: number) => void
  counts: FacilityCounts
  /** `countsAreComplete` 결과. false 면 칩에서 숫자를 뺀다 */
  showCounts: boolean
  inset?: Inset
  /** 아래 1px 선 — 카드 없는 페이지(지도 SDK 폴백)에서만 */
  divider?: boolean
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex flex-col gap-2 py-3',
        INSET_CLASS[inset],
        divider && 'border-border border-b',
        className,
      )}
    >
      <EmergencyTypeSegment
        filters={filters}
        onFiltersChange={onFiltersChange}
        counts={counts}
        showCounts={showCounts}
      />

      {/*
        다중 선택 축 한 줄. **`flex-wrap` 을 남겨 둔다** — 375 에서 셋이 한 줄에 들어가지만
        (실측 343px 중 반경 96 + 24시간 84 + 진료중 104 = 284), 개수가 세 자리로 붙으면
        마지막 칩이 넘친다. 가로 스크롤러로 만들지 않는 것은 축이 셋뿐이라 감출 것이
        없어서다 — 지도 툴바(`EmergencyFilterBar`)는 유형까지 한 줄이라 스크롤러를 쓴다.
      */}
      <div className="flex min-w-0 flex-wrap items-center gap-1.5">
        <EmergencyRadiusChip radius={radius} onRadiusChange={onRadiusChange} />

        <ChipGroup label={messages.emergency.narrowGroupLabel} className="flex flex-wrap gap-1.5">
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
      </div>

      {/* 백엔드 스키마가 화면에 알리라고 명시한 사실이다 */}
      {filters.open24Only && (
        <p className="text-caption text-fg-muted break-keep">{messages.emergency.open24Note}</p>
      )}
    </div>
  )
}
