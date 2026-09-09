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
  /**
   * 입력란 안 오른쪽에 서는 단위 표기 (`kg` 등) — #369.
   *
   * **값에는 들어가지 않는다.** `value` 는 숫자만 들고 있고 이것은 그 옆에 그려지는
   * 라벨이다. `placeholder="3.5kg"` 로 단위를 알리던 자리는 **값을 채우는 순간 사라져**
   * 무슨 단위인지 다시 알 수 없었다.
   *
   * `aria-hidden` 이다 — 라벨(`체중`)과 함께 읽히면 스크린리더에 `체중 kg` 로 들리고,
   * 단위는 `Field` 의 라벨·hint 가 이미 말한다.
   *
   * **자리는 컴포넌트가 잡는다.** 사용처가 `pr-*` 로 여백을 뚫으면 그것이 곧
   * `component-guide.md` §3 이 막는 padding 덮어쓰기다.
   */
  suffix?: string
  /** 레이아웃 유틸리티만 허용한다 */
  className?: string
  ref?: Ref<HTMLInputElement>
}

export function Input({
  id,
  value,
  onValueChange,
  invalid = false,
  suffix,
  className,
  ...rest
}: InputProps) {
  const field = (
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
        'focus-visible:ring-brand-500 focus-visible:ring-1 focus-visible:ring-offset-0 focus-visible:outline-none',
        'disabled:cursor-not-allowed disabled:opacity-50',
        invalid ? 'border-danger-500' : 'border-border-strong',
        // 단위가 값 위에 겹치지 않게 오른쪽을 비운다. 폭은 아래 span 과 짝이다
        suffix === undefined ? '' : 'pr-10',
        // 단위가 있으면 배치 className 은 감싸는 span 이 받는다 — 둘 다 주면 `w-1/2` 같은
        // 값이 두 겹으로 걸려 실제 폭이 절반의 절반이 된다
        suffix === undefined ? className : '',
      )}
      {...rest}
    />
  )

  if (suffix === undefined) return field

  /*
    **테두리를 감싼 div 로 옮기지 않는다.** 포커스 링·오류 테두리·비활성 흐림이 전부
    `<input>` 에 걸려 있어, 껍데기로 옮기면 세 상태를 다시 배선해야 한다. 겹쳐 두면
    `<input>` 이 그대로 자기 상태를 그린다.

    단위는 `pointer-events-none` 이다 — 그 자리를 눌러도 입력란에 포커스가 간다.
    `className` 은 배치용이라 이 래퍼가 받는다 (`w-full` 등이 여기 붙어야 뜻이 맞다).
  */
  return (
    <span className={cn('relative flex w-full items-center', className)}>
      {field}
      <span
        aria-hidden="true"
        className="text-body-2 text-fg-muted pointer-events-none absolute right-3 font-medium"
      >
        {suffix}
      </span>
    </span>
  )
}
