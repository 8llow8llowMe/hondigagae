'use client'

import { useId, useState } from 'react'

import { cn } from '@/lib/utils/cn'

/**
 * 근거 목록 (XAI `reasons`) — 디자인 가이드 §5.
 *
 * **서버 순서를 재정렬하지 않는다.** 영향이 큰 순서로 온다. 문장도 서버가 완성형으로
 * 준다(`description`) — FE 가 다시 쓰지 않는다 (styling-guide.md §7).
 *
 * **점수 숫자를 노출하지 않고, 문장 앞에 3px 세로 바를 달지 않는다.** 감점은 문장이
 * 말하고 등급은 상단 요약이 말한다. 바를 달면 목록이 색 줄무늬로 읽힌다.
 */

export type Reason = {
  /** 서버가 완성형으로 주는 문장 */
  description: string
  /**
   * 정보성 항목은 감점이 아니다 — 한 단계 흐리게만 내리고 부호를 붙이지 않는다
   * (예: "혼잡도 정보 없음").
   */
  informational?: boolean
}

export function ReasonList({
  reasons,
  /** 기본 노출 개수. 나머지는 펼침 버튼 뒤에 둔다 */
  initialCount = 2,
  moreLabel = '근거 %d개 더 보기',
  lessLabel = '근거 접기',
  className,
}: {
  reasons: Reason[]
  initialCount?: number
  /** `%d` 가 남은 개수로 치환된다 */
  moreLabel?: string
  lessLabel?: string
  className?: string
}) {
  const [expanded, setExpanded] = useState(false)
  const listId = useId()

  if (reasons.length === 0) return null

  const visible = expanded ? reasons : reasons.slice(0, initialCount)
  const hiddenCount = reasons.length - visible.length

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      <ul id={listId} className="flex flex-col gap-2">
        {visible.map((reason, index) => (
          <li
            key={`${index}-${reason.description}`}
            className={cn(
              'text-body-2',
              reason.informational === true ? 'text-fg-muted' : 'text-fg',
            )}
          >
            {reason.description}
          </li>
        ))}
      </ul>

      {hiddenCount > 0 && (
        <button
          type="button"
          aria-expanded={expanded}
          aria-controls={listId}
          onClick={() => setExpanded(true)}
          className="text-body-2 text-link hover:text-link-hover focus-visible:ring-brand-500 self-start font-semibold focus-visible:ring-2 focus-visible:outline-none"
        >
          {moreLabel.replace('%d', String(hiddenCount))}
        </button>
      )}

      {expanded && reasons.length > initialCount && (
        <button
          type="button"
          aria-expanded={expanded}
          aria-controls={listId}
          onClick={() => setExpanded(false)}
          className="text-body-2 text-link hover:text-link-hover focus-visible:ring-brand-500 self-start font-semibold focus-visible:ring-2 focus-visible:outline-none"
        >
          {lessLabel}
        </button>
      )}
    </div>
  )
}
