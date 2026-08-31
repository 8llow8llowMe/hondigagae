'use client'

import { useRouter } from 'next/navigation'

import { BackLink } from '@/components/back-link'
import { ButtonLink } from '@/components/button'
import { EmptyState } from '@/components/empty-state'
import { ErrorState } from '@/components/error-state'
import { FormAlert } from '@/components/form-alert'
import { PlaceFilterChips } from '@/features/place/place-filter-chips'
import { PlaceListSection } from '@/features/place/place-list-section'
import { usePlaceList } from '@/features/place/use-place-list'
import { PlanAddPlaceRow } from '@/features/plan/plan-add-place-row'
import { planDayAnchorId } from '@/features/plan/plan-day-section'
import { usePlanAddPlace } from '@/features/plan/use-plan-add-place'
import { usePlanDetail } from '@/features/plan/use-plan-detail'
import { ApiError, toErrorStatus } from '@/lib/api/error'
import { mergeSlices } from '@/lib/api/slice'
import { messages } from '@/lib/messages'
import { placeIdsOf } from '@/lib/plan/day-items'
import { groupItemsByDay } from '@/lib/plan/detail'
import type { PlaceFilters } from '@/types/place'

/**
 * 장소를 골라 일자에 담는 화면 — 세부명세 F2.
 *
 * **모달·시트가 아니라 라우트다** (F5-1). 장소 목록이 필터 + 무한 스크롤이라 모달에
 * 담기 무겁고, 모달 안 무한 스크롤은 배경 스크롤 잠금과 충돌한다. 라우트면 상태를 URL 이
 * 갖는다 — 뒤로가기가 자연스럽고 새로고침에서 살아남는다.
 *
 * **일정 상세와 같은 캐시를 쓴다** (`planKeys.detail`). 담기 저장이 응답으로 상세를
 * 갈아끼우므로 돌아가면 이미 최신이다 — 다시 조회하지 않는다.
 */
export function PlanAddPlaceView({
  planId,
  day,
  filters,
}: {
  planId: string
  day: number
  filters: PlaceFilters
}) {
  const router = useRouter()
  const detail = usePlanDetail(planId)
  const list = usePlaceList(filters)

  const addPlace = usePlanAddPlace({
    planId,
    /*
      **성공하면 그 일자로 돌아간다** (F2). 저장을 먼저 하고 이동하므로 실패하면
      목록에 남아 같은 버튼으로 다시 시도할 수 있다.

      `replace` 다 — 끝난 단계를 히스토리에 남기면 뒤로가기가 "이미 담았어요" 로 잠긴
      목록으로 되돌아간다.
    */
    onAdded: () => router.replace(`/plans/${planId}#${planDayAnchorId(day)}`),
  })

  const backHref = `/plans/${planId}#${planDayAnchorId(day)}`

  if (detail.isPending) return null

  if (detail.isError) {
    // 400(숫자가 아닌 planId)은 재시도로 풀리지 않는다 — 상세 화면과 같은 판단 (D5)
    if (detail.error instanceof ApiError && detail.error.status === 400) {
      return (
        <PlanAddPlaceEmpty
          title={messages.plan.detailBadRequestTitle}
          description={messages.plan.detailBadRequestDescription}
        />
      )
    }

    return (
      <ErrorState
        title={messages.plan.detailErrorTitle}
        description={messages.plan.errorDescription}
        onRetry={() => void detail.refetch()}
      />
    )
  }

  if (detail.data === undefined) return null

  const { days } = groupItemsByDay(detail.data.items, detail.data.totalDays)
  const group = days[day - 1]

  /*
    **기간 밖 일자를 화면에서 먼저 막는다.** 그대로 담기를 보내면 `PLAN_002` 를 받는데,
    고르고 나서 실패하는 것보다 고르기 전에 말해 주는 편이 낫다. 주소를 손으로 고쳐
    들어올 수 있으므로 라우트만으로는 막을 수 없다.
  */
  if (group === undefined) {
    return (
      <PlanAddPlaceEmpty
        title={messages.plan.addPlaceDayMissingTitle.replace('{day}', String(day))}
        description={messages.plan.addPlaceDayMissingDescription.replace(
          '{totalDays}',
          String(detail.data.totalDays),
        )}
        backHref={`/plans/${planId}`}
      />
    )
  }

  const places = list.data === undefined ? [] : mergeSlices(list.data.pages)
  const lastPage = list.data?.pages.at(-1)
  const addedPlaceIds = placeIdsOf(group.items)

  return (
    <>
      <header className="px-4 pt-5 pb-3 md:px-10 lg:pt-6">
        <BackLink href={backHref} label={messages.plan.addPlaceBack} className="-ml-1" />
        <h1 className="text-title-1 text-fg lg:text-display mt-1 font-bold lg:font-extrabold">
          {messages.plan.addPlaceTitle.replace('{day}', String(day))}
        </h1>
        <p className="text-caption text-fg-muted mt-1 font-medium">
          {detail.data.title} · {messages.plan.addPlaceSubtitle.replace('{day}', String(day))}
        </p>

        {/* 담기 실패는 토스트가 아니라 이 자리에 남는다 — 재시도는 같은 버튼이다 */}
        {addPlace.error !== null && (
          <FormAlert
            className="mt-3"
            message={
              addPlace.error.retriable
                ? `${messages.plan.addPlaceErrorTitle} ${addPlace.error.message}`
                : addPlace.error.message
            }
          />
        )}
      </header>

      {/* 데스크톱은 좌측 레일이 같은 일을 한다 (페이지가 렌더) */}
      <div className="lg:hidden">
        <PlaceFilterChips filters={filters} />
      </div>

      <PlaceListSection
        places={places}
        loading={list.isPending}
        errorStatus={toErrorStatus(list.error)}
        errorMessage={list.error instanceof ApiError ? list.error.rawMessage : undefined}
        hasNext={lastPage?.hasNext ?? false}
        loadingMore={list.isFetchingNextPage}
        onLoadMore={() => void list.fetchNextPage()}
        onRetry={() => void list.refetch()}
        onResetFilters={() => router.replace(`/plans/${planId}/days/${day}/add`, { scroll: false })}
        renderRow={(place, last) => (
          <PlanAddPlaceRow
            key={place.placeId}
            place={place}
            last={last}
            added={addedPlaceIds.has(place.placeId)}
            pending={addPlace.pendingPlaceId === place.placeId}
            disabled={addPlace.adding}
            onAdd={(selected) =>
              addPlace.add({
                day,
                // **그 일자의 현재 항목 전부**를 되싣는다 — 일괄 교체다 (E1)
                dayItems: group.items,
                place: { placeId: selected.placeId, title: selected.title },
              })
            }
          />
        )}
      />
    </>
  )
}

function PlanAddPlaceEmpty({
  title,
  description,
  backHref,
}: {
  title: string
  description: string
  backHref?: string
}) {
  return (
    <EmptyState
      title={title}
      description={description}
      action={
        backHref === undefined ? undefined : (
          <ButtonLink href={backHref} variant="secondary">
            {messages.plan.addPlaceBack}
          </ButtonLink>
        )
      }
    />
  )
}
