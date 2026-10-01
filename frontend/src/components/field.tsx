import type { ReactNode } from 'react'

import { FieldDescribedByProvider } from '@/components/field-context'
import { cn } from '@/lib/utils/cn'

/**
 * 오류 메시지 요소의 id 규칙.
 * `Field` 와 `Input` 이 같은 규칙을 써야 aria-describedby 가 실제로 연결된다.
 */
export function fieldErrorId(id: string): string {
  return `${id}-error`
}

/**
 * 안내(hint) 요소의 id 규칙 (#1100). `fieldErrorId` 와 같은 자리 · 같은 꼴로 둔다 — 규칙이
 * 두 곳에 있으면 한쪽만 바뀌어 `aria-describedby` 가 빈 곳을 가리킨다.
 */
export function fieldHintId(id: string): string {
  return `${id}-hint`
}

/**
 * `Field` 가 무엇을 그리고 입력란이 무엇을 가리킬지 — **한 판정에서 둘 다 나온다** (#1100).
 *
 * - 오류가 있으면 **오류가 hint 자리를 대신한다** (#1080). 감춰진 hint 를 가리키지 않으므로
 *   오류 id 하나만 잇는다 — 둘 다 이으면 화면에 없는 안내까지 겹쳐 읽힌다
 * - hint 만 있으면 hint id
 * - 둘 다 없으면 `undefined` — 없는 id 를 가리키는 `aria-describedby` 를 걸지 않는다
 *
 * 그리는 조건과 가리키는 조건을 따로 쓰면 언젠가 어긋난다. `Field` 의 렌더가 이 결과의
 * `hintShown` · `errorShown` 만 보는 이유다.
 */
export function fieldDescription({
  id,
  hint,
  error,
}: {
  id: string
  hint: string | undefined
  error: string | undefined
}): { hintShown: boolean; errorShown: boolean; describedBy: string | undefined } {
  if (error !== undefined) {
    return { hintShown: false, errorShown: true, describedBy: fieldErrorId(id) }
  }
  if (hint !== undefined) {
    return { hintShown: true, errorShown: false, describedBy: fieldHintId(id) }
  }
  return { hintShown: false, errorShown: false, describedBy: undefined }
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
 * label + 입력 + 안내 · 오류 메시지의 접근성 배선만 담당한다.
 *
 * 안쪽 입력(`Input` · `Textarea` · `DateField` 와 그것을 감싼 `PasswordInput` · `AmountInput`)의
 * `aria-describedby` 는 **이 컴포넌트가 정해 내려준다** (`field-context.tsx`, #1100). 사용처는
 * `hint` · `error` 를 여기에만 주면 된다.
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
  const { hintShown, errorShown, describedBy } = fieldDescription({ id, hint, error })

  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <label htmlFor={id} className="text-body-2 text-fg font-medium">
        {label}
        {required && (
          <span aria-hidden="true" className="text-danger-500 ml-1">
            *
          </span>
        )}
      </label>
      <FieldDescribedByProvider id={id} describedBy={describedBy}>
        {children}
      </FieldDescribedByProvider>
      {hintShown && (
        <p id={fieldHintId(id)} className="text-caption text-fg-muted">
          {hint}
        </p>
      )}
      {errorShown && (
        <p id={fieldErrorId(id)} className="text-caption text-danger-500">
          {error}
        </p>
      )}
    </div>
  )
}
