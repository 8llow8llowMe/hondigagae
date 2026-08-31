'use client'

import { RowList } from '@/components/surface'
import { PlanDayVerdict } from '@/features/plan/plan-day-verdict'
import { PlanIndoorAlternatives } from '@/features/plan/plan-indoor-alts'
import { PlanItemRow } from '@/features/plan/plan-item-row'
import { messages } from '@/lib/messages'
import { weekdayOf } from '@/lib/plan/date'
import type { PlanItemRowModel } from '@/lib/plan/detail'
import type { PlaceDetail } from '@/types/place'
import type { PlanDayWeatherItem } from '@/types/plan'

/** 좌측 목차의 앵커 대상. 목차와 제목이 같은 규칙으로 id 를 만들어야 링크가 맞는다 */
export function planDayAnchorId(day: number): string {
  return `day${day}`
}

/**
 * 한 일자 — 판정 + 항목들 + 실내 대안.
 *
 * **일자 안은 1px 선으로 잇는다.** 8px 밴드는 일자 경계에만 쓴다 — 밴드가 일자를
 * 나누는 유일한 신호이므로 안쪽에서 쓰면 신호가 죽는다 (아트보드 01 주석).
 *
 * `<section aria-labelledby>` 가 `<h2 id>` 를 가리킨다 (D6).
 */
export function PlanDaySection({
  day,
  date,
  rows,
  places,
  verdict,
  petConditionApplied,
  verdictFailed,
  onRetryVerdict,
}: {
  day: number
  /** `YYYY-MM-DD`. 서버 판정의 날짜가 아니라 일정 기간에서 계산한 값이다 */
  date: string | null
  rows: PlanItemRowModel[]
  /** placeId → 보강 결과. 없으면 그 항목은 제목만 남는다 */
  places: Map<string, PlaceDetail>
  verdict: PlanDayWeatherItem | undefined
  petConditionApplied: boolean
  verdictFailed: boolean
  onRetryVerdict: () => void
}) {
  const anchorId = planDayAnchorId(day)
  const weekday = date === null ? null : weekdayOf(date)

  return (
    <section aria-labelledby={anchorId} className="px-4 md:px-10">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 pt-6">
        <h2 id={anchorId} className="text-title-1 text-fg font-bold">
          {messages.plan.dayLabel.replace('{day}', String(day))}
        </h2>
        {date !== null && (
          <span className="text-body-2 text-fg-muted font-medium tabular-nums">
            {date.slice(5)}
            {weekday === null ? '' : ` (${weekday})`}
          </span>
        )}
      </div>

      <PlanDayVerdict
        verdict={verdict}
        petConditionApplied={petConditionApplied}
        failed={verdictFailed}
        onRetry={onRetryVerdict}
      />

      {rows.length === 0 ? (
        <p className="text-body-2 text-fg-muted border-border border-t py-6">
          {messages.plan.dayEmpty}
        </p>
      ) : (
        // Row 가 자체 좌우 인셋(px-4 / md:px-10)을 갖는다 — 섹션 인셋을 되돌린다
        <RowList className="border-border -mx-4 border-t md:-mx-10">
          {rows.map((row, index) => (
            <PlanItemRow
              key={row.item.planItemId}
              model={row}
              place={row.item.targetId === null ? undefined : places.get(row.item.targetId)}
              last={index === rows.length - 1}
            />
          ))}
        </RowList>
      )}

      <PlanIndoorAlternatives alternatives={verdict?.indoorAlternatives ?? []} />
    </section>
  )
}
