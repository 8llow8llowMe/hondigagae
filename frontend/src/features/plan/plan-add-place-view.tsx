'use client'

import { type ReactNode, useState } from 'react'
import { useRouter } from 'next/navigation'

import { BackLink } from '@/components/back-link'
import { ButtonLink } from '@/components/button'
import { EmptyState } from '@/components/empty-state'
import { ErrorState } from '@/components/error-state'
import { Surface, SurfaceStack } from '@/components/surface'
import { ViewToggle } from '@/components/view-toggle'
import { PlaceFilterChips } from '@/features/place/place-filter-chips'
import { PlaceListSection } from '@/features/place/place-list-section'
import { PlaceMapView } from '@/features/place/place-map-view'
import { PlaceSearchField } from '@/features/place/place-search-field'
import { usePlaceList } from '@/features/place/use-place-list'
import { planAddPlaceAction, planAddPlaceNotice } from '@/features/plan/plan-add-place-action'
import { PlanAddPlaceRow } from '@/features/plan/plan-add-place-row'
import { planDayAnchorId } from '@/features/plan/plan-day-section'
import { usePlanAddPlace } from '@/features/plan/use-plan-add-place'
import { usePlanDetail } from '@/features/plan/use-plan-detail'
import { ApiError, toErrorStatus } from '@/lib/api/error'
import { mergeSlices } from '@/lib/api/slice'
import type { LatLng } from '@/lib/geo/coord'
import { messages } from '@/lib/messages'
import { addPlaceFocus, addPlaceListOrigin } from '@/lib/plan/add-place-focus'
import { itemInsertIndex, placeIdsOf } from '@/lib/plan/day-items'
import { groupItemsByDay } from '@/lib/plan/detail'
import { INSET_CLASS } from '@/lib/ui/inset'
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
 *
 * **140 → 248 로 늘었다** (#1012). 머리 아래에 검색(44 + 사이 8)이 붙었고, 이 값은 폭에
 * 따라 갈리지 않는 px 하나라 **1024 미만 중 머리가 가장 높은 폭**에 맞춘다 — 768 은 뒤로가기가
 * 제목 위로 올라가(`md:block`) 카드가 104 가 된다. 실측(뷰포트 기준 바닥): 375 는 카드 130 ·
 * 검색 182, **768 은 카드 188 · 검색 240.** 240 에 `MAP_TOP_CONTROLS_INSET` 과 같은 여유 8 을
 * 더해 248 이다. 예전 140 은 375 만 보고 정해 768 에서 카드 아래 48px 를 시트가 덮고 있었다
 * (머리가 문서 순서상 뒤라 위에 그려져 가려지지는 않았다). 375 에서는 검색 아래 지도 띠
 * 66px 가 남는다 — 위 "지도 한 줄" 의 몫이다.
 */
const SHEET_MAX_TOP_INSET = 248

/**
 * 떠 있는 머리 아래로 좌측 패널을 밀어 내리는 높이(px) — 이슈 #556.
 *
 * **1440 실측**: 머리 카드가 지도 기준 y=24 에서 시작해 높이 100(여백 12×2 + 뒤로가기 44 +
 * 사이 4 + 제목 26)이므로 바닥이 124 다. 카드 사이 12 를 더해 136.
 *
 * 카드 폭이 400 으로 못박혀 있어(`lg:w-100`) 제목이 접히지 않는다 — 그래서 이 높이가
 * 일자 번호와 무관하게 일정하다. `PlaceMapView` 는 머리의 **자리**는 갖지만(#1012 `head`)
 * 그 안에 무엇이 얼마나 높게 서는지는 모르므로 이 화면이 알려 준다.
 */
const PANEL_TOP_INSET = 136

/**
 * 머리 카드에 '다녀옴' 초기화 경고(#1066)가 설 때 위 두 상수에 더하는 높이(px).
 *
 * 그 줄은 **체크가 있는 날에만** 서서 늘 더하지 않는다 — 없는 날까지 늘리면 시트와 패널이
 * 빈 자리만큼 내려앉는다.
 *
 * **26 은 실측이다** (2026-09-30, 캡션 18 + 위 여백 8): 머리 카드가 375·390 에서 54 → 80,
 * 768·1440 에서 104 → 130 이 됐고 네 폭 모두 한 줄이다. 카카오 SDK 가 실패한 폴백 갈래에서
 * 잰 값이라 카드 높이만 확인됐다 — 지도가 뜬 상태의 시트 상한 · 패널 겹침은 재지 못했다.
 */
const VISIT_NOTICE_EXTRA = 26

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

  /*
    **목록 보기도 그날 기준점에서 가까운 순이다** (#1217 · BE #1202). 지도(#1177)와 같은 점이다.

    **처음 받은 값으로 얼린다** — 지도의 `initialFocus` 와 같은 이유다. 담기에 성공하면(#370 —
    화면에 남는다) 그날의 마지막 장소가 바뀌어 기준점도 바뀌는데, 그대로 따라가면 key 가 바뀌어
    목록이 처음부터 다시 받아지고 보던 자리가 사라진다. 다음에 갈 곳을 연달아 담는 동안 순서는
    그대로 두고, 다시 들어오면 새 기준점이다.

    상세를 아직 못 받았으면(`undefined`) 조회를 미룬다 — 좌표 없이 먼저 받으면 상세가 온 뒤 목록이
    한 번 뒤집힌다. 서버가 상세를 프리페치하므로 보통 첫 렌더부터 있다. 얼리는 것은 렌더 중 상태
    갱신이다(React 의 "이전 렌더 값 저장" 패턴) — effect 로 미루면 한 렌더 늦게 조회가 켜진다.

    **지도 보기는 이 목록을 쓰지 않는다** — `PlaceMapView` 가 자기 목록(좌표 없는 key)을 든다.
    켜 두면 지도에서 쓰지 않을 거리순 요청이 한 번 더 나간다.
  */
  const liveOrigin = addPlaceListOrigin(detail.data, day)
  const [frozenOrigin, setFrozenOrigin] = useState<{ value: LatLng | null } | null>(
    liveOrigin === undefined ? null : { value: liveOrigin },
  )
  if (frozenOrigin === null && liveOrigin !== undefined) setFrozenOrigin({ value: liveOrigin })
  const listOrigin = frozenOrigin?.value ?? null
  const list = usePlaceList(filters, view === 'list' && frozenOrigin !== null, listOrigin)

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
  /*
    **담기가 그 날의 '다녀옴' 을 지운다** (#1066). 담기는 일괄 교체라 새 `planItemId` 가
    발급된다. 일정 상세의 상시 줄을 걷고 **고치러 들어온 이 화면의 머리**로 옮겼다 —
    잃을 것(체크)이 있는 날에만 선다. 두 보기가 같은 판단을 쓴다.
  */
  const visitResetNotice = group.items.some((item) => item.visited)
    ? messages.plan.visitResetOnAddNotice
    : null
  /** 지도 갈래 머리 카드가 그 경고만큼 커진 높이 — 시트 상한 · 패널 시작점이 함께 내려간다 */
  const headExtra = visitResetNotice === null ? 0 : VISIT_NOTICE_EXTRA

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

        높이는 `map-canvas-height` 가 잡고 `PlaceMapView` 는 `fill` 로 그것을 그대로 채운다.
        떠 있는 머리의 기준면은 #1012 부터 `PlaceMapView` 의 루트다 (`head` 로 넘긴다).
      */
      <div className="map-canvas-height relative">
        <div className="h-full">
          <PlaceMapView
            filters={filters}
            authed
            fill
            /*
              **검색을 켠다** (#1012) — 목록 갈래 머리에 선 `PlaceSearchField` 와 같은 축(`?keyword=`)
              이다. 1024 미만은 아래 머리 바로 밑, 이상은 패널 맨 위에 선다 (`PlaceMapView` 의
              `head` 주석). 이동은 `usePlaceFilterNav` 가 **현재 경로**로 하므로 제출해도
              `/places` 로 튀지 않는다.
            */
            searchable
            /*
              **머리를 지도에게 맡긴다** (#1012). 예전에는 이 트리가 `absolute` 로 띄웠는데, 그러면
              모바일 검색이 설 자리(머리 아래)를 지도가 알 수 없고 SDK 실패 폴백에서 머리가
              목록을 덮는다. 자리는 `PlaceMapView` 가, 내용은 여기가 그린다.
            */
            head={
              /*
                **곡률은 16(`rounded-xl`)이다.** 옆 패널과 같은 값이고 §5 가 "떠 있는 것" 에 준
                값이다 — L1 카드의 12 를 쓰면 지도 위에 누운 것처럼 보인다.

                **폭은 `lg:w-100`(400) 이고 `.map-panel-width` 와 같은 값이다.** 그 클래스를
                `lg:` 로 쓸 수 없다 — Tailwind 가 소유하지 않는 이름이라 variant 를 만들지
                못하고, 붙여도 조용히 폭이 안 걸린다 (실측: 400 이어야 할 카드가 152 였다).
                1024 미만은 폭을 잡지 않는다 — 거기서는 좌우 여백이 폭을 만든다.
              */
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
                {/*
                  부제는 걷었지만 **이 경고는 남긴다** — 부제는 제목이 이미 한 말이고, 이것은
                  담기 전에만 쓸모 있는 말이다. 카드가 한 줄 커지는 만큼 아래 두 상수도 함께
                  늘린다 (`VISIT_NOTICE_EXTRA`).
                */}
                {visitResetNotice !== null && (
                  <p className="text-caption text-fg-muted mt-2 font-medium break-keep">
                    {visitResetNotice}
                  </p>
                )}
              </div>
            }
            /*
              **토글을 지도에게 맡긴다** (#556). 머리가 들고 있을 때는 뷰포트 오른쪽 끝
              (1920 실측 1880)에 섰는데, 목록 갈래의 토글은 1440 열 안(1627)이라 보기를
              오갈 때마다 **253px 튀었다** — `/places` 에서 #412 가 이미 고친 증상이다.
              지도가 그리면 콘텐츠 열 오른쪽(1640)에 매달린다.
            */
            listHref={listHref}
            mapHref={mapHref}
            sheetMaxTopInset={SHEET_MAX_TOP_INSET + headExtra}
            panelTopInset={PANEL_TOP_INSET + headExtra}
            mutedPlaceIds={addedPlaceIds}
            /*
              **그날 직전 장소에서 연다** (#1177). 예전에는 그날과 무관하게 제주시 기본 화면에
              `/places` 첫 장(`placeId` 순 — 한경면부터)이었다. 규칙은 `addPlaceFocus` 가 갖는다.

              `useMemo` 로 감싸지 않는다 — 이 자리는 조건부 return 뒤라 훅을 둘 수 없고,
              `PlaceMapView` 가 **마운트 때 값만** 쓰므로(`initialFocus`) 렌더마다 새 객체여도
              카메라가 다시 옮겨지지 않는다. 담기 응답으로 기준점이 바뀌어도 마찬가지다(#370).

              **목록 보기는 같은 점을 따로 얼려 서버에 넘긴다** (#1217) — 클라이언트 정렬이 아니라
              `/places?lat=&lng=` 의 거리순이다. 위 `listOrigin` 주석.
            */
            initialFocus={addPlaceFocus(day, days)}
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
      notice={visitResetNotice}
      beforeLodging={itemInsertIndex(group.items) < group.items.length}
      listHref={listHref}
      mapHref={mapHref}
      view={view}
      tools={
        /*
          **`/places` 목록 머리와 같은 순서·같은 모양이다** (#1012) — 검색이 칩 위다. 검색어는
          목록을 좁히는 **범위**이고 칩은 그 안의 축이다. 검색은 모든 폭에서 이 자리이고,
          칩만 `lg:hidden` 이다 — 데스크톱은 좌측 레일이 칩의 일을 한다 (페이지가 렌더).

          제출은 `usePlaceFilterNav` 가 **현재 경로**(`usePathname`)에 `?keyword=` 를 얹어
          `replace` 한다 — 이 화면에서 검색해도 `/places` 로 튀지 않는다.
        */
        /* `/plans` 는 proxy.ts `PROTECTED_PATHS` 라 미로그인이 여기 닿지 않는다 (#200) */
        <>
          <PlaceSearchField filters={filters} />
          <PlaceFilterChips filters={filters} authed className="lg:hidden" />
        </>
      }
    >
      {/*
        **순서의 이유를 목록 위 한 줄로 말한다** (#1217) — 행마다 거리가 붙지만, 그 숫자가 무엇에서 잰
        것인지는 여기서만 읽힌다. 목록이 서 있을 때만이다: 골격 · 오류 · 0건에는 순서가 없다.
      */}
      {listOrigin !== null && places.length > 0 && (
        <p className={`text-caption text-fg-muted pt-3 font-medium ${INSET_CLASS.card}`}>
          {messages.plan.addPlaceNearbyCaption}
        </p>
      )}
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
        /* 상세를 받기 전(조회가 꺼진 동안)에도 `isPending` 이라 골격이 선다 */
        loading={list.isPending}
        /*
          **검색어 0건이면 그 말을 되돌려 준다** (#1220) — `/places` · 지도 폴백과 같다. 머리의
          `PlaceSearchField` 가 같은 `?keyword=` 를 쓴다.
        */
        keyword={filters.keyword}
        /* 거리순은 좌표 없는 장소가 빠진다 — 0건이면 그 사실도 덧붙인다 (#1217) */
        emptyNote={listOrigin === null ? undefined : messages.plan.addPlaceNearbyEmptyNote}
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
 * 그래서 `children` 은 항상 카드 안이고, **목록을 좁히는 도구(검색 · 필터 칩)만 `tools` 로
 * 따로 받는다** — 도구는 목록을 좁히고 카드 본문은 그 결과를 담는다 (#439 · #440 · #1012).
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
 *
 * **export 는 테스트 몫이다** — `PlanAddPlaceView` 는 조회 훅을 들어 node 환경에서 렌더되지
 * 않는다(`testing-guide.md` §1). 머리의 '다녀옴' 경고(#1066)를 이 껍데기로 잰다.
 */
export function PlanAddPlaceShell({
  day,
  backHref,
  planTitle,
  listHref,
  mapHref,
  view,
  tools,
  notice = null,
  beforeLodging = false,
  children,
}: {
  day: number
  backHref: string
  /** 아직 못 받았으면 생략한다 — 제목은 `day` 만으로 쓸 수 있다 */
  planTitle?: string | undefined
  /** 부제 아래 한 줄 — '다녀옴' 초기화 경고 (#1066). 없으면 줄 자체가 없다 */
  notice?: string | null
  /** 그날 끝에 숙박이 있어 담는 곳이 맨 뒤가 아니다 (#1175) — 부제가 "숙소 앞" 이라고 말한다 */
  beforeLodging?: boolean
  listHref: string
  mapHref: string
  view: ViewMode
  /** 머리 안, 제목 줄 **아래**에 서는 도구 (검색 + 모바일 필터 칩, #1012). 없으면 그 줄 자체가 없다 */
  tools?: ReactNode
  children: ReactNode
}) {
  const title = messages.plan.addPlaceTitle.replace('{day}', String(day))
  const subtitle = (
    beforeLodging ? messages.plan.addPlaceSubtitleBeforeLodging : messages.plan.addPlaceSubtitle
  ).replace('{day}', String(day))

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
          <>
            <p className="text-caption text-fg-muted font-medium">
              {planTitle === undefined ? subtitle : `${planTitle} · ${subtitle}`}
            </p>
            {notice !== null && (
              <p className="text-caption text-fg-muted mt-1 font-medium break-keep">{notice}</p>
            )}
          </>
        }
        /* 네 화면이 같은 보기 전환 버튼을 쓴다 — 카드 제목 줄은 `sm`(36) 이다 (#1125) */
        trailing={<ViewToggle current={view} listHref={listHref} mapHref={mapHref} size="sm" />}
        /* `titleRow` — 모바일에서 제목 왼쪽 같은 줄에 선다 (#539, `Surface` 머리가 감싼다) */
        leading={<BackLink href={backHref} label={messages.plan.addPlaceBack} variant="titleRow" />}
        tools={tools}
      >
        {children}
      </Surface>
    </SurfaceStack>
  )
}
