'use client'

import { useMemo, useState } from 'react'

import { Badge } from '@/components/badge'
import { ButtonLink } from '@/components/button'
import { EmptyState } from '@/components/empty-state'
import { planDayAnchorId } from '@/features/plan/plan-day-section'
import { PlanRouteMap } from '@/features/plan/plan-route-map'
import { directionsUrl } from '@/lib/geo/map-link'
import { messages } from '@/lib/messages'
import type { BriefingTarget } from '@/lib/plan/briefing'
import { basisItemId, nextDestination, toPlanRouteModel } from '@/lib/plan/briefing-day'
import { planItemMapCoord } from '@/lib/plan/detail'
import { fillTemplate } from '@/lib/text/template'
import { INSET_CLASS } from '@/lib/ui/inset'
import { cn } from '@/lib/utils/cn'
import type { PlanItemDetail } from '@/types/plan'

/** 브리핑이 상세에서 고른 그날 (#1415 D15-2) — 뷰가 `groupItemsByDay` · `lodgingBasisFor` 로 만든다 */
export type BriefingDayPlan = {
  items: PlanItemDetail[]
  lodgingBasis: PlanItemDetail | null
}

/** 빈 날 — 예전 `ScheduleCard` 의 것을 옮겼다. 두 카드가 같이 쓴다 */
export function BriefingScheduleEmpty({ planId, day }: { planId: string; day: number }) {
  return (
    <EmptyState
      title={messages.plan.briefingScheduleEmptyTitle}
      inset="card"
      headingLevel={3}
      action={
        <ButtonLink href={`/plans/${planId}/days/${day}/add`} variant="secondary" size="sm">
          {messages.plan.briefingScheduleEmptyAction}
        </ButtonLink>
      }
    />
  )
}

/**
 * 그날 일정 전체 · 동선 지도 (#1415 · 여행브리핑-세부명세 D15). **읽기 전용** — 행은 링크가 아니고 방문 체크도
 * 없다. 체크는 `이 날 일정 보기`(상세)에서 한다. 지도가 실패하면 지도만 접힌다(D15-5).
 */
export function BriefingDayTimeline({
  planId,
  day,
  kind,
  plan,
  representativePlaceId,
  representativePlaceTitle,
}: {
  planId: string
  day: number
  kind: BriefingTarget['kind']
  plan: BriefingDayPlan
  representativePlaceId: string | null
  representativePlaceTitle: string | null
}) {
  const [mapFailed, setMapFailed] = useState(false)
  const model = useMemo(() => toPlanRouteModel(plan.items, plan.lodgingBasis), [plan])

  if (plan.items.length === 0) return <BriefingScheduleEmpty planId={planId} day={day} />

  const orderOf = new Map(model.stops.map((stop) => [stop.id, stop.order]))
  const basisId = basisItemId(plan.items, representativePlaceId)
  const visited = plan.items.filter((item) => item.visited).length
  const next = nextDestination(plan.items, kind)
  const nextCoord = next === null ? null : planItemMapCoord(next)
  const directions =
    next === null || nextCoord === null
      ? null
      : directionsUrl({ name: next.title, lat: nextCoord.lat, lng: nextCoord.lng })

  return (
    <div className={cn('flex flex-col items-stretch gap-3 pb-4', INSET_CLASS.card)}>
      <p className="text-body-2 text-fg tabular-nums">
        {messages.plan.briefingScheduleCounts
          .replace('{count}', String(plan.items.length))
          .replace('{visited}', String(visited))}
      </p>

      <ol>
        {plan.items.map((item, index) => (
          <TimelineRow
            key={item.planItemId}
            item={item}
            order={orderOf.get(item.planItemId) ?? null}
            basis={item.planItemId === basisId}
            connected={index < plan.items.length - 1}
          />
        ))}
      </ol>

      {/* 기준 장소가 그날 항목에 없는 갈래 (D15-3) */}
      {basisId === null && representativePlaceTitle !== null && (
        <p className="text-caption text-fg-muted break-keep">
          {fillTemplate(messages.plan.briefingScheduleBasisPlace, {
            title: representativePlaceTitle,
          })}
        </p>
      )}

      {!mapFailed && <PlanRouteMap model={model} day={day} onFailure={() => setMapFailed(true)} />}

      {model.omittedCount > 0 && (
        <p className="text-caption text-fg-subtle">
          {messages.map.routeOmitted.replace('{n}', String(model.omittedCount))}
        </p>
      )}

      {directions !== null && next !== null && (
        <a
          href={directions}
          target="_blank"
          rel="noopener noreferrer"
          className="border-border-strong text-fg hover:bg-band focus-visible:ring-brand-500 text-body-2 flex h-11 items-center justify-center rounded-md border px-4 font-semibold break-keep focus-visible:ring-2 focus-visible:outline-none"
        >
          {fillTemplate(messages.plan.briefingScheduleDirections, { title: next.title })}
        </a>
      )}

      <ButtonLink
        href={`/plans/${planId}#${planDayAnchorId(day)}`}
        variant="primary"
        size="md"
        className="w-full"
      >
        {messages.plan.briefingScheduleOpenDay}
      </ButtonLink>
    </div>
  )
}

function TimelineRow({
  item,
  order,
  basis,
  connected,
}: {
  item: PlanItemDetail
  order: number | null
  basis: boolean
  connected: boolean
}) {
  return (
    <li
      data-visited={item.visited ? 'true' : undefined}
      className={cn('flex gap-3 pb-4 last:pb-0', item.visited ? 'text-fg-muted' : 'text-fg')}
    >
      <span className="flex w-6 shrink-0 flex-col items-center">
        {order === null ? (
          <span aria-hidden className="bg-border-strong mt-2 size-2 shrink-0 rounded-full" />
        ) : (
          // 지도의 순번 핀(`.map-pin-order`)과 같은 모양 — 흰 원 · `--fg-subtle` 테두리
          <span
            data-route-order={order}
            className="bg-bg text-fg border-fg-subtle text-caption flex size-6 shrink-0 items-center justify-center rounded-full border font-bold tabular-nums"
          >
            {order}
          </span>
        )}
        {connected && <span aria-hidden className="bg-border w-px flex-1" />}
      </span>

      <div className="min-w-0 flex-1">
        <p className="text-body-1 font-semibold break-keep">
          {item.startTime !== null && (
            <span className="text-fg-muted tabular-nums">{item.startTime.slice(0, 5)} </span>
          )}
          {item.title}
        </p>
        {/* 서버 `itemType.name` 을 그대로 쓴다 — FE 에 한국어 매핑 테이블을 만들지 않는다 */}
        <span className="mt-1 flex flex-wrap items-center gap-1.5">
          <Badge tone="neutral" size="sm">
            <span className="sr-only">{messages.plan.briefingScheduleTypeLabel} </span>
            {item.itemType.name}
          </Badge>
          {basis && (
            <Badge tone="neutral" size="sm" strong>
              {messages.plan.briefingScheduleBasisTag}
            </Badge>
          )}
          {item.visited && (
            <Badge tone="neutral" size="sm">
              {messages.plan.briefingScheduleVisited}
            </Badge>
          )}
        </span>
      </div>
    </li>
  )
}
