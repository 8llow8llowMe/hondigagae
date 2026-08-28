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
