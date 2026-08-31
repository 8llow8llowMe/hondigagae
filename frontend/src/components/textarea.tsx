import type { Ref, TextareaHTMLAttributes } from 'react'

import { fieldErrorId } from '@/components/field'
import { cn } from '@/lib/utils/cn'

type NativeProps = Omit<
  TextareaHTMLAttributes<HTMLTextAreaElement>,
  // `Input` 과 같은 이유로 감춘다 — component-guide.md §5
  'className' | 'value' | 'onChange' | 'aria-invalid' | 'aria-describedby' | 'defaultValue'
>

export type TextareaProps = NativeProps & {
  id: string
  /** controlled 전용이다. uncontrolled 모드를 지원하지 않는다 — component-guide.md §5 */
  value: string
  onValueChange: (value: string) => void
  invalid?: boolean
  /** 레이아웃 유틸리티만 허용한다 */
  className?: string
  ref?: Ref<HTMLTextAreaElement>
}

/**
 * 여러 줄 입력.
 *
 * **`Input` 을 재사용할 수 없어 따로 둔다.** `<input>` 과 `<textarea>` 는 다른 요소고
 * native prop 집합도 다르다(`rows`). 대신 **접근성 배선은 같은 규칙을 공유한다** —
 * `aria-invalid` 와 `fieldErrorId()` 기반 `aria-describedby` 를 화면마다 다시 만들면
 * 한 곳이 빠져도 아무도 모른다 (component-guide.md §7).
 *
 * 높이만 `Input` 과 다르다. `h-11`(44px) 대신 `rows` 로 정하고 `min-h` 로 하한만 맞춘다.
 */
export function Textarea({
  id,
  value,
  onValueChange,
  invalid = false,
  rows = 3,
  className,
  ...rest
}: TextareaProps) {
  return (
    <textarea
      id={id}
      value={value}
      rows={rows}
      onChange={(event) => onValueChange(event.target.value)}
      aria-invalid={invalid ? true : undefined}
      aria-describedby={invalid ? fieldErrorId(id) : undefined}
      className={cn(
        'text-body-1 min-h-11 w-full rounded-md border px-3 py-2',
        'placeholder:text-fg-subtle',
        'focus-visible:ring-brand-500 focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:outline-none',
        'disabled:cursor-not-allowed disabled:opacity-50',
        invalid ? 'border-danger-500' : 'border-border-strong',
        className,
      )}
      {...rest}
    />
  )
}
