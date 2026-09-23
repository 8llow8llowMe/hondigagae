'use client'

import { useId, useState } from 'react'

import { messages } from '@/lib/messages'
import { cn } from '@/lib/utils/cn'

/**
 * 모바일에서 접히는 장소 소개를 만드는 길이 기준.
 *
 * **길이를 재서 판단하지 않고 글자 수로 가른다.** 실제 높이는 렌더 후에만 알 수 있는데,
 * 그때 접기 버튼이 나타나면 버튼이 뒤늦게 끼어들어 본문이 밀린다. 서버 렌더와 클라이언트
 * 렌더가 같은 결론을 내야 하이드레이션도 어긋나지 않는다.
 */
const COLLAPSE_THRESHOLD = 140

/**
 * 장소 소개 — 아트보드 `장소 상세` 01(모바일은 접고 "더 보기") · 03(데스크톱은 전문).
 *
 * **데스크톱에서는 접지 않는다.** 폭이 있어 네 줄이 부담이 아니고, 좌측 레일이 이미
 * 세로를 쓰고 있어 우측이 짧으면 열 구분선만 길게 남는다.
 */
export function PlaceOverview({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false)
  const bodyId = useId()

  const collapsible = text.length > COLLAPSE_THRESHOLD

  return (
    <div className="flex flex-col">
      <p
        id={bodyId}
        className={cn(
          'text-body-2 md:text-body-1 text-fg break-keep whitespace-pre-line',
          // 접기는 모바일에서만이다 — md 부터는 항상 전문을 보여준다
          collapsible && !expanded && 'line-clamp-4 md:line-clamp-none',
        )}
      >
        {text}
      </p>

      {collapsible && (
        <button
          type="button"
          aria-expanded={expanded}
          aria-controls={bodyId}
          onClick={() => setExpanded((previous) => !previous)}
          // 높이 44 — 규칙이 아니라 이 자리에서 고른 값이다 (#883 이 §7 하한을 지도 타깃으로 좁혔다)
          className="text-body-2 text-link hover:text-link-hover focus-visible:ring-brand-500 inline-flex h-11 items-center self-start font-semibold focus-visible:ring-2 focus-visible:outline-none md:hidden"
        >
          {expanded ? messages.place.detailOverviewLess : messages.place.detailOverviewMore}
        </button>
      )}
    </div>
  )
}
