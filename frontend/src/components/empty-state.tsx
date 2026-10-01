import type { ReactNode } from 'react'

import { StateCharacter, type StateCharacterPose } from '@/components/character'
import { type StatePlacement, statePlacementClass } from '@/lib/ui/inset'
import { cn } from '@/lib/utils/cn'

export type EmptyStateProps = StatePlacement & {
  title: string
  description?: string | undefined
  /** 재시도가 아니라 **다음 행동** 이다 (예: "필터 초기화") */
  action?: ReactNode
  /*
    `inset` — 좌우 여백 축 (DESIGN.md §7). 좌측 레일 안에 놓을 때는 `rail` — `ErrorState` 와 같다.
    `flush` — 담는 쪽이 이미 여백을 가진 자리(인증 셸 카드)에서 자기 여백을 걷는다 (#1079).
  */
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
   *
   * **`1` 은 화면 전체가 이 상태인 자리 — 위에 `h1` 이 없을 때만이다** (#1079, 인증 셸의 소셜
   * 콜백). `not-found.tsx` 처럼 `sr-only` `h1` 을 따로 두면 같은 제목을 두 번 읽는다. 크기는
   * 여기서도 그대로다 — 큰 제목은 실패를 사건처럼 보이게 한다(아래 컴포넌트 JSDoc).
   */
  headingLevel?: 1 | 2 | 3
  /**
   * 글 묶음 옆에 앉는 캐릭터 (#939, DESIGN.md §0-5). **허용 자리 목록에 있는 호출부만 넘긴다**
   * — `character.test.ts` 가 목록 밖의 사용을 잡는다.
   *
   * 필터 결과 0건처럼 "조건을 바꾸면 되는" 빈 상태에는 넘기지 않는다. 캐릭터는 처음 오는
   * 사람 · 길을 잃은 사람에게 서는 것이지, 조작의 결과에 서는 것이 아니다.
   */
  character?: StateCharacterPose
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
  inset,
  flush,
  headingLevel = 2,
  character,
  className,
}: EmptyStateProps) {
  const placement = statePlacementClass({ inset, flush })
  const Heading = `h${headingLevel}` as const

  const body = (
    <>
      {/* 중립 톤 — danger 를 쓰지 않는다 (DESIGN.md §2) */}
      <Heading className="text-body-1 text-fg font-semibold">{title}</Heading>
      {description !== undefined && <p className="text-body-2 text-fg-muted">{description}</p>}
      {action !== undefined && <div className="mt-2">{action}</div>}
    </>
  )

  if (character === undefined) {
    return <div className={cn('flex flex-col items-start gap-2', placement, className)}>{body}</div>
  }

  /*
    **캐릭터가 있어도 좌측 정렬은 그대로다** (#939). 개는 글 묶음 **오른쪽**에 서고 발을 글 묶음
    아랫선(`items-end`)에 맞춘다 — 가운데로 모으면 빈 상태가 사건처럼 보인다(위 주석).

    **`justify-between` 을 쓰지 않는다.** 전폭 카드(1440 캡)에서 개가 오른쪽 끝으로 가면 글과
    수백 px 떨어져 무엇을 연기하는지 끊긴다. 글 바로 옆(`gap-6`)이다.
  */
  return (
    <div className={cn('flex items-end gap-6', placement, className)}>
      <div className="flex min-w-0 flex-col items-start gap-2">{body}</div>
      <StateCharacter pose={character} />
    </div>
  )
}
