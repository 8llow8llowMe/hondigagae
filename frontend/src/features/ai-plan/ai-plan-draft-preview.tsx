import type { ReactNode } from 'react'

import { Badge } from '@/components/badge'
import { EmptyState } from '@/components/empty-state'
import { ReasonList } from '@/components/reason-list'
import { AiPlanDraftItemRow } from '@/features/ai-plan/ai-plan-draft-item-row'
import { formatBudget } from '@/lib/ai-plan/budget'
import { draftItemDistances } from '@/lib/ai-plan/draft-distance'
import { draftItemCount } from '@/lib/ai-plan/draft-to-plan'
import type { LatLng } from '@/lib/geo/coord'
import { messages } from '@/lib/messages'
import { formatPlanDateRange } from '@/lib/plan/date'
import type { AiPlanDraft, AiPlanScheduleItem } from '@/types/ai-plan'

export type AiPlanDraftPreviewProps = {
  draft: AiPlanDraft
  title: string
  startDate: string
  endDate: string
  /** 원 단위. 정하지 않았으면 null */
  budget: number | null
  /** 기간에서 센 총 일수. 못 셌으면 null */
  totalDays: number | null
  /**
   * `placeId` → 메타 줄 (`제주시 한림읍 · 야외`). 보강 결과 (명세 S6 · #112).
   * 조립은 `use-draft-places.ts` 가 한다 — 이 컴포넌트는 표시 전용이다.
   */
  metaLines: ReadonlyMap<string, string>
  /**
   * `placeId` → 좌표. 같은 보강 결과에서 나온다 (#100). **없는 항목은 거리 줄이 없다** —
   * 보강이 아직이거나 실패했거나 원천에 좌표가 없는 경우다.
   */
  coords: ReadonlyMap<string, LatLng>
  /**
   * 담을 수 없는 `placeId` — `PLAN_004` 원인 후보. 상세 응답의 `delisted: true`(200)와
   * 병합(404)이 함께 들어 있다 (#146)
   */
  delistedPlaceIds: ReadonlySet<string>
  /** 담기에서 빼기로 표시한 `placeId` */
  excludedPlaceIds: ReadonlySet<string>
  /** 하단 담기 영역 */
  footer: ReactNode
}

/**
 * 초안 미리보기 — 아트보드 03 · 명세 S6.
 *
 * 아트보드에서 빼는 것 (명세 S2):
 *  - **일자별 적합도 배지(`주의`·`양호`)** — 판정은 `GET /plans/{planId}/weather` 인데
 *    담기 전에는 `planId` 가 없다
 *  - **`이 날 다시 만들기`** — 일자 단위 재생성은 `planId` 가 필요해 담은 뒤에만 가능하다
 *    (계약은 `af86c98` 에서 생겼다. 명세 S2 의 "재생성 API 가 없다" 는 낡았다)
 *  - **`이 날 산책`** — 대상 `placeId` 를 고를 근거가 초안에 없다
 *  - **`말로 고치기`** — 수정 API 가 없다
 *
 * 표시 전용이라 node 환경에서 렌더 테스트가 된다.
 */
export function AiPlanDraftPreview({
  draft,
  title,
  startDate,
  endDate,
  budget,
  totalDays,
  metaLines,
  coords,
  delistedPlaceIds,
  excludedPlaceIds,
  footer,
}: AiPlanDraftPreviewProps) {
  const itemCount = draftItemCount(draft)
  const budgetLabel = formatBudget(budget)
  const madeDays = draft.days.length

  /*
    **조각을 조립한다.** 조건을 잃으면 기간을 모르는데(명세 S5 함정 1), 한 문장에
    기간을 박아 두면 그때 빈 구분자가 남는다.
  */
  const summary = [
    startDate === '' || endDate === '' ? null : formatPlanDateRange(startDate, endDate),
    messages.aiPlan.previewArea,
    messages.aiPlan.previewItemCount.replace('{count}', String(itemCount)),
    budgetLabel === null ? null : messages.aiPlan.previewBudget.replace('{budget}', budgetLabel),
  ]
    .filter((part): part is string => part !== null)
    .join(' · ')

  /**
   * **`days` 가 여행 일수보다 적어도 감추지 않는다** (명세 S6). `status` 는 `COMPLETED`
   * 인데 일부 일자가 비는 경우다 — 그대로 말하고 나머지는 담은 뒤에 채우라고 안내한다.
   */
  const partial = totalDays !== null && madeDays < totalDays

  /*
    **`placeId` 가 없는 항목은 좌표도 없다.** `MOVE` 다 — 초안에 `WALK` 는 오지 않고(#89),
    나머지 유형은 후보 밖 장소라 연결이 끊긴 경우에만 `placeId` 가 비어 있다.
  */
  const coordOf = (item: AiPlanScheduleItem): LatLng | null =>
    item.placeId === null ? null : (coords.get(item.placeId) ?? null)

  if (madeDays === 0) {
    return (
      <>
        <EmptyState
          title={messages.aiPlan.emptyDraftTitle}
          description={messages.aiPlan.emptyDraftDescription}
        />
        {footer}
      </>
    )
  }

  return (
    <div className="flex flex-col">
      <header className="flex flex-col gap-2 px-4 pt-5 pb-4 md:px-10">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-title-1 text-fg font-bold">{title}</h2>
          {/* accent 는 "AI 가 만든 것" 표시 전용이다 (DESIGN.md §2-5 · 아트보드 03 주석) */}
          <Badge tone="accent">{messages.aiPlan.draftBadge}</Badge>
        </div>

        <p className="text-caption text-fg-muted tabular-nums">{summary}</p>

        {/* 저장 시점을 반복해 말한다 — 아트보드 03 주석 */}
        <p className="text-caption text-fg-subtle">{messages.aiPlan.previewNotSaved}</p>
      </header>

      {partial && (
        <div className="bg-band mx-4 mb-4 rounded-md px-3 py-2 md:mx-10">
          <p className="text-body-2 text-fg font-medium">
            {messages.aiPlan.partialDays
              .replace('{total}', String(totalDays))
              .replace('{made}', String(madeDays))}
          </p>
          <p className="text-caption text-fg-muted mt-1">
            {messages.aiPlan.partialDaysDescription}
          </p>
        </div>
      )}

      {/*
        `reasons` 는 **초안 전체에 대한 XAI 라 일자별이 아니다** → 상단에 한 번 낸다
        (명세 S6). 서버 순서를 재정렬하지 않고 문장도 그대로 쓴다.
      */}
      {draft.reasons.length > 0 && (
        <section className="px-4 pb-5 md:px-10">
          <h3 className="text-body-1 text-fg mb-2 font-semibold">{messages.aiPlan.reasonsTitle}</h3>
          <ReasonList
            reasons={draft.reasons.map((reason) => ({ description: reason.description }))}
            moreLabel={messages.aiPlan.reasonsMore}
            lessLabel={messages.aiPlan.reasonsLess}
          />
        </section>
      )}

      {draft.days.map((dayItem) => {
        /*
          **거리는 일자 안에서만 잰다.** 일자 경계를 넘겨 재면 전날 마지막 항목에서
          다음 날 첫 항목까지가 "이동" 으로 읽히는데, 그 사이에는 숙박이 있다.
          빼기로 표시한 항목도 순서에서 빼지 않는다 — 취소선으로 남아 있는 행이라
          거리만 다시 이어 붙이면 화면과 어긋난다.
        */
        const distances = draftItemDistances(dayItem.items, coordOf)

        return (
          <section key={dayItem.day} className="pb-2">
            <h3 className="text-body-1 text-fg px-4 pt-3 pb-2 font-semibold md:px-10">
              {messages.aiPlan.dayLabel.replace('{day}', String(dayItem.day))}
            </h3>

            <ul className="flex flex-col">
              {dayItem.items.map((item, index) => (
                <AiPlanDraftItemRow
                  key={`${dayItem.day}-${index}-${item.title}`}
                  item={item}
                  ordinal={index + 1}
                  meta={item.placeId === null ? undefined : metaLines.get(item.placeId)}
                  distanceMeters={distances[index] ?? null}
                  delisted={item.placeId !== null && delistedPlaceIds.has(item.placeId)}
                  excluded={item.placeId !== null && excludedPlaceIds.has(item.placeId)}
                />
              ))}
            </ul>
          </section>
        )
      })}

      {footer}
    </div>
  )
}
