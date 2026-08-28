'use client'

import type { ReactNode, Ref } from 'react'

import { cn } from '@/lib/utils/cn'

/**
 * 필터 칩 — 디자인 가이드 §5 FilterControls.
 *
 * **축의 성격이 컨트롤 종류를 정한다.**
 * - 배타(하나만) → `exclusive` — `role="radio"` + `aria-checked`
 * - 다중(여러 개) → 기본 — `aria-pressed` 토글
 *
 * **배타 축을 `aria-pressed` 토글로 두지 않는다.** 같은 세로/가로 목록이 다중 선택으로
 * 읽힌다. 이것이 가이드가 명시적으로 금지한 형태다.
 *
 * radius 는 8(`rounded-md`)이다. **원형이 아니다** — 원형은 사진·아바타 전용이고
 * (DESIGN.md §5), 아트보드의 필터 컨트롤도 전부 8이다.
 * 선택 상태는 `--band` 배경 + `--fg` 텍스트로, **배경색만이 아니라** weight 도 함께 올린다.
 */
export type ChipProps = {
  selected: boolean
  onSelect: () => void
  /** 배타 축이면 true. 기본은 다중 축이다 */
  exclusive?: boolean
  children: ReactNode
  className?: string
}

export function Chip({ selected, onSelect, exclusive = false, children, className }: ChipProps) {
  const a11y = exclusive
    ? ({ role: 'radio', 'aria-checked': selected } as const)
    : ({ 'aria-pressed': selected } as const)

  return (
    <button
      type="button"
      {...a11y}
      onClick={onSelect}
      className={cn(
        // 모바일 최소 터치 영역 44px (DESIGN.md §7)
        'text-body-2 inline-flex h-11 items-center rounded-md px-3 whitespace-nowrap transition-colors',
        'focus-visible:ring-brand-500 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none',
        selected ? 'bg-band text-fg font-semibold' : 'text-fg-muted hover:bg-band',
        className,
      )}
    >
      {children}
    </button>
  )
}

/**
 * 칩 묶음. 배타 축은 `radiogroup`, 다중 축은 `group` 으로 나간다.
 *
 * **`aria-label` 이 필수다.** 축 이름이 없으면 스크린리더가 "라디오 그룹" 만 읽고
 * 무엇을 고르는 축인지 말하지 못한다.
 */
export function ChipGroup({
  label,
  exclusive = false,
  children,
  className,
  ref,
}: {
  label: string
  exclusive?: boolean
  children: ReactNode
  className?: string
  /** 가로 스크롤 컨테이너를 사용처가 제어할 때 쓴다 (선택 칩 센터링) */
  ref?: Ref<HTMLDivElement>
}) {
  return (
    <div
      ref={ref}
      role={exclusive ? 'radiogroup' : 'group'}
      aria-label={label}
      className={className}
    >
      {children}
    </div>
  )
}
