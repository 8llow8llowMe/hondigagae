import type { InputHTMLAttributes, Ref } from 'react'

import { fieldErrorId } from '@/components/field'
import { cn } from '@/lib/utils/cn'

type NativeProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  // Checkbox 가 자체적으로 재정의하거나 내부에서 계산해 배선하는 속성은 감춘다.
  // defaultChecked: controlled 전용 계약이 깨진다 (component-guide.md §5, Input 선례).
  | 'className'
  | 'type'
  | 'checked'
  | 'onChange'
  | 'aria-invalid'
  | 'aria-describedby'
  | 'defaultValue'
  | 'defaultChecked'
>

export type CheckboxProps = NativeProps & {
  id: string
  /** 체크박스는 라벨이 요소 옆에 붙는다. `Field` 를 쓰지 않고 자체 라벨을 갖는다 */
  label: string
  /** controlled 전용이다. uncontrolled 모드를 지원하지 않는다 — component-guide.md §5 */
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  error?: string | undefined
  /** 레이아웃 유틸리티만 허용한다 */
  className?: string
  ref?: Ref<HTMLInputElement>
}

/**
 * 단일 boolean 입력.
 *
 * **`Field` 로 감싸지 않는다.** `Field` 는 라벨을 입력 *위* 에 두는데 체크박스의
 * 라벨은 *옆* 에 와야 하고, 체크박스는 스스로 labelable 이라 `<label>` 로 감싸는 것이
 * 정석이다. 오류 요소 id 는 `fieldErrorId()` 를 공유한다
 * (docs/component-guide.md §7).
 *
 * `type` 을 열지 않는다 — 라디오는 그룹 의미가 달라 `RadioGroup` 이 담당한다.
 */
export function Checkbox({
  id,
  label,
  checked,
  onCheckedChange,
  error,
  className,
  disabled,
  ...rest
}: CheckboxProps) {
  const invalid = error !== undefined

  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <label
        htmlFor={id}
        className={cn(
          // 44px — 모바일 최소 터치 영역 (DESIGN.md §7)
          'flex min-h-11 cursor-pointer items-center gap-3',
          disabled === true && 'cursor-not-allowed opacity-50',
        )}
      >
        <input
          type="checkbox"
          id={id}
          checked={checked}
          disabled={disabled}
          onChange={(event) => onCheckedChange(event.target.checked)}
          aria-invalid={invalid ? true : undefined}
          aria-describedby={invalid ? fieldErrorId(id) : undefined}
          className={cn(
            'accent-brand-500 size-5 shrink-0 rounded',
            'focus-visible:ring-brand-500 focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:outline-none',
            invalid && 'outline-danger-500 outline-1',
          )}
          {...rest}
        />
        <span className="text-body-2 text-fg">{label}</span>
      </label>

      {invalid && (
        <p id={fieldErrorId(id)} className="text-caption text-danger-500">
          {error}
        </p>
      )}
    </div>
  )
}
