'use client'

import type { ReactNode } from 'react'

import { CheckIcon } from '@/components/icons'
import { cn } from '@/lib/utils/cn'

/**
 * 세로 필터 목록 — 디자인 가이드 §5 FilterControls.
 *
 * **`Chip` 과 같은 축을 다루지만 형태가 다르다.** 칩은 가로로 흐르는 모바일 상시 필터고,
 * 이것은 세로 공간이 있는 곳(데스크톱 레일 · 바텀시트)의 형태다. 아트보드
 * `혼디가개 장소 찾기.dc.html` 03·02 절이 근거다.
 *
 * **축의 성격이 컨트롤 종류를 정한다.**
 * - 배타(하나만) → `FilterRadio` — 원형 표시기 + `role="radio"`
 * - 다중(여러 개) → `FilterCheck` — 사각 표시기 + `role="checkbox"`
 *
 * **같은 세로 목록을 `aria-pressed` 토글로 두지 않는다** — 배타 축도 다중 선택으로 읽힌다.
 * 가이드가 명시적으로 금지한 형태다.
 *
 * `RadioGroup`/`Checkbox`(`src/components/`)와 다른 컴포넌트다. 저쪽은 **폼 입력**이라
 * 테두리 박스 + 에러 슬롯 + `name` 배선을 갖는다. 필터는 폼이 아니라 조회 조건이고,
 * 제출도 검증도 없다 — 형태를 공유하면 둘 중 하나가 반드시 어색해진다
 * (docs/component-guide.md §7 의 `Field` 분리와 같은 판단이다).
 */
export function FilterList({
  label,
  exclusive = false,
  children,
  className,
}: {
  /** 축 이름. 없으면 스크린리더가 무엇을 고르는 축인지 말하지 못한다 */
  label: string
  /** 배타 축이면 true. 기본은 다중 축이다 */
  exclusive?: boolean
  children: ReactNode
  className?: string
}) {
  return (
    <div
      role={exclusive ? 'radiogroup' : 'group'}
      aria-label={label}
      className={cn('flex flex-col px-2', className)}
    >
      {children}
    </div>
  )
}

/** 축 제목. 12px `--fg-muted` — 옵션(16px)보다 작아 목록이 제목을 이긴다 */
export function FilterListHeading({ children }: { children: ReactNode }) {
  return <h3 className="text-caption text-fg-muted px-4 pt-4 pb-2 font-semibold">{children}</h3>
}

type OptionProps = {
  selected: boolean
  onSelect: () => void
  children: ReactNode
  /** 이 조건이 무엇을 하는지. 라벨만으로 부족할 때만 준다 */
  description?: string | undefined
  className?: string | undefined
}

/** 배타 축 한 줄 */
export function FilterRadio({ selected, onSelect, children, description, className }: OptionProps) {
  return (
    <OptionButton
      role="radio"
      selected={selected}
      onSelect={onSelect}
      description={description}
      className={className}
      indicator={
        <span
          aria-hidden
          className={cn(
            'flex size-5 shrink-0 items-center justify-center rounded-full',
            selected ? 'bg-brand-500' : 'border-border-strong bg-bg border',
          )}
        >
          {selected && <span className="bg-fg-inverse size-1.5 rounded-full" />}
        </span>
      }
    >
      {children}
    </OptionButton>
  )
}

/** 다중 축 한 줄 */
export function FilterCheck({ selected, onSelect, children, description, className }: OptionProps) {
  return (
    <OptionButton
      role="checkbox"
      selected={selected}
      onSelect={onSelect}
      description={description}
      className={className}
      indicator={
        <span
          aria-hidden
          className={cn(
            'flex size-5 shrink-0 items-center justify-center rounded-sm',
            selected ? 'bg-brand-500' : 'border-border-strong bg-bg border',
          )}
        >
          {selected && <CheckIcon size={14} strokeWidth={2} className="text-fg-inverse" />}
        </span>
      }
    >
      {children}
    </OptionButton>
  )
}

/**
 * 두 형태의 공통 몸통.
 *
 * **선택 상태를 배경색만으로 표현하지 않는다** — tint 와 함께 weight 를 올린다 (가이드 §5).
 * 색을 못 보는 사람에게도 선택이 보여야 한다.
 */
function OptionButton({
  role,
  selected,
  onSelect,
  indicator,
  children,
  description,
  className,
}: OptionProps & { role: 'radio' | 'checkbox'; indicator: ReactNode }) {
  return (
    <button
      type="button"
      role={role}
      aria-checked={selected}
      onClick={onSelect}
      className={cn(
        // 44px — 모바일 최소 터치 영역 (DESIGN.md §7)
        'flex min-h-11 items-center gap-2 rounded-md px-3 py-2 text-left transition-colors',
        'focus-visible:ring-brand-500 focus-visible:ring-2 focus-visible:-outline-offset-2 focus-visible:outline-none',
        selected ? 'bg-band' : 'hover:bg-band',
        className,
      )}
    >
      {indicator}
      <span className="min-w-0 flex-1">
        <span
          className={cn('text-body-1 text-fg block', selected ? 'font-semibold' : 'font-medium')}
        >
          {children}
        </span>
        {description !== undefined && (
          <span className="text-caption text-fg-muted mt-1 block">{description}</span>
        )}
      </span>
    </button>
  )
}
