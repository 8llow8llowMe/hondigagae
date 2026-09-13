import type { ReactNode } from 'react'

import { type Inset, INSET_CLASS } from '@/lib/ui/inset'
import { cn } from '@/lib/utils/cn'

export type EmptyStateProps = {
  title: string
  description?: string | undefined
  /** 재시도가 아니라 **다음 행동** 이다 (예: "필터 초기화") */
  action?: ReactNode
  /** 좌우 여백 축 (DESIGN.md §7). 좌측 레일 안에 놓을 때는 `rail` — `ErrorState` 와 같다 */
  inset?: Inset
  /**
   * 제목의 heading 레벨 — **담는 면이 `h2` 를 그리면 `3`** 이다 (#456① · #469).
   *
   * 묻는 것은 "카드 안인가" 가 아니라 **"바로 위에 `h2` 가 있는가"** 다. 그래서 대상이
   * 카드만은 아니다: 제목을 가진 `Surface`(L1)와 **`title` 을 넘긴 `BottomSheet`** 가
   * 둘 다 `h2` 를 그린다 — 시트 제목은 `text-body-1 font-semibold` 로 **이 컴포넌트의
   * 제목과 클래스까지 같다**(`bottom-sheet.tsx`). 거기서도 내리지 않으면 같은 증상이다.
   *
   * 기본값 `2` 는 그런 면 밖이거나 `aria-label` 만 가진 면 안일 때다. 그런 자리에서는
   * 위가 페이지 `h1` 하나라 `h2` 가 맞다 — 내리면 사이가 비어 레벨을 건너뛴다.
   *
   * **`inset` 에서 유도하지 않는다.** 두 축은 이미 갈려 있다 — 카드 안인데 `inset` 을 안 준
   * 자리가 열 곳이고(#485), 반대로 카드 밖인데 카드 글줄에 맞추려 `inset="card"` 를 쓰는
   * 자리도 있다. 한쪽을 다른 쪽에서 읽으면 그 열 곳이 조용히 `h3` 가 된다.
   *
   * **`Surface` 가 context 로 내려보낼 수도 없다.** 서버 컴포넌트라 context 를 못 쓴다.
   *
   * **레벨만 바꾸고 크기는 그대로다.** 카드 제목(`text-title-2`)보다 이미 작은
   * `text-body-1` 이라 더 줄일 것이 없다 — 바뀌는 것은 문서 개요뿐이다.
   */
  headingLevel?: 2 | 3
  className?: string
}

/**
 * 데이터 부재(404 / 결과 0건) 전용.
 *
 * **좌측 정렬이고 제목은 16/600 이다** (가이드 §5). 가운데 정렬 + 큰 제목은 빈 상태를
 * 사건처럼 보이게 한다 — 빈 것은 사건이 아니다.
 *
 * **비어 있다고 섹션을 숨기지 않는다** — 진입점이 사라진다.
 *
 * **`onRetry` 를 추가하지 않는다.** 404 에 재시도 버튼을 붙이는 경로가 열린다
 * — docs/api-integration-guide.md §3, component-guide.md §10.
 * 일시 장애는 ErrorState 를 쓴다.
 */
export function EmptyState({
  title,
  description,
  action,
  inset = 'main',
  headingLevel = 2,
  className,
}: EmptyStateProps) {
  const Heading = `h${headingLevel}` as const

  return (
    <div className={cn('flex flex-col items-start gap-2 py-12', INSET_CLASS[inset], className)}>
      {/* 중립 톤 — danger 를 쓰지 않는다 (DESIGN.md §2) */}
      <Heading className="text-body-1 text-fg font-semibold">{title}</Heading>
      {description !== undefined && <p className="text-body-2 text-fg-muted">{description}</p>}
      {action !== undefined && <div className="mt-2">{action}</div>}
    </div>
  )
}
