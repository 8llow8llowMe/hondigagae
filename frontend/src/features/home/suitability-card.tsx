import Link from 'next/link'

import { MetricBadge, MetricValue } from '@/components/metric'
import { ReasonList } from '@/components/reason-list'
import { Row } from '@/components/surface'
import { splitReasons } from '@/lib/insight/reasons'
import { congestionTone, suitabilityTone } from '@/lib/insight/tone'
import { messages } from '@/lib/messages'
import type { PlaceSuitabilityResponse } from '@/types/insight'

/**
 * 적합도 행 — 홈-세부명세 D2 · D6.
 *
 * **제목만 링크다.** 안에 "근거 더 보기" 버튼이 있어 행 전체를 링크로 만들면 중첩이 된다
 * (D6 이 D4 와의 충돌을 이렇게 확정했다).
 *
 * **점수가 null 이면 "판단 근거 부족" 이다 — 0 으로 그리지 않는다.** 0점으로 렌더하면
 * 사용자가 "여기는 별로다" 로 읽는다. 등급도 `INSUFFICIENT` 로 온다.
 *
 * 혼잡도는 **적합도와 톤 매핑이 반대다** — `congestionTone` 을 쓴다.
 */
export function SuitabilityCard({
  data,
  last = false,
}: {
  data: PlaceSuitabilityResponse
  last?: boolean
}) {
  const tone = suitabilityTone(data.suitabilityLevel.code)
  const { penalties, informational } = splitReasons(data.reasons)
  const congestion = data.congestion

  return (
    <Row as="li" last={last}>
      <article className="py-4">
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-title-2 text-fg min-w-0 font-semibold break-words">
            <Link
              href={`/places/${data.placeId}`}
              // 제목만 링크이므로(D6) 이 링크가 유일한 진입 타깃이다. 44px 를 준다
              className="focus-visible:ring-brand-500 inline-flex min-h-11 items-center rounded-sm focus-visible:ring-2 focus-visible:outline-none"
            >
              {data.placeTitle}
            </Link>
          </h3>
          {/* 배지가 밀리지 않게 shrink-0 (D1) */}
          <div className="shrink-0">
            <MetricBadge tone={tone}>{data.suitabilityLevel.name}</MetricBadge>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-end gap-6">
          {data.score === null ? (
            <p className="text-body-2 text-fg-muted">{messages.home.scoreUnavailable}</p>
          ) : (
            <MetricValue value={data.score} unit="/100" tone={tone} />
          )}

          {/* 혼잡도. UNKNOWN 이면 색 배지를 주지 않고 문장으로 말한다 (D5-2 주의 3) */}
          {congestion !== null &&
            (congestion.level.code === 'UNKNOWN' ? (
              <p className="text-body-2 text-fg-muted">{messages.home.congestionUnknown}</p>
            ) : (
              <MetricBadge tone={congestionTone(congestion.level.code)}>
                {congestion.level.name}
              </MetricBadge>
            ))}
        </div>

        {/* 서버 순서 유지. 감점이 먼저 오고 정보성은 한 단계 흐리다 */}
        <ReasonList
          className="mt-3"
          reasons={[
            ...penalties.map((reason) => ({ description: reason.description })),
            ...informational.map((reason) => ({
              description: reason.description,
              informational: true,
            })),
          ]}
          moreLabel={messages.home.moreReasons.replace('{n}', '%d')}
          lessLabel={messages.home.lessReasons}
        />
      </article>
    </Row>
  )
}
