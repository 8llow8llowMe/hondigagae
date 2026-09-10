import { Chip, ChipGroup } from '@/components/chip'
import { type facilityCounts, labelWithCount } from '@/features/emergency/facility-filters'
import { messages } from '@/lib/messages'
import { type Inset, INSET_CLASS } from '@/lib/ui/inset'
import { cn } from '@/lib/utils/cn'
import { FACILITY_TYPE_CODES, type FacilityFilters } from '@/types/emergency'

/** `facilityCounts` 의 결과 — 개수는 표면이 세서 넘긴다 (공통명세 E0) */
export type FacilityCounts = ReturnType<typeof facilityCounts>

/**
 * 목록 갈래의 필터 칩 — 아트보드 `혼디가개 긴급 시설` 01(모바일).
 *
 * **`EmergencySection` 에서 떼어냈다** (3층 표면, #460). 칩은 목록을 좁히는 **도구**이고
 * 카드는 그 결과를 담는다 — `/places`(#439) · `/plans`(#445) 와 같은 판정이라 카드 **밖**에
 * 서야 하는데, 섹션 안에 있으면 카드 안에 갇힌다. 그래서 칩과 목록이 다른 컴포넌트다.
 *
 * **로딩 중에도 칩은 실제로 서 있다.** 예전에는 스켈레톤이 칩 자리를 흉내 냈다 — 개수가
 * 응답 뒤에 오기 때문이다. 이제 칩 자체는 응답과 무관하게 그려지고 `showCounts` 가 false 라
 * 숫자만 빠진다(0 을 사실처럼 적지 않는다). 흉내 낼 자리가 없어졌다.
 *
 * **좌우 인셋은 담는 곳이 정한다** (`inset.ts`). 목록 갈래는 `SurfaceStack` 안 카드 밖이라
 * `card`(768 에서 24 + 20 = 44, 카드 제목 45 와 1px 차이 — #443 이 정한 의도) 이고,
 * 지도 SDK 폴백은 카드도 스택도 없는 페이지라 `main`(40) 이다. #457 이 다른 두 화면의 칩을
 * 같은 값으로 옮길 때 이 결정을 참고한다.
 *
 * **`lg:hidden` 은 호출부가 건다.** 폴백에는 레일이 없어 데스크톱에서도 칩이 남아야 한다 —
 * 카카오 키 도메인이 안 맞을 때 **항상** 오는 경로라 예외가 아니다 (공통명세 E0 · E5).
 *
 * **아래 선은 `divider` 로 컴포넌트가 소유한다** — `className` 은 배치 유틸리티만 받는다
 * (`component-guide.md` §3). 목록 갈래는 카드 위 간격(8/24)이 경계라 선이 없고, 폴백은 카드
 * 없는 페이지에 안내 줄과 이어 서므로 L0 위 스트립처럼 선을 긋는다.
 */
export function EmergencyFilterChips({
  filters,
  onFiltersChange,
  counts,
  showCounts,
  inset = 'card',
  divider = false,
  className,
}: {
  filters: FacilityFilters
  onFiltersChange: (next: FacilityFilters) => void
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
      <ChipGroup
        label={messages.emergency.typeGroupLabel}
        exclusive
        className="flex flex-wrap gap-1.5"
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

      {/* 백엔드 스키마가 화면에 알리라고 명시한 사실이다 */}
      {filters.open24Only && (
        <p className="text-caption text-fg-muted break-keep">{messages.emergency.open24Note}</p>
      )}
    </div>
  )
}
