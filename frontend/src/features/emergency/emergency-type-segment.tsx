'use client'

import { labelWithCount } from '@/features/emergency/facility-filters'
import { messages } from '@/lib/messages'
import { handleRadioGroupKeyDown, radioTabIndex } from '@/lib/ui/radio-group-keys'
import { cn } from '@/lib/utils/cn'
import { FACILITY_TYPE_CODES, type FacilityFilters, type FacilityTypeCode } from '@/types/emergency'

/**
 * 시설 유형 택일 축 — **꽉 찬 세그먼트 컨트롤** (#537).
 *
 * **칩이 아니라 세그먼트인 이유.** 예전에는 모바일 필터가 칩 다섯 개를 두 줄로 깔았는데,
 * 윗줄(전체·병원·약국)은 **택일**이고 아랫줄(24시간·지금 진료중)은 **다중**이라 성격이
 * 정반대인데 생김새가 똑같았다. 칩은 "켜고 끄는 것" 으로 먼저 읽히므로 택일 축이 칩으로
 * 서면 사용자는 병원과 약국을 함께 켤 수 있다고 기대한다. 축의 성격이 컨트롤 종류를
 * 정한다 — `components/chip.tsx` 머리주석이 같은 규칙을 배타/다중으로 적어 둔 자리다.
 *
 * **전폭이라 세 칸이 균등하다.** 폭이 라벨 길이를 따라가면 `전체`(2자)와 `동물병원` 이
 * 다른 크기가 되어 눈이 먼저 큰 칸으로 간다 — 택일 축에서 특정 값이 시각적으로 우대되면
 * 안 된다. 개수가 붙어 라벨이 길어져도 칸은 그대로다.
 *
 * **`ViewToggle` 의 문법을 그대로 쓴다** — `overflow-hidden` 테두리 한 겹 + 칸 사이
 * `border-l`. 다만 선택 표시는 `Chip` 쪽 토큰(`bg-band`)이다. `ViewToggle` 의 반전
 * (`bg-fg text-bg`)을 가져오면 필터 한 축이 화면에서 가장 검은 덩어리가 되어, 정작 급할 때
 * 봐야 할 목록보다 먼저 눈에 들어온다.
 *
 * **`role="radiogroup"` + `aria-checked` 다.** `ChipGroup`/`Chip` 의 배타 축과 같은 계약이라
 * 보조기기에서는 칩이었을 때와 같게 들린다 — 바뀐 것은 생김새뿐이다.
 */
export function EmergencyTypeSegment({
  filters,
  onFiltersChange,
  counts,
  showCounts,
}: {
  filters: FacilityFilters
  onFiltersChange: (next: FacilityFilters) => void
  counts: { all: number; byType: Record<string, number> }
  /** `countsAreComplete` 결과. false 면 라벨에서 숫자를 뺀다 */
  showCounts: boolean
}) {
  return (
    <div
      role="radiogroup"
      aria-label={messages.emergency.typeGroupLabel}
      className="border-border bg-bg flex w-full overflow-hidden rounded-md border"
    >
      <Option
        selected={filters.type === null}
        onSelect={() => onFiltersChange({ ...filters, type: null })}
      >
        {labelWithCount(messages.emergency.typeAll, counts.all, showCounts)}
      </Option>
      {FACILITY_TYPE_CODES.map((code: FacilityTypeCode) => (
        <Option
          key={code}
          divider
          selected={filters.type === code}
          onSelect={() => onFiltersChange({ ...filters, type: code })}
        >
          {labelWithCount(
            messages.emergency.typeByCode[code],
            counts.byType[code] ?? 0,
            showCounts,
          )}
        </Option>
      ))}
    </div>
  )
}

function Option({
  selected,
  onSelect,
  divider = false,
  children,
}: {
  selected: boolean
  onSelect: () => void
  divider?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      tabIndex={radioTabIndex(selected)}
      onKeyDown={handleRadioGroupKeyDown}
      onClick={onSelect}
      className={cn(
        // 높이 44 — **급할 때 누르는 컨트롤이라** 크게 잡는다 (§7 하한이 아니라 그 사실이 근거다 · #883)
        // 모바일 36 · 768 이상 44 — `Chip` 의 `size="sm"` 과 같은 축이다 (#891).
        // 이 화면은 375 에서 컨트롤 줄이 다섯 쌓여 첫 시설 행이 y=561(뷰포트의 69%)이었다
        'text-body-2 flex h-9 min-w-0 flex-1 items-center justify-center px-2 transition-colors md:h-11',
        // 테두리가 바깥 한 겹이라 offset 을 주면 [테두리·흰틈·링] 세 겹이 된다 (DESIGN.md 포커스 링 표)
        'focus-visible:ring-brand-500 focus-visible:ring-1 focus-visible:-outline-offset-2 focus-visible:outline-none',
        divider && 'border-border border-l',
        selected ? 'bg-band text-fg font-semibold' : 'text-fg-muted hover:bg-band font-medium',
      )}
    >
      {/* 개수가 붙어 좁은 칸을 넘으면 줄바꿈이 아니라 말줄임이다 — 칸 높이가 44 로 고정이다 */}
      <span className="truncate">{children}</span>
    </button>
  )
}
