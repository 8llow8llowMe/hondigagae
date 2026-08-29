import Link from 'next/link'

import type { ReactNode } from 'react'

import { ChevronRightIcon } from '@/components/icons'
import { cn } from '@/lib/utils/cn'

/**
 * Banner — 상시 진입점 (디자인 가이드 §5). 병원·약국 배너가 대표 사례다.
 *
 * **흰 표면 + 아이콘만 danger 색.** 배경을 붉게 칠하지 않는다 — 상시 진입점이지
 * 경보가 아니다. 붉은 면이 화면에 늘 떠 있으면 진짜 경보를 구분할 수 없게 된다.
 *
 * **모든 상태에서 남는다.** 오류·빈 화면에서도 제거하지 않는다 — 위급할 때 필요한
 * 진입점이 데이터 사정으로 사라지면 안 된다.
 *
 * 아트보드(`혼디가개 홈·내비게이션.dc.html`) 실측에 맞춘다 — 우측 꺾쇠가 있고, 설명은
 * 12/500 muted 이며, **위아래 테두리를 스스로 긋지 않는다.** 묶음의 경계는 8px `Band` 가
 * 맡는다 (DESIGN.md §0). 예전에는 `border-y` 를 하드코딩해 밴드와 선이 겹쳤다.
 */
export function Banner({
  title,
  /** 사실을 적는다 — "제주 24시간 병원은 3곳뿐이에요" */
  description,
  href,
  leading,
  /**
   * 좌우 여백. **레일(24)과 본문(40)은 1024 이상에서만 다르다** — 그 아래에서는 레일이
   * 레일이 아니라 한 컬럼의 한 블록이라 본문 인셋을 따른다 (장소 상세에서 겪은 것과 같다).
   */
  inset = 'main',
  className,
}: {
  title: string
  description?: string
  href: string
  /** 아이콘. 여기에만 danger 색을 쓴다 */
  leading?: ReactNode
  inset?: 'main' | 'rail'
  className?: string
}) {
  return (
    <Link
      href={href}
      className={cn(
        'bg-bg focus-visible:ring-brand-500 flex items-center gap-3 py-4 focus-visible:ring-2 focus-visible:-outline-offset-2 focus-visible:outline-none',
        inset === 'rail' ? 'px-4 md:px-10 lg:px-6' : 'px-4 md:px-10',
        className,
      )}
    >
      {leading !== undefined && (
        <span aria-hidden className="text-danger-500 shrink-0">
          {leading}
        </span>
      )}
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-body-1 text-fg font-semibold">{title}</span>
        {description !== undefined && (
          // 12/500 muted — 아트보드 값이다. 본문(14)으로 올리면 제목과 무게가 비슷해진다
          <span className="text-caption text-fg-muted font-medium tabular-nums">{description}</span>
        )}
      </span>
      {/* 눌러서 이동한다는 것을 말하는 유일한 신호다 */}
      <ChevronRightIcon size={20} aria-hidden className="text-fg-subtle shrink-0" />
    </Link>
  )
}
