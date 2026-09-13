'use client'

import { useRouter } from 'next/navigation'

import type { ReactNode } from 'react'

import { ButtonLink } from '@/components/button'
import { EmptyState } from '@/components/empty-state'
import { ErrorState } from '@/components/error-state'
import { Surface, SurfaceStack } from '@/components/surface'
import { PlaceFilterChips } from '@/features/place/place-filter-chips'
import { PlaceListSection } from '@/features/place/place-list-section'
import { PlaceMapView } from '@/features/place/place-map-view'
import { usePlaceList } from '@/features/place/use-place-list'
import { planAddPlaceAction, planAddPlaceNotice } from '@/features/plan/plan-add-place-action'
import { PlanAddPlaceHeader } from '@/features/plan/plan-add-place-header'
import { PlanAddPlaceRow } from '@/features/plan/plan-add-place-row'
import { planDayAnchorId } from '@/features/plan/plan-day-section'
import { usePlanAddPlace } from '@/features/plan/use-plan-add-place'
import { usePlanDetail } from '@/features/plan/use-plan-detail'
import { ApiError, toErrorStatus } from '@/lib/api/error'
import { mergeSlices } from '@/lib/api/slice'
import { messages } from '@/lib/messages'
import { placeIdsOf } from '@/lib/plan/day-items'
import { groupItemsByDay } from '@/lib/plan/detail'
import { PLAN_ADD_DEFAULT_VIEW, type ViewMode, viewModeHref } from '@/lib/url/view-mode'
import type { PlaceFilters, PlaceSummary } from '@/types/place'

/**
 * 모바일 시트를 끝까지 올렸을 때 **비워 둘 상단 높이**(px).
 *
 * 이 화면은 헤더가 정상 흐름이라 시트 기본 상한(`85dvh`)이 제목·보기 전환·부제를 덮는다
 * — 375×812 실측으로 시트 상단이 y=122 인데 헤더가 y=56~189 를 쓴다. 남는 것은
 * `일정으로 돌아가기` 뿐이고 그마저 2px 차이다.
 *
 * **비율이 아니라 px 이다.** 비율은 기기가 작을수록 더 덮는다(667px 기기면 상단이
 * y=100 으로 내려간다). 헤더 높이는 기기 높이와 무관하게 거의 일정하다.
 *
 * 240 은 헤더(실측 189)에 약 50px 을 더한 값이다 — 지도가 한 줄이라도 남아야 시트가
 * "페이지" 가 아니라 "지도 위에 얹힌 것" 으로 읽힌다. 일정 제목이 길어 부제가 두 줄이
 * 되면 부제 끝만 잘리고 제목과 토글은 남는다.
 */
const SHEET_MAX_TOP_INSET = 240

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
  view,
  listHref,
  mapHref,
}: {
  planId: string
  day: number
  filters: PlaceFilters
  view: ViewMode
  listHref: string
  mapHref: string
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

  /** 필터만 비운다. **보기는 유지한다** — 지도에서 조건을 풀었는데 목록으로 튀면 안 된다 */
  const resetHref = viewModeHref(
    `/plans/${planId}/days/${String(day)}/add`,
    '',
    view,
    PLAN_ADD_DEFAULT_VIEW,
  )

  /*
    **`return null` 이 아니라 껍데기를 세운다.** 이 세그먼트에는 `loading.tsx` 를
    의도적으로 두지 않았으므로(soft 404 회피) 여기서 비우면 프리페치가 실패했을 때
    화면이 통째로 빈다. 제목은 `day` 만으로 쓸 수 있어 기다릴 이유가 없다.
  */
  if (detail.isPending) {
    return (
      <PlanAddPlaceShell
        day={day}
        backHref={backHref}
        listHref={listHref}
        mapHref={mapHref}
        view={view}
      >
        <PlaceListSection
          /* 인셋을 넘기지 않는다 — 기본 `card`(16/20)가 카드 안 행(`PlanAddPlaceRow`)과 같은 값이다 (#451) */
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
        <PlanAddPlaceShell
          day={day}
          backHref={backHref}
          listHref={listHref}
          mapHref={mapHref}
          view={view}
        >
          <EmptyState
            inset="card"
            title={messages.plan.detailBadRequestTitle}
            description={messages.plan.detailBadRequestDescription}
          />
        </PlanAddPlaceShell>
      )
    }

    return (
      <PlanAddPlaceShell
        day={day}
        backHref={backHref}
        listHref={listHref}
        mapHref={mapHref}
        view={view}
      >
        <ErrorState
          inset="card"
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
      <PlanAddPlaceShell
        day={day}
        backHref={`/plans/${planId}`}
        listHref={listHref}
        mapHref={mapHref}
        view={view}
      >
        <EmptyState
          inset="card"
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

  const onAdd = (selected: PlaceSummary) =>
    addPlace.add({
      day,
      // **그 일자의 현재 항목 전부**를 되싣는다 — 일괄 교체다 (E1)
      dayItems: group.items,
      place: { placeId: selected.placeId, title: selected.title },
    })

  if (view === 'map') {
    return (
      /*
        **높이를 여기서 잡는다.** 헤더가 정상 흐름으로 서고 남는 높이를 지도가 채운다 —
        `PlaceMapView` 에 `map-canvas-height` 를 맡기면 헤더 높이만큼 넘쳐 지도 화면에
        세로 스크롤이 난다.
      */
      <div className="map-canvas-height flex flex-col">
        <PlanAddPlaceHeader
          day={day}
          backHref={backHref}
          planTitle={detail.data.title}
          listHref={listHref}
          mapHref={mapHref}
          view="map"
        />

        <div className="min-h-0 flex-1">
          <PlaceMapView
            filters={filters}
            authed
            fill
            /* 헤더가 토글을 가지므로 `listHref`/`mapHref` 를 주지 않는다 */
            sheetMaxTopInset={SHEET_MAX_TOP_INSET}
            mutedPlaceIds={addedPlaceIds}
            renderRowAction={(place) =>
              planAddPlaceAction(place, {
                addedPlaceIds,
                pendingPlaceId: addPlace.pending?.placeId ?? null,
                disabled: addPlace.adding,
                onAdd,
              })
            }
            renderRowNotice={(place) => planAddPlaceNotice(place, { failure: addPlace.failure })}
            /* **SDK 가 실패해도 담을 수 있어야 한다.** 없으면 열람 전용 화면이 된다 */
            renderListRow={(place) => (
              <PlanAddPlaceRow
                key={place.placeId}
                /*
                  **지도 폴백은 카드가 아니라 페이지 위다** — `PlaceListSection` 도 그쪽에서
                  `inset="main"` 이고 위 안내 줄이 `md:px-10` 이라, 행이 기본값 `card`(20)로
                  서면 768 이상에서 안내 줄·스켈레톤(40)과 어긋난다 (`place-map-view.tsx`).
                */
                inset="main"
                place={place}
                added={addedPlaceIds.has(place.placeId)}
                pending={addPlace.pending?.placeId === place.placeId}
                disabled={addPlace.adding}
                error={
                  addPlace.failure?.target.placeId === place.placeId ? addPlace.failure.error : null
                }
                onAdd={onAdd}
              />
            )}
          />
        </div>
      </div>
    )
  }

  return (
    <PlanAddPlaceShell
      day={day}
      backHref={backHref}
      planTitle={detail.data.title}
      listHref={listHref}
      mapHref={mapHref}
      view={view}
      tools={
        /* 데스크톱은 좌측 레일이 같은 일을 한다 (페이지가 렌더) */
        <div className="lg:hidden">
          {/* `/plans` 는 proxy.ts `PROTECTED_PATHS` 라 미로그인이 여기 닿지 않는다 (#200) */}
          <PlaceFilterChips filters={filters} authed />
        </div>
      }
    >
      <PlaceListSection
        /*
          **인셋을 넘기지 않는다** (#451). 기본값 `card`(16/20)가 곧 이 목록의 자리다 —
          행(`PlanAddPlaceRow`)도 카드 안에서 같은 값을 쓴다. 하나라도 어긋나면 목록이
          실데이터로 바뀌는 순간 왼쪽 선이 뛴다.

          **`headingLevel` 도 넘기지 않는다** (#456①). 카드 안이지만 `PlanAddPlaceShell` 의
          카드는 `aria-label` 만 갖고 `h2` 를 그리지 않는다 — 위가 페이지 `h1` 하나라
          기본값 `2` 가 맞다. **`inset` 이 `card` 라고 해서 `h3` 가 되지는 않는다.**
        */
        places={places}
        loading={list.isPending}
        errorStatus={toErrorStatus(list.error)}
        errorMessage={list.error instanceof ApiError ? list.error.rawMessage : undefined}
        hasNext={lastPage?.hasNext ?? false}
        loadingMore={list.isFetchingNextPage}
        onLoadMore={() => void list.fetchNextPage()}
        onRetry={() => void list.refetch()}
        onResetFilters={() => router.replace(resetHref, { scroll: false })}
        renderRow={(place) => (
          <PlanAddPlaceRow
            key={place.placeId}
            place={place}
            added={addedPlaceIds.has(place.placeId)}
            pending={addPlace.pending?.placeId === place.placeId}
            disabled={addPlace.adding}
            /* 실패를 그 행에 남긴다 — 헤더에 모으면 스크롤 아래에서는 보이지 않는다 (F4) */
            error={
              addPlace.failure?.target.placeId === place.placeId ? addPlace.failure.error : null
            }
            onAdd={onAdd}
          />
        )}
      />
    </PlanAddPlaceShell>
  )
}

/**
 * 목록 갈래의 모든 상태가 공유하는 껍데기 — 뒤로가기 · `h1` · 부제 + L1 카드 하나.
 *
 * **오류·빈 상태에도 `h1` 이 있어야 한다.** 없으면 문서의 최상위 제목이 필터의
 * `h2 "필터"` 가 되어, 스크린리더 사용자가 무슨 화면인지 알 수 없다 (실측으로 잡았다).
 *
 * **3층 표면이다** (`DESIGN.md §0`, #451). 페이지가 `Canvas` 로 L0 바닥을 깔고 여기서
 * `SurfaceStack` 이 그 위에 쌓는다.
 *
 * **카드를 여기서 그린다.** 상태마다 `Surface` 를 반복하면 로딩·오류·빈 결과 중 하나만
 * 빠뜨려도 카드가 생겼다 사라진다 — 상태에 따라 표면이 바뀌면 안 된다 (#440 판단).
 * 그래서 `children` 은 항상 카드 안이고, **카드 밖에 서야 하는 필터 칩만 `tools` 로
 * 따로 받는다** — 칩은 목록을 좁히는 도구이고 카드는 그 결과를 담는다 (#439 · #440).
 *
 * **카드에 제목을 주지 않고 `aria-label` 로 이름만 붙인다.** 장소 목록(#439)은 페이지
 * 제목을 카드 제목(`h2`)으로 넣고 `h1` 을 `sr-only` 로 돌렸지만, 이 화면의 머리는
 * 뒤로가기 · `h1` · 보기 토글 · 부제로 된 **페이지 머리**이고 **지도 갈래와 같은
 * 컴포넌트를 쓴다** — 지도에서는 `sr-only` 로 숨길 수 없고(#370, `plan-add-place-map.test.ts`
 * 가 강제한다) 두 갈래가 같은 `h1` 을 내야 보기 전환이 문서 구조를 바꾸지 않는다(#439 의
 * 규칙). 머리가 이름을 이미 그리므로 카드는 `aria-label` 만 갖는다 — 장소 상세(#443) ·
 * 일정 상세(#447)의 일자 카드와 같은 방식이다.
 */
function PlanAddPlaceShell({
  day,
  backHref,
  planTitle,
  listHref,
  mapHref,
  view,
  tools,
  children,
}: {
  day: number
  backHref: string
  /** 아직 못 받았으면 생략한다 — 제목은 `day` 만으로 쓸 수 있다 */
  planTitle?: string | undefined
  listHref: string
  mapHref: string
  view: ViewMode
  /** 카드 **밖**에 서는 도구 (모바일 필터 칩). 없으면 그 줄 자체가 없다 */
  tools?: ReactNode
  children: ReactNode
}) {
  return (
    <SurfaceStack>
      <PlanAddPlaceHeader
        day={day}
        backHref={backHref}
        planTitle={planTitle}
        listHref={listHref}
        mapHref={mapHref}
        view={view}
        /* L0 위 페이지 머리지만 글줄은 카드 안과 같은 축이다 */
        inset="card"
      />

      {tools}

      <Surface aria-label={messages.plan.addPlaceTitle.replace('{day}', String(day))}>
        {children}
      </Surface>
    </SurfaceStack>
  )
}
