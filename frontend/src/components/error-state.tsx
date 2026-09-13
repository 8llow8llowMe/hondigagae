import { Button } from '@/components/button'
import { messages } from '@/lib/messages'
import { type Inset, INSET_CLASS } from '@/lib/ui/inset'
import { cn } from '@/lib/utils/cn'

export type ErrorStateProps = {
  title: string
  description?: string | undefined
  /** 필수 prop 이다. optional 로 두면 빠진다 (component-guide.md §10) */
  onRetry: () => void
  retryLabel?: string
  /**
   * 좌우 여백 축 (DESIGN.md §7). **좌측 레일 안에 놓을 때는 `rail` 을 준다.**
   *
   * 예전에는 `md:px-10` 이 하드코딩돼 있어, 홈 판정 자리에서 로딩(24) → 오류(40) →
   * 성공(24) 이 서로 다른 인셋을 썼다 — 재시도를 누르는 동안 글자가 좌우로 움직였다.
   * 오류 화면에서 유일하게 만지는 것이 그 버튼이라 가장 눈에 띄는 자리였다.
   */
  inset?: Inset
  /**
   * 제목의 heading 레벨 — **제목을 가진 `Surface` 안이면 `3`** 이다 (#456① · #469).
   *
   * 이게 없을 때 `/mypage` 오류의 실측 아웃라인이 `h1:내 정보` → `h2:내 정보`(카드) →
   * `h2:내 정보를 불러오지 못했어요` 였다 — 카드 **내용**의 제목이 카드 **자신**의 제목과
   * 형제로 읽힌다. 3a 가 "상태가 카드 머리를 공유한다"(#451)를 규약으로 삼으면서 제목 있는
   * 카드 안에 상태가 들어가는 자리가 계속 늘었고, 목록 항목은 이미 `h3` 로 한 단
   * 내려갔는데(#464 · #466) 상태 컴포넌트만 예외로 남아 있었다.
   *
   * 기본값·유도하지 않는 이유·크기를 그대로 두는 이유는 `EmptyState` 쪽 주석이 정본이다.
   */
  headingLevel?: 2 | 3
  className?: string
}

/**
 * 일시 장애(5xx·무응답) 전용. 데이터 부재는 EmptyState 를 쓴다.
 *
 * **오류는 섹션 단위로만 그린다. 화면 전체를 오류로 덮지 않는다** (가이드 §5) —
 * 일정 자료는 우리 DB이고 판정은 외부 예보라, 한쪽이 죽어도 다른 쪽은 살아 있다.
 *
 * 제목을 붉게 칠하지 않는다. 표면은 흰색으로 두고 danger 는 아이콘에만 쓴다 —
 * 배경·제목까지 붉히면 일시 장애가 경보처럼 읽힌다.
 */
export function ErrorState({
  title,
  description,
  onRetry,
  retryLabel = messages.common.retry,
  inset = 'main',
  headingLevel = 2,
  className,
}: ErrorStateProps) {
  const Heading = `h${headingLevel}` as const

  return (
    <div className={cn('flex flex-col items-start gap-2 py-12', INSET_CLASS[inset], className)}>
      <Heading className="text-body-1 text-fg font-semibold">{title}</Heading>
      {description !== undefined && <p className="text-body-2 text-fg-muted">{description}</p>}
      {/* 이 상태에서 화면의 유일한 조작 대상이다. 모바일 터치 영역 44px (DESIGN.md §7) */}
      <Button variant="secondary" size="md" className="mt-1" onClick={onRetry}>
        {retryLabel}
      </Button>
    </div>
  )
}
