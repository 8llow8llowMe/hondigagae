'use client'

import { useRouter } from 'next/navigation'

import type { ReactNode } from 'react'

import { BackLink } from '@/components/back-link'
import { ButtonLink } from '@/components/button'
import { EmptyState } from '@/components/empty-state'
import { ErrorState } from '@/components/error-state'
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

  /*
    **담기에 성공해도 화면에 남는다** (#370). 원래는 그 일자로 `replace` 이동했는데
    (일자편집 명세 F5), 지도 보기에서 하루 동선을 짜려면 여러 곳을 연달아 담아야 해서
    담자마자 나가면 지도로 바꾼 의미가 없다.

    **피드백이 사라지지는 않는다.** `usePlanAddPlace` 가 토스트를 띄우고, 응답이
    `planKeys.detail` 을 갈아끼우므로 그 행이 곧바로 `이미 담았어요` 로 바뀐다.
    돌아가기는 헤더의 `일정으로 돌아가기` 가 맡는다.
  */
  const addPlace = usePlanAddPlace({ planId })

  const backHref = `/plans/${planId}#${planDayAnchorId(day)}`

  /*
    **`return null` 이 아니라 껍데기를 세운다.** 이 세그먼트에는 `loading.tsx` 를
    의도적으로 두지 않았으므로(soft 404 회피) 여기서 비우면 프리페치가 실패했을 때
    화면이 통째로 빈다. 제목은 `day` 만으로 쓸 수 있어 기다릴 이유가 없다.
  */
  if (detail.isPending) {
    return (
      <PlanAddPlaceShell day={day} backHref={backHref}>
        <PlaceListSection
          places={[]}
          loading
          errorStatus={null}
          hasNext={false}
          loadingMore={false}
          onLoadMore={() => undefined}
          onRetry={() => undefined}
          onResetFilters={() => undefined}
        />
      </PlanAddPlaceShell>
    )
  }

  if (detail.isError) {
    // 400(숫자가 아닌 planId)은 재시도로 풀리지 않는다 — 상세 화면과 같은 판단 (D5)
    if (detail.error instanceof ApiError && detail.error.status === 400) {
      return (
        <PlanAddPlaceShell day={day} backHref={backHref}>
          <EmptyState
            title={messages.plan.detailBadRequestTitle}
            description={messages.plan.detailBadRequestDescription}
          />
        </PlanAddPlaceShell>
      )
    }

    return (
      <PlanAddPlaceShell day={day} backHref={backHref}>
        <ErrorState
          title={messages.plan.detailErrorTitle}
          description={messages.plan.errorDescription}
          onRetry={() => void detail.refetch()}
        />
      </PlanAddPlaceShell>
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
      <PlanAddPlaceShell day={day} backHref={`/plans/${planId}`}>
        <EmptyState
          title={messages.plan.addPlaceDayMissingTitle.replace('{day}', String(day))}
          description={messages.plan.addPlaceDayMissingDescription.replace(
            '{totalDays}',
            String(detail.data.totalDays),
          )}
          action={
            <ButtonLink href={`/plans/${planId}`} variant="secondary">
              {messages.plan.addPlaceBack}
            </ButtonLink>
          }
        />
      </PlanAddPlaceShell>
    )
  }

  const places = list.data === undefined ? [] : mergeSlices(list.data.pages)
  const lastPage = list.data?.pages.at(-1)
  const addedPlaceIds = placeIdsOf(group.items)

  return (
    <PlanAddPlaceShell day={day} backHref={backHref} planTitle={detail.data.title}>
      {/* 데스크톱은 좌측 레일이 같은 일을 한다 (페이지가 렌더) */}
      <div className="lg:hidden">
        {/* `/plans` 는 proxy.ts `PROTECTED_PATHS` 라 미로그인이 여기 닿지 않는다 (#200) */}
        <PlaceFilterChips filters={filters} authed />
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
            pending={addPlace.pending?.placeId === place.placeId}
            disabled={addPlace.adding}
            /* 실패를 그 행에 남긴다 — 헤더에 모으면 스크롤 아래에서는 보이지 않는다 (F4) */
            error={
              addPlace.failure?.target.placeId === place.placeId ? addPlace.failure.error : null
            }
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
    </PlanAddPlaceShell>
  )
}

/**
 * 모든 변형이 공유하는 껍데기 — 뒤로가기 · `h1` · 부제.
 *
 * **오류·빈 상태에도 `h1` 이 있어야 한다.** 없으면 문서의 최상위 제목이 필터의
 * `h2 "필터"` 가 되어, 스크린리더 사용자가 무슨 화면인지 알 수 없다 (실측으로 잡았다).
 */
function PlanAddPlaceShell({
  day,
  backHref,
  planTitle,
  children,
}: {
  day: number
  backHref: string
  /** 아직 못 받았으면 생략한다 — 제목은 `day` 만으로 쓸 수 있다 */
  planTitle?: string
  children: ReactNode
}) {
  const subtitle = messages.plan.addPlaceSubtitle.replace('{day}', String(day))

  return (
    <>
      <header className="px-4 pt-5 pb-3 md:px-10 lg:pt-6">
        <BackLink href={backHref} label={messages.plan.addPlaceBack} className="-ml-1" />
        <h1 className="text-title-1 text-fg lg:text-display mt-1 font-bold lg:font-extrabold">
          {messages.plan.addPlaceTitle.replace('{day}', String(day))}
        </h1>
        <p className="text-caption text-fg-muted mt-1 font-medium">
          {planTitle === undefined ? subtitle : `${planTitle} · ${subtitle}`}
        </p>
      </header>

      {children}
    </>
  )
}
