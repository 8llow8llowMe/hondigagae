import type { ReactNode } from 'react'

import { cn } from '@/lib/utils/cn'

/**
 * 표면 프리미티브 — DESIGN.md §0.
 *
 * **`Card` 를 대체한다.** 회색 배경 위에 둥근 흰 카드를 띄우면 대시보드처럼 읽힌다.
 * 페이지는 흰색이고, 묶음의 경계는 8px `Band` 로만 끊으며, 같은 묶음 안은 1px
 * 구분선으로 잇는다. 목록은 카드가 아니라 전폭 행이다.
 *
 * 그래서 이 파일의 어떤 요소에도 radius·shadow 가 없다. 둥근 것은 사진뿐이다.
 */

/**
 * 8px 밴드. **성격이 바뀌는 곳에만** 쓴다.
 *
 * "여기서 다른 이야기가 시작된다" 는 유일한 신호이므로, 같은 묶음 안의 항목을
 * 나눌 때 쓰면 신호가 죽는다. 그때는 `Row` 의 구분선이 맡는다.
 * 자료가 아니라 구분자라 `aria-hidden` 이다.
 */
export function Band({ className }: { className?: string }) {
  return <div aria-hidden className={cn('bg-band h-2 w-full', className)} />
}

/**
 * 전폭 섹션. 라운드·그림자·테두리가 없다.
 *
 * 좌우 여백은 16(모바일) / 40(데스크톱) 이고, 이것이 구분선 인셋과 같은 값이라
 * `Row` 의 선이 제목과 같은 축에서 시작한다.
 */
export function Section({
  title,
  trailing,
  children,
  className,
}: {
  /** 없으면 제목 줄 자체를 렌더하지 않는다 */
  title?: ReactNode
  /** 제목 우측 액션 (예: "전체 보기") */
  trailing?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section className={cn('bg-bg w-full', className)}>
      {title !== undefined && (
        <div className="flex items-center justify-between gap-4 px-4 pt-6 pb-5 md:px-10">
          <h2 className="text-title-2 text-fg md:text-title-1 font-semibold md:font-bold">
            {title}
          </h2>
          {trailing}
        </div>
      )}
      {children}
    </section>
  )
}

/**
 * 전폭 행. 목록의 기본 단위다.
 *
 * 구분선은 `border-top` 이 아니라 **`border-bottom` + 마지막 행 제거**로 넣는다.
 * 좌우 인셋 16 / 40 을 주기 위해 선을 의사요소가 아니라 내부 래퍼에 건다 —
 * `border` 를 행 자체에 걸면 전폭으로 그어져 인셋이 사라진다.
 *
 * `selected` 는 tint 만 바꾼다. **행 높이나 테두리를 바꾸지 않는다** — 목록이 들썩인다.
 */
export function Row({
  as: Tag = 'div',
  selected = false,
  last = false,
  children,
  className,
}: {
  as?: 'div' | 'li'
  selected?: boolean
  /** 마지막 행이면 구분선을 그리지 않는다 */
  last?: boolean
  children: ReactNode
  className?: string
}) {
  return (
    <Tag className={cn(selected ? 'bg-row-selected' : 'bg-bg', className)}>
      <div className={cn('px-4 md:px-10', last ? '' : 'border-border border-b')}>{children}</div>
    </Tag>
  )
}

/**
 * 행을 담는 목록. `ul`/`li` 로 내보내 스크린리더가 개수를 읽게 한다.
 *
 * 마지막 행의 구분선은 사용처가 `<Row last>` 로 끈다. CSS 로 자동 처리하려면
 * 임의 variant(`[&>li:last-child>div]:border-b-0`)가 필요한데, 그러면 이 목록
 * 바깥에서 `Row` 를 단독으로 쓸 때 규칙이 안 먹어 두 경로가 갈린다.
 */
export function RowList({ children, className }: { children: ReactNode; className?: string }) {
  return <ul className={cn('bg-bg w-full', className)}>{children}</ul>
}
