import Link from 'next/link'

import { messages } from '@/lib/messages'
import type { PlanAlternativePlaceItem } from '@/types/plan'

/**
 * 비 예보일 때의 실내 대안 — 아트보드 01.
 *
 * **이 이슈에서는 제목만이다.** `indoorAlternatives` 는 `{placeId, title}` 뿐이고,
 * 일정에 담는 동작은 일자 편집(이슈 C)이 소유한다 — 여기서 담기 버튼을 만들면 일괄
 * 교체 저장 규칙이 두 곳에 생긴다.
 *
 * **비면 블록을 렌더하지 않는다.** 비 예보가 없는 일자에 빈 제목만 남으면
 * "대안이 없다" 로 읽힌다 — 사실은 필요가 없는 것이다.
 */
export function PlanIndoorAlternatives({
  alternatives,
}: {
  alternatives: PlanAlternativePlaceItem[]
}) {
  if (alternatives.length === 0) return null

  return (
    <div className="border-border border-t py-4">
      <h4 className="text-caption text-fg-muted font-semibold">
        {messages.plan.indoorAlternativesTitle}
      </h4>
      <ul className="mt-2 flex flex-col gap-1">
        {alternatives.map((alternative) => (
          <li key={alternative.placeId}>
            <Link
              href={`/places/${alternative.placeId}`}
              className="text-body-2 text-link hover:text-link-hover focus-visible:ring-brand-500 inline-flex min-h-11 items-center font-medium break-keep focus-visible:ring-2 focus-visible:outline-none"
            >
              {alternative.title}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
