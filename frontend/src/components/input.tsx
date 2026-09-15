import type { InputHTMLAttributes, ReactNode, Ref } from 'react'

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
  /**
   * 입력란 **안** 오른쪽에 서는 조작 요소 — 비밀번호 표시 토글이 첫 사용처다.
   *
   * `suffix` 와 자리는 같지만 성격이 반대다. `suffix` 는 `pointer-events-none` 인 표기라
   * 누르면 입력란에 포커스가 가고, 이쪽은 **스스로 눌리는 버튼**이라 그 자리가 입력란의
   * 히트 영역에서 빠진다. 둘을 한 prop 으로 묶으면 호출부가 어느 쪽인지 말할 수단이 없다.
   *
   * **자리(여백 · 절대 배치)는 여기서 잡는다.** 사용처가 `relative` 래퍼와 `pr-*` 를 직접
   * 두면 그것이 곧 `component-guide.md` §3 이 막는 padding 덮어쓰기다 — `suffix` 와 같은 이유다.
   *
   * 44px 짜리 `iconOnly` 버튼(`size="md"`)을 넣는 것을 전제로 오른쪽을 비운다. 입력란
   * 높이(`h-11`)와 같아서 버튼이 입력란을 꽉 채우고, 최소 터치 영역(DESIGN.md §7)이
   * 그대로 지켜진다.
   */
  action?: ReactNode
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
  action,
  className,
  ...rest
}: InputProps) {
  // 표기와 버튼은 같은 자리를 쓴다. 둘 다 오면 겹치므로 하나만 그린다는 것을 한 값으로 못박는다
  const trailing = action ?? (suffix === undefined ? undefined : suffix)

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
        /*
          **배경을 명시한다** (#531). 예전에는 투명이라 담는 면의 색을 그대로 입었다 —
          흰 카드 위(로그인·회원가입·반려견 폼·모달 열둘)에서는 `--bg` 와 같은 색이라 차이가
          없었지만, **L0 회색 바닥(`--bg-sunken` #F5F6F8) 위에 놓인 장소 검색만** 입력란이
          바닥과 같은 회색이 되어 "여기에 쓸 수 있다" 가 읽히지 않았다. 테두리 하나로 버티던
          자리다.

          그래서 `--bg`(#FFFFFF)를 못박는다 — **흰 카드 위 사용처는 값이 같아 픽셀이 바뀌지
          않고**, 회색 바닥 위에서만 입력란이 면으로 떠오른다. 회색 위에서만 흰 배경을 주는
          변형(`bg-bg lg:bg-transparent` 류)을 두지 않는 이유는, 같은 컴포넌트가 폭이 아니라
          **담는 면**에 따라 갈리면 사용처가 자기 바닥색을 알아야 하기 때문이다.
        */
        'bg-bg',
        'placeholder:text-fg-subtle',
        'focus-visible:ring-brand-500 focus-visible:ring-1 focus-visible:ring-offset-0 focus-visible:outline-none',
        'disabled:cursor-not-allowed disabled:opacity-50',
        invalid ? 'border-danger-500' : 'border-border-strong',
        /*
          값 위에 겹치지 않게 오른쪽을 비운다. 폭은 아래 span 과 짝이다 — 표기는
          40(`pr-10`), 버튼은 48(`pr-12`)이다.

          **버튼 폭(44)이 아니라 48 이다.** 44 는 `DESIGN.md` §4 의 스페이싱 스케일
          (4·6·8·12·16·20·24·32·40·48·64) 밖이고, `token-usage.test.ts` 가 스케일 밖
          값을 예외 없이 잡는다. 스케일 안의 다음 값인 48 을 쓰면 남는 4px 이 글자와
          버튼 사이 간격이 되어 오히려 낫다 — 44 면 커서가 버튼에 닿는다.
        */
        action === undefined ? (suffix === undefined ? '' : 'pr-10') : 'pr-12',
        // 오른쪽에 무언가 서면 배치 className 은 감싸는 span 이 받는다 — 둘 다 주면
        // `w-1/2` 같은 값이 두 겹으로 걸려 실제 폭이 절반의 절반이 된다
        trailing === undefined ? className : '',
      )}
      {...rest}
    />
  )

  if (trailing === undefined) return field

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
      {action === undefined ? (
        <span
          aria-hidden="true"
          className="text-body-2 text-fg-muted pointer-events-none absolute right-3 font-medium"
        >
          {suffix}
        </span>
      ) : (
        /*
          여백 없이 오른쪽 끝에 붙인다 — 버튼이 44×44 이고 입력란도 44 라 안쪽에 딱 맞는다.
          여기에 `right-1` 류를 주면 버튼이 테두리 안으로 들어오면서 터치 영역이 입력란
          모서리와 어긋난다.
        */
        <span className="absolute right-0 flex items-center">{action}</span>
      )}
    </span>
  )
}
