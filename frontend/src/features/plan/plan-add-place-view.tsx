'use client'

import { useRouter } from 'next/navigation'

import type { ReactNode } from 'react'

import { BackLink } from '@/components/back-link'
import { ButtonLink } from '@/components/button'
import { EmptyState } from '@/components/empty-state'
import { ErrorState } from '@/components/error-state'
import { Surface, SurfaceStack } from '@/components/surface'
import { ViewToggle } from '@/components/view-toggle'
import { PlaceFilterChips } from '@/features/place/place-filter-chips'
import { PlaceListSection } from '@/features/place/place-list-section'
import { PlaceMapView } from '@/features/place/place-map-view'
import { usePlaceList } from '@/features/place/use-place-list'
import { planAddPlaceAction, planAddPlaceNotice } from '@/features/plan/plan-add-place-action'
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
 * y=100 으로 내려간다). 머리 높이는 기기 높이와 무관하게 거의 일정하다.
 *
 * **240 → 140 으로 줄었다** (#556). 머리가 정상 흐름에서 빠져 지도 위에 뜨는 카드가 되면서
 * 실측 189 → 84 가 됐고, 부제도 지도에서는 빼기 때문이다 — 담을 일자는 제목이 이미 말하고,
 * 지도 위 카드는 작을수록 좋다. 140 은 그 84 에 여유 약 56 을 더한 값이다: 시트를 끝까지
 * 올려도 머리와 지도 한 줄이 남아야 시트가 "페이지" 가 아니라 "지도 위에 얹힌 것" 으로 읽힌다.
 */
const SHEET_MAX_TOP_INSET = 140

/**
 * 떠 있는 머리 아래로 좌측 패널을 밀어 내리는 높이(px) — 이슈 #556.
 *
 * **1440 실측**: 머리 카드가 지도 기준 y=24 에서 시작해 높이 100(여백 12×2 + 뒤로가기 44 +
 * 사이 4 + 제목 26)이므로 바닥이 124 다. 카드 사이 12 를 더해 136.
 *
 * 카드 폭이 400 으로 못박혀 있어(`lg:w-100`) 제목이 접히지 않는다 — 그래서 이 높이가
 * 일자 번호와 무관하게 일정하다. `PlaceMapView` 는 위에 무엇이 얹히는지 모르므로 이
 * 화면이 알려 준다.
 */
const PANEL_TOP_INSET = 136

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
        **지도가 상단까지 찬다** (#556). 예전에는 머리가 정상 흐름으로 서고 남는 높이를
        지도가 받았다 — 1920 실측으로 지도가 y≈180 에서 시작했고, 390 에서는 지도 띠가
        머리와 시트 사이 310px 뿐이었다. 머리가 지도 위로 뜨면서 그 자리를 돌려받는다.

        이 `div` 는 이제 **떠 있는 머리의 기준면**이다. 높이는 `map-canvas-height` 가 잡고
        `PlaceMapView` 는 `fill` 로 그것을 그대로 채운다.
      */
      <div className="map-canvas-height relative">
        <div className="h-full">
          <PlaceMapView
            filters={filters}
            authed
            fill
            /*
              **토글을 지도에게 맡긴다** (#556). 머리가 들고 있을 때는 뷰포트 오른쪽 끝
              (1920 실측 1880)에 섰는데, 목록 갈래의 토글은 1440 열 안(1627)이라 보기를
              오갈 때마다 **253px 튀었다** — `/places` 에서 #412 가 이미 고친 증상이다.
              지도가 그리면 콘텐츠 열 오른쪽(1640)에 매달린다.
            */
            listHref={listHref}
            mapHref={mapHref}
            sheetMaxTopInset={SHEET_MAX_TOP_INSET}
            panelTopInset={PANEL_TOP_INSET}
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

        {/*
          ── 떠 있는 머리 — 좌측 패널과 **같은 기둥**이다 (#556)

          **1440 열이 아니라 패널 기둥(`left-4`)에 붙인다.** 열에 맞추면 폭에 따라 그림이
          갈린다 — 1440 이하에서는 `content-container` 가 전폭이라 결국 패널 위(x≈40)에
          겹치고, 1920 에서는 x=561 이라 패널(16~416)과 145px 떨어져 **지도 한복판에 카드가
          혼자 뜬다.** 기둥에 붙이면 1024~1920 어디서나 같은 그림이다.

          목록 갈래와 제목이 x 561 → 28 로 튀지만, 그것은 **지금도 그렇다**(40) — 지도 보기가
          `.rail-layout` 의 1440 캡에 가입하지 않는 화면이기 때문이다 (DESIGN.md §7-1).
          누르는 것(토글)은 두 갈래가 같은 자리에 서고, 읽는 것(제목)만 패널을 따라간다.

          **접히는 패널 안에 넣지 않는다.** `일정으로 돌아가기` 는 이 화면의 유일한 퇴로라
          패널을 접는 순간 나갈 길이 사라진다.

          **곡률은 16(`rounded-xl`)이다.** 옆 패널과 같은 값이고 §5 가 "떠 있는 것" 에 준
          값이다 — L1 카드의 12 를 쓰면 지도 위에 누운 것처럼 보인다.

          모바일은 오른쪽에 떠 있는 토글 자리를 비운다(`end-32`). `pointer-events-none` 은
          바깥 줄이 지도를 가로막지 않게 하는 것이고, 누르는 카드만 되살린다.
        */}
        <div className="pointer-events-none absolute start-4 end-32 top-5 z-30 lg:end-auto lg:top-6">
          {/*
            **폭은 `lg:w-100`(400) 이고 `.map-panel-width` 와 같은 값이다.** 그 클래스를
            `lg:` 로 쓸 수 없다 — Tailwind 가 소유하지 않는 이름이라 variant 를 만들지
            못하고, 붙여도 조용히 폭이 안 걸린다 (실측: 400 이어야 할 카드가 152 였다).
            1024 미만은 폭을 잡지 않는다 — 거기서는 좌우 여백이 폭을 만든다.
          */}
          <div className="bg-bg border-border pointer-events-auto rounded-xl border p-3 shadow-lg lg:w-100">
            {/*
              **모바일은 뒤로가기가 제목 왼쪽 같은 줄이다** (#539) — 목록 갈래의 카드 머리와
              같은 규약이라 두 보기가 같은 모양으로 읽힌다. `md` 이상은 제목 위로 돌아간다.

              **부제를 두지 않는다.** 담을 일자는 제목이 이미 말하고, 390 에서 부제는 두 줄이
              되어 지도 위 카드를 그만큼 키운다 — 목록 갈래는 그대로 부제를 갖는다.
            */}
            <div className="flex flex-wrap items-start gap-x-1 md:block">
              <BackLink href={backHref} label={messages.plan.addPlaceBack} variant="titleRow" />
              <h1 className="text-title-2 text-fg min-w-0 flex-1 font-bold break-keep md:mt-2 md:flex-none">
                {messages.plan.addPlaceTitle.replace('{day}', String(day))}
              </h1>
            </div>
          </div>
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
        /* `/plans` 는 proxy.ts `PROTECTED_PATHS` 라 미로그인이 여기 닿지 않는다 (#200) */
        <PlaceFilterChips filters={filters} authed className="lg:hidden" />
      }
    >
      <PlaceListSection
        /*
          **인셋을 넘기지 않는다** (#451). 기본값 `card`(16/20)가 곧 이 목록의 자리다 —
          행(`PlanAddPlaceRow`)도 카드 안에서 같은 값을 쓴다. 하나라도 어긋나면 목록이
          실데이터로 바뀌는 순간 왼쪽 선이 뛴다.

          **`headingLevel` 은 `3` 이다** (#456① · #556). #451 때는 껍데기 카드가 `aria-label`
          만 갖고 `h2` 를 그리지 않아 기본값 `2` 가 맞았는데, 제목이 카드 머리로 들어오면서
          카드가 `h2` 를 그린다. **`inset` 이 `card` 라서가 아니라 그 카드가 제목을 갖기
          때문이다** — 두 축은 여전히 다른 것을 묻는다 (`place-list-section` 주석).
        */
        headingLevel={3}
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
 * **머리가 카드 안으로 들어갔다** (#556). 뒤로가기 · 제목 · 부제 · 보기 토글 · 필터 칩이
 * 전부 `Surface` 의 머리 슬롯으로 가고, 카드는 `fill` 로 열 높이를 다 쓰며 **본문만 구른다.**
 * 뒤로가기가 특히 여기 있어야 한다 — **이 화면의 유일한 퇴로**라, 바닥 위에 두면 목록을
 * 내려가는 동안 화면 밖으로 사라진다.
 *
 * **보이는 제목은 카드의 `h2` 이고 `h1` 은 `sr-only` 다** — `/places` · `/plans` · `/emergency`
 * 가 모두 쓰는 방식이다(#472 · #445 · #556). 지도 갈래는 떠 있는 머리 카드에 자기 `h1` 을
 * 그리므로 두 갈래가 같은 문자열을 내고, 보기 전환이 문서 구조를 바꾸지 않는다.
 *
 * **덤으로 제목 탐색 개요가 고쳐진다.** #451 이 "이 화면만 `h2 필터` 가 `h1` 보다 먼저인
 * 채로 남는다" 고 적어 둔 것은 제목이 **보이는** 페이지 머리라 레일 앞으로 못 올렸기
 * 때문이었는데, 제목이 카드 머리로 들어가면서 그 제약이 풀렸다.
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
  /** 머리 안, 제목 줄 **아래**에 서는 도구 (모바일 필터 칩). 없으면 그 줄 자체가 없다 */
  tools?: ReactNode
  children: ReactNode
}) {
  const title = messages.plan.addPlaceTitle.replace('{day}', String(day))
  const subtitle = messages.plan.addPlaceSubtitle.replace('{day}', String(day))

  return (
    /*
      **건너뛰기 링크의 목적지다** (#472). 페이지가 레일 맨 앞에 둔 `목록으로 건너뛰기` 가
      여기로 온다 — 전역 스킵 링크(`#main`)는 레일 **앞**이라 이 구간을 못 건너뛴다.
      `tabIndex={-1}` 의 근거는 `surface.tsx` 의 `SurfaceStack` 주석에 있다 — Chromium 만
      보면 없어도 되지만 보조기기 조합을 위해 둔다.
    */
    <SurfaceStack id="plan-add-place-list" tabIndex={-1} className="list-column">
      {/* `h1` 은 페이지가 레일 **앞**에 `sr-only` 로 낸다 (#556) — 여기 두면 레일 뒤가 된다 */}
      <Surface
        fill
        titleId="plan-add-place-heading"
        title={title}
        description={
          <p className="text-caption text-fg-muted font-medium">
            {planTitle === undefined ? subtitle : `${planTitle} · ${subtitle}`}
          </p>
        }
        /* 네 화면이 같은 세그먼트 컨트롤을 쓴다 */
        trailing={
          <ViewToggle current={view} listHref={listHref} mapHref={mapHref} variant="icon" />
        }
        /* `titleRow` — 모바일에서 제목 왼쪽 같은 줄에 선다 (#539, `Surface` 머리가 감싼다) */
        leading={<BackLink href={backHref} label={messages.plan.addPlaceBack} variant="titleRow" />}
        tools={tools}
      >
        {children}
      </Surface>
    </SurfaceStack>
  )
}
