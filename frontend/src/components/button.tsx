import Link from 'next/link'

import type { ButtonHTMLAttributes, ReactNode, Ref } from 'react'

import { cn } from '@/lib/utils/cn'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'dangerOutline'
export type ButtonSize = 'sm' | 'md' | 'lg'

type BaseProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className' | 'children'> & {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
  leading?: ReactNode
  trailing?: ReactNode
  /** 레이아웃 유틸리티만 허용한다. 색·radius·shadow·padding 덮어쓰기 금지 (component-guide.md §3) */
  className?: string
  ref?: Ref<HTMLButtonElement>
}

/**
 * icon-only 버튼은 aria-label 을 타입으로 강제한다.
 * 주석으로 "붙이세요" 라고 쓰면 반드시 누락된다 — component-guide.md §7.
 */
type IconOnly = { iconOnly: true; 'aria-label': string; children?: never }
type WithLabel = { iconOnly?: false; children: ReactNode }

export type ButtonProps = BaseProps & (IconOnly | WithLabel)

const VARIANT: Record<ButtonVariant, string> = {
  // **`--brand-500` 이 아니다** (이슈 #61). 500 위 흰 글자는 3.49:1 이고 라벨은 16px/600 —
  // WCAG 대형(24px 또는 18.66px+bold)이 아니라 본문이라 4.5:1 이 필요하다. 600 은 5.27:1 이다
  primary: 'bg-brand-600 text-fg-inverse hover:bg-brand-700 active:bg-brand-700',
  secondary: 'border border-border-strong bg-bg text-fg hover:bg-band',
  ghost: 'text-fg-muted hover:bg-band',
  // 파괴 버튼 채움은 danger-700 이다 — 가이드 §5-2 ConfirmModal
  danger: 'bg-danger-700 text-fg-inverse hover:opacity-90',
  /*
    **되돌릴 수 없지만 그 화면의 주 행동은 아닌 파괴 액션.**

    `danger`(채움)는 확인 다이얼로그의 확정 버튼처럼 **그 순간의 주 행동**일 때 쓴다.
    화면 안에 그냥 놓여 있는 삭제 버튼까지 채우면 저장 버튼과 같은 무게로 붉게 서서
    시선을 먼저 끌고, 실제로 누를 일은 거의 없는 것이 화면에서 가장 강한 요소가 된다.

    글자는 `danger-900`(흰 배경 6.47:1) — DESIGN.md §2-6 이 "메뉴 안 파괴적 항목
    텍스트" 로 정의한 그 톤이고, 여기도 같은 성격(낮은 강조의 파괴 액션)이다.
    테두리 `danger-500` 은 비텍스트라 3:1 기준이고 4.53:1 로 통과한다.
  */
  dangerOutline: 'border border-danger-500 bg-bg text-danger-900 hover:bg-danger-100',
}

const SIZE: Record<ButtonSize, string> = {
  sm: 'h-8 gap-1 px-3 text-body-2',
  // 44px — 모바일 최소 터치 영역 (DESIGN.md §7)
  md: 'h-11 gap-2 px-4 text-body-1',
  lg: 'h-12 gap-2 px-5 text-body-1',
}

const ICON_ONLY_SIZE: Record<ButtonSize, string> = {
  sm: 'h-8 w-8 p-0',
  md: 'h-11 w-11 p-0',
  lg: 'h-12 w-12 p-0',
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  leading,
  trailing,
  className,
  iconOnly,
  children,
  disabled,
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      // form 안에서 의도치 않은 submit 을 막는다 (component-guide.md §7)
      type={type}
      disabled={disabled === true || loading}
      aria-busy={loading || undefined}
      className={cn(
        'inline-flex items-center justify-center rounded-md font-semibold transition-colors',
        'focus-visible:ring-brand-500 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none',
        'disabled:cursor-not-allowed disabled:opacity-50',
        VARIANT[variant],
        iconOnly === true ? ICON_ONLY_SIZE[size] : SIZE[size],
        className,
      )}
      {...rest}
    >
      {leading}
      {children}
      {trailing}
    </button>
  )
}

/**
 * 버튼 외형의 **이동** — `<Link>` 를 렌더한다.
 *
 * **`Button` 에 `href` 를 뚫지 않는다.** 버튼과 링크는 시맨틱이 다르고(스페이스 vs 엔터,
 * 새 탭·주소 복사·"링크 열기" 컨텍스트 메뉴), 한 컴포넌트가 둘을 오가면 호출부가 어느 쪽을
 * 만들고 있는지 알 수 없다. `PlaceBackLink` 주석이 같은 판단을 적어 뒀다.
 *
 * **외형 상수(`VARIANT` / `SIZE`)를 `Button` 과 공유하는 것이 이 컴포넌트의 존재 이유다.**
 * 이것이 없어서 화면 다섯 곳이 버튼 외형을 손으로 복제하고 있었다 — `--brand-500` 을 바꾸면
 * `button.tsx` 만 바뀌고 복제본은 그대로 남는다 (이슈 #70).
 *
 * `loading` · `disabled` 가 없다. **이동에는 그런 상태가 없다** — 비활성 링크가 필요하면
 * 그것은 링크가 아니라 버튼이다.
 */
/**
 * **속성을 최소로 받는다.** `AnchorHTMLAttributes` 를 통째로 `Link` 로 흘리면
 * `exactOptionalPropertyTypes` 아래에서 선택 속성의 `undefined` 가 `LinkProps` 와 충돌하고,
 * 애초에 지금 필요한 것은 이것뿐이다. **필요할 때 늘린다** (component-guide.md §6).
 */
type LinkBaseProps = {
  href: string
  variant?: ButtonVariant
  size?: ButtonSize
  leading?: ReactNode
  trailing?: ReactNode
  /** 레이아웃 유틸리티만 허용한다. 색·radius·shadow·padding 덮어쓰기 금지 (component-guide.md §3) */
  className?: string
}

/**
 * `Button` 과 **같은 규칙으로** icon-only 를 타입으로 강제한다 — 아이콘은 `leading` 에
 * 넣고 `children` 은 두지 않는다.
 *
 * 이 유니온이 없으면 하이픈이 든 JSX 속성을 TypeScript 가 props 타입과 대조하지 않아
 * **`aria-label` 을 넘겨도 컴파일이 통과하고 값만 조용히 버려진다.** 아이콘 버튼에서
 * 접근 가능한 이름이 사라지는 것을 타입이 못 잡는 유일한 경로다.
 */
export type ButtonLinkProps = LinkBaseProps &
  (
    | { iconOnly: true; 'aria-label': string; children?: never }
    | { iconOnly?: false; children: ReactNode }
  )

export function ButtonLink(props: ButtonLinkProps) {
  const { href, variant = 'primary', size = 'md', leading, trailing, className, children } = props

  return (
    <Link
      href={href}
      aria-label={props.iconOnly === true ? props['aria-label'] : undefined}
      className={cn(
        'inline-flex items-center justify-center rounded-md font-semibold transition-colors',
        'focus-visible:ring-brand-500 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none',
        VARIANT[variant],
        props.iconOnly === true ? ICON_ONLY_SIZE[size] : SIZE[size],
        className,
      )}
    >
      {leading}
      {children}
      {trailing}
    </Link>
  )
}
