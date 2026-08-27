import type { ReactNode } from 'react'

import { cn } from '@/lib/utils/cn'

/**
 * 오류 메시지 요소의 id 규칙.
 * `Field` 와 `Input` 이 같은 규칙을 써야 aria-describedby 가 실제로 연결된다.
 */
export function fieldErrorId(id: string): string {
  return `${id}-error`
}

export type FieldProps = {
  /** 입력 요소의 id 와 반드시 같아야 한다 */
  id: string
  label: string
  error?: string | undefined
  hint?: string | undefined
  required?: boolean
  children: ReactNode
  className?: string
}

/**
 * label + 입력 + 오류 메시지의 접근성 배선만 담당한다.
 *
 * `Input` 에 합치지 않는 이유: 같은 배선이 Select·Textarea·라디오에도 필요하다
 * — docs/component-guide.md §7.
 */
export function Field({
  id,
  label,
  error,
  hint,
  required = false,
  children,
  className,
}: FieldProps) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={id} className="text-body-2 text-fg font-medium">
        {label}
        {required && (
          <span aria-hidden="true" className="text-danger-500 ml-0.5">
            *
          </span>
        )}
      </label>
      {children}
      {hint !== undefined && error === undefined && (
        <p className="text-caption text-fg-muted">{hint}</p>
      )}
      {error !== undefined && (
        <p id={fieldErrorId(id)} className="text-caption text-danger-500">
          {error}
        </p>
      )}
    </div>
  )
}
