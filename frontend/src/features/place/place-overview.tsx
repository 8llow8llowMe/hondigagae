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
 * 데스크톱(`md`+)에서 접는 길이 기준 — 세 줄을 넘길 만한 길이다.
 *
 * **모바일 기준(140)을 그대로 쓰지 않는다.** 데스크톱 한 줄은 60자 안팎이라 140자는 세 줄 안에
 * 들어온다 — 같은 기준이면 가릴 것이 없는데 `더 보기` 가 서서 눌러도 아무 일이 없다.
 */
const DESKTOP_COLLAPSE_THRESHOLD = 240

/**
 * 장소 소개 — 아트보드 `장소 상세` 01(모바일은 접고 "더 보기") · 03(데스크톱은 전문).
 *
 * **데스크톱도 길면 세 줄에서 접는다** (#935 · 방문 정보 재편). 소개가 따로 카드였을
 * 때는 폭이 있어 전문을 세웠지만, 이제 **제목 카드 안**(제목 → 소개 → 반려견 동반)에 들어가
 * 전문을 세우면 수백 자가 동반 정보를 화면 밖으로 민다 — 이 서비스의 첫 질문이 그 아래다.
 */
export function PlaceOverview({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false)
  const bodyId = useId()

  const collapsible = text.length > COLLAPSE_THRESHOLD
  const desktopCollapsible = text.length > DESKTOP_COLLAPSE_THRESHOLD

  return (
    <div className="flex flex-col">
      <p
        id={bodyId}
        className={cn(
          'text-body-2 md:text-body-1 text-fg break-keep whitespace-pre-line',
          // 모바일은 네 줄, 데스크톱은 긴 글만 세 줄에서 접는다
          collapsible && !expanded && 'line-clamp-4',
          collapsible &&
            !expanded &&
            (desktopCollapsible ? 'md:line-clamp-3' : 'md:line-clamp-none'),
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
          className={cn(
            'text-body-2 text-link hover:text-link-hover focus-visible:ring-brand-500 inline-flex h-11 items-center self-start font-semibold focus-visible:ring-2 focus-visible:outline-none',
            // 데스크톱에서 접지 않는 길이면 버튼도 없다 — 눌러도 아무 일이 없는 버튼이 된다
            !desktopCollapsible && 'md:hidden',
          )}
        >
          {expanded ? messages.place.detailOverviewLess : messages.place.detailOverviewMore}
        </button>
      )}
    </div>
  )
}
