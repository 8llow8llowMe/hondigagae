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
  /**
   * 칩이 **값을 고르는 것이 아니라 시트를 여는 트리거**일 때 준다 (아트보드 `01 목록 — 모바일`
   * 의 "유형" · "지역" · "더보기").
   *
   * 주면 `aria-expanded` 를 쓰고 토글/라디오 의미를 **버리며**, `selected` 는 tint 만 정한다.
   * 시트를 여는 버튼에 `aria-pressed` 를 붙이면 스크린리더가 "선택됨" 으로 읽어 값이 이미
   * 적용된 것처럼 들린다 — 여는 것과 고르는 것은 다른 일이다.
   */
  expanded?: boolean
  children: ReactNode
  className?: string
}

export function Chip({
  selected,
  onSelect,
  exclusive = false,
  expanded,
  children,
  className,
}: ChipProps) {
  const a11y =
    expanded !== undefined
      ? ({ 'aria-expanded': expanded, 'aria-haspopup': 'dialog' } as const)
      : exclusive
        ? ({ role: 'radio', 'aria-checked': selected } as const)
        : ({ 'aria-pressed': selected } as const)

  return (
    <button
      type="button"
      {...a11y}
      onClick={onSelect}
      className={cn(
        // 모바일 최소 터치 영역 44px (DESIGN.md §7)
        'text-body-2 inline-flex h-11 items-center gap-1.5 rounded-md border px-3 whitespace-nowrap transition-colors',
        'focus-visible:ring-brand-500 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none',
        // **테두리는 선택 여부와 무관하게 항상 있다** — 없으면 칩이 그냥 글자로 보여
        // 누를 수 있다는 것을 알 수 없다 (아트보드 `01 목록 — 모바일`: 미선택도 1px 테두리).
        // 선택은 tint + 진한 테두리 + weight 셋으로 말한다. 색 하나에 기대지 않는다.
        selected
          ? 'bg-band border-border-strong text-fg font-semibold'
          : 'bg-bg border-border text-fg-muted hover:bg-band font-medium',
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
