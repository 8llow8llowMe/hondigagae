import type { ReactNode } from 'react'

import { cn } from '@/lib/utils/cn'

/**
 * Banner — 상시 진입점 (디자인 가이드 §5). 병원·약국 배너가 대표 사례다.
 *
 * **흰 표면 + 아이콘만 danger 색.** 배경을 붉게 칠하지 않는다 — 상시 진입점이지
 * 경보가 아니다. 붉은 면이 화면에 늘 떠 있으면 진짜 경보를 구분할 수 없게 된다.
 *
 * **모든 상태에서 남는다.** 오류·빈 화면에서도 제거하지 않는다 — 위급할 때 필요한
 * 진입점이 데이터 사정으로 사라지면 안 된다.
 */
export function Banner({
  title,
  /** 사실을 적는다 — "제주 24시간 병원은 3곳뿐이에요" */
  description,
  href,
  leading,
  className,
}: {
  title: string
  description?: string
  href: string
  /** 아이콘. 여기에만 danger 색을 쓴다 */
  leading?: ReactNode
  className?: string
}) {
  return (
    <a
      href={href}
      className={cn(
        'bg-bg border-border focus-visible:ring-brand-500 flex items-center gap-3 border-y px-4 py-4 focus-visible:ring-2 focus-visible:outline-none md:px-10',
        className,
      )}
    >
      {leading !== undefined && (
        <span aria-hidden className="text-danger-500 shrink-0">
          {leading}
        </span>
      )}
      <span className="flex min-w-0 flex-col">
        <span className="text-body-1 text-fg font-semibold">{title}</span>
        {description !== undefined && (
          <span className="text-body-2 text-fg-muted mt-0.5">{description}</span>
        )}
      </span>
    </a>
  )
}
