import Link from 'next/link'

import type { ButtonHTMLAttributes, ReactNode, Ref } from 'react'

import { cn } from '@/lib/utils/cn'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
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
  primary: 'bg-brand-500 text-fg-inverse hover:bg-brand-600 active:bg-brand-600',
  secondary: 'border border-border-strong bg-bg text-fg hover:bg-band',
  ghost: 'text-fg-muted hover:bg-band',
  // 파괴 버튼 채움은 danger-700 이다 — 가이드 §5-2 ConfirmModal
  danger: 'bg-danger-700 text-fg-inverse hover:opacity-90',
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
export type ButtonLinkProps = {
  href: string
  variant?: ButtonVariant
  size?: ButtonSize
  leading?: ReactNode
  trailing?: ReactNode
  children: ReactNode
  /** 레이아웃 유틸리티만 허용한다. 색·radius·shadow·padding 덮어쓰기 금지 (component-guide.md §3) */
  className?: string
}

export function ButtonLink({
  href,
  variant = 'primary',
  size = 'md',
  leading,
  trailing,
  className,
  children,
}: ButtonLinkProps) {
  return (
    <Link
      href={href}
      className={cn(
        'inline-flex items-center justify-center rounded-md font-semibold transition-colors',
        'focus-visible:ring-brand-500 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none',
        VARIANT[variant],
        SIZE[size],
        className,
      )}
    >
      {leading}
      {children}
      {trailing}
    </Link>
  )
}
