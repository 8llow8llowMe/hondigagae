'use client'

import { cn } from '@/lib/utils/cn'

/**
 * 전폭 균등 밑줄 탭 — 모바일의 **배타 축** 컨트롤 (디자인 가이드 §5 FilterControls).
 *
 * 가이드가 정한 형태 그대로다: 48px 높이, 전폭 균등 분할, 활성은 **2px `--fg` 밑줄 +
 * weight 600**. 배경색으로 활성을 표현하지 않는다.
 *
 * 데스크톱 레일에서는 이것 대신 라디오(`RadioGroup`)를 쓴다 — 세로 공간이 있다.
 *
 * **개수는 다른 축을 적용한 뒤 값이고, 0 을 감추거나 흐리게 하지 않는다.**
 * 클릭 가능한 필터는 `--fg-muted` 를 유지한다 (DESIGN.md §2-2).
 */
export type SegmentedTabOption<T extends string> = {
  value: T
  label: string
  /** 결과 수. 0 도 그대로 보여준다 */
  count?: number
}

export function SegmentedTabs<T extends string>({
  label,
  options,
  value,
  onValueChange,
  className,
}: {
  /** 축 이름. 스크린리더가 무엇을 고르는 축인지 알아야 한다 */
  label: string
  options: SegmentedTabOption<T>[]
  value: T
  onValueChange: (next: T) => void
  className?: string
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn('border-border flex w-full border-b', className)}
    >
      {options.map((option) => {
        const selected = option.value === value

        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onValueChange(option.value)}
            className={cn(
              'text-body-2 flex h-12 flex-1 items-center justify-center gap-1 border-b-2 transition-colors',
              'focus-visible:ring-brand-500 focus-visible:ring-2 focus-visible:-outline-offset-2 focus-visible:outline-none',
              selected
                ? 'border-fg text-fg font-semibold'
                : 'text-fg-muted border-transparent font-medium',
            )}
          >
            {option.label}
            {option.count !== undefined && <span className="tabular-nums">{option.count}</span>}
          </button>
        )
      })}
    </div>
  )
}
