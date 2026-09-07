import Link from 'next/link'

import { Badge } from '@/components/badge'
import { ChevronRightIcon } from '@/components/icons'
import { formatDistance } from '@/lib/format/distance'
import { messages } from '@/lib/messages'
import type { AlternativePlaceItem } from '@/types/insight'

/**
 * 비 예보일 때의 실내 대안 — 홈-세부명세 D1(데스크톱 우측 "비 올 때 실내") · D5-1 §13.
 *
 * **추가 호출이 없다.** `indoorAlternatives` 는 홈이 이미 부르는 적합도 응답에 들어 있다.
 * 비가 예보된 날에만 채워지므로 평소에는 이 섹션이 자리를 먹지 않는다.
 *
 * **빈 배열이면 렌더하지 않는다.** 제목만 남으면 "대안이 없다" 로 읽히는데, 사실은
 * 필요가 없는 것이다 (일정 상세의 `PlanIndoorAlternatives` 와 같은 판단).
 *
 * **담기 버튼이 없다.** 일정 상세의 같은 블록은 그 일자에 바로 담지만, 홈에는 담을 대상
 * 일자가 없다. 여기서 할 일은 장소 상세로 보내는 것뿐이다 (D4 — 실내 대안 카드 클릭 →
 * `/places/{placeId}`).
 */
export function IndoorAlternativesSection({
  alternatives,
}: {
  alternatives: AlternativePlaceItem[]
}) {
  if (alternatives.length === 0) return null

  return (
    <section aria-labelledby="indoor-heading">
      <div className="px-4 pt-5 pb-2 md:px-10 md:pt-6 md:pb-3">
        <h2
          id="indoor-heading"
          className="text-title-2 text-fg md:text-title-1 font-semibold md:font-bold"
        >
          {messages.home.indoorHeading}
        </h2>
        {/* 거리의 기준점을 밝힌다 — `messages.home.indoorNote` 주석 */}
        <p className="text-caption text-fg-muted mt-1 font-medium">{messages.home.indoorNote}</p>
      </div>

      <ul>
        {alternatives.map((alternative) => (
          <IndoorAlternativeRow key={alternative.placeId} alternative={alternative} />
        ))}
      </ul>
    </section>
  )
}

/**
 * 대안 한 행. **카드가 아니라 전폭 행이다** (DESIGN.md §0).
 *
 * 계약이 주는 것은 `placeId` · `title` · `lat` · `lng` · `distanceMeters` ·
 * `petAllowanceType` · `allowedPetSize` 뿐이다 — **썸네일과 주소가 없다.** 장소 상세를
 * 보강 조회해 채우지 않는다: 비 오는 날 3행을 위해 요청 3건을 더 쏘는 값이 아니고,
 * 없는 것을 지어내지 않는 것이 이 서비스의 규칙이다.
 */
function IndoorAlternativeRow({ alternative }: { alternative: AlternativePlaceItem }) {
  return (
    <li className="border-border border-t">
      <Link
        href={`/places/${alternative.placeId}`}
        className="focus-visible:ring-brand-500 flex items-center gap-3 px-4 py-3 focus-visible:ring-2 focus-visible:-outline-offset-2 focus-visible:outline-none md:gap-5 md:px-10 md:py-4"
      >
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="text-body-1 text-fg md:text-title-2 font-semibold break-words">
            {alternative.title}
          </span>
          <span className="text-caption text-fg-muted mt-0.5 font-medium tabular-nums">
            {messages.home.indoorDistance.replace(
              '{distance}',
              formatDistance(alternative.distanceMeters),
            )}
          </span>
        </span>

        {/* 동반 조건이 먼저다 — 실내라도 들어갈 수 있는지가 첫 질문이다 */}
        <span className="hidden shrink-0 flex-wrap justify-end gap-1.5 md:flex">
          <Badge tone="neutral">{alternative.petAllowanceType.name}</Badge>
          <Badge tone="neutral">{alternative.allowedPetSize.name}</Badge>
        </span>

        <ChevronRightIcon size={20} aria-hidden className="text-fg-subtle shrink-0 md:hidden" />
      </Link>
    </li>
  )
}
