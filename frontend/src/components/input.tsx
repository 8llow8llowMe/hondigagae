import type { InputHTMLAttributes, Ref } from 'react'

import { fieldErrorId } from '@/components/field'
import { cn } from '@/lib/utils/cn'

type NativeProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  // 아래 각 필드를 InputProps 가 자체적으로 재정의하거나(className/value/onChange)
  // Input 이 내부에서 계산해 배선하므로(aria-invalid/aria-describedby) native 타입을 감춘다.
  // defaultValue / defaultChecked: controlled 전용 계약이 깨진다 — value 와
  // 함께 있으면 React 가 "controlled/uncontrolled 혼용" 경고를 낸다
  // (component-guide.md §5).
  | 'className'
  | 'value'
  | 'onChange'
  | 'aria-invalid'
  | 'aria-describedby'
  | 'defaultValue'
  | 'defaultChecked'
>

export type InputProps = NativeProps & {
  id: string
  /** controlled 전용이다. uncontrolled 모드를 지원하지 않는다 — component-guide.md §5 */
  value: string
  onValueChange: (value: string) => void
  invalid?: boolean
  /** 레이아웃 유틸리티만 허용한다 */
  className?: string
  ref?: Ref<HTMLInputElement>
}

export function Input({
  id,
  value,
  onValueChange,
  invalid = false,
  className,
  ...rest
}: InputProps) {
  return (
    <input
      id={id}
      value={value}
      onChange={(event) => onValueChange(event.target.value)}
      aria-invalid={invalid ? true : undefined}
      aria-describedby={invalid ? fieldErrorId(id) : undefined}
      className={cn(
        // 44px — 모바일 최소 터치 영역 (DESIGN.md §7)
        'text-body-1 h-11 w-full rounded-md border px-3',
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
