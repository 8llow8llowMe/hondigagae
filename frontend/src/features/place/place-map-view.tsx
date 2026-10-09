'use client'

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import dynamic from 'next/dynamic'

import type { ReactNode } from 'react'

import { Button } from '@/components/button'
import { EmptyState } from '@/components/empty-state'
import { ErrorState } from '@/components/error-state'
import { ChevronLeftIcon, ChevronRightIcon } from '@/components/icons'
import { MAP_TOP_CONTROLS_INSET, MapSheet, type SheetStop } from '@/components/map-sheet'
import { Skeleton } from '@/components/skeleton'
import { ViewToggle } from '@/components/view-toggle'
import type { MapPin } from '@/features/map/map-canvas'
import { MapLocateButton } from '@/features/map/map-locate-button'
import { ResearchHereButton } from '@/features/map/research-here-button'
import { useMapFailureFallback } from '@/features/map/use-map-failure-fallback'
import { facilityLayerStatus } from '@/features/place/facility-layer-status'
import {
  facilityLayerFacilities,
  pickedFacility,
  placeTakesOverFacility,
} from '@/features/place/facility-selection'
import { PlaceMapFacilitySummary } from '@/features/place/place-map-facility-summary'
import {
  hasFacilityNotice,
  PlaceMapFacilityNotice,
  PlaceMapFacilityToggle,
} from '@/features/place/place-map-facility-toggle'
import { PlaceMapFilterBar } from '@/features/place/place-map-filter-bar'
import { PlaceMapPanel } from '@/features/place/place-map-panel'
import { PlaceMapPreview } from '@/features/place/place-map-preview'
import { PlaceMapRowsSkeleton } from '@/features/place/place-map-skeleton'
import { PlaceSearchField } from '@/features/place/place-search-field'
import { useFacilityLayer } from '@/features/place/use-facility-layer'
import { useNearbyPlaces } from '@/features/place/use-nearby-places'
import { usePlaceFilterNav } from '@/features/place/use-place-filter-nav'
import { usePlaceList } from '@/features/place/use-place-list'
import { usePlacePreview } from '@/features/place/use-place-preview'
import { isRetriable } from '@/lib/api/error'
import { mergeSlices } from '@/lib/api/slice'
import { facilityPinId, readFacilityPinId, toFacilityPin } from '@/lib/emergency/facility-pin'
import { type LatLng, SELECTED_PLACE_MAP_LEVEL } from '@/lib/geo/coord'
import { getCurrentPosition, getPositionIfGranted, offersLocate } from '@/lib/geo/current-position'
import type { MapOffset } from '@/lib/map/offset-center'
import {
  areaAfterFramedIdle,
  areaAfterIdle,
  areaAfterResearch,
  focusedPlaceMapArea,
  type FocusFraming,
  framingAfterIdle,
  INITIAL_PLACE_MAP_AREA,
  PLACE_MAP_FOCUS_RADIUS_METERS,
  type PlaceMapArea,
  placesInArea,
} from '@/lib/map/place-map-area'
import { shouldOfferResearch } from '@/lib/map/research-offer'
import type { MapSdkFailure } from '@/lib/map/sdk'
import {
  boundsCenter,
  boundsRadiusMeters,
  isSameViewport,
  type MapBounds,
} from '@/lib/map/viewport'
import { visibleCountLabel } from '@/lib/map/visible-count'
import { messages } from '@/lib/messages'
import { placePinIcon } from '@/lib/place/pin-icon'
import { mapEmptyCopy } from '@/lib/place/search-empty'
import { cn } from '@/lib/utils/cn'
import type { PlaceFilters, PlaceSummary } from '@/types/place'

/**
 * **`ssr: false` 가 필수다.** SDK 가 `window` 를 읽어 서버 렌더에서 깨진다
 * (docs/external-api-guide.md §1).
 */
const MapCanvas = dynamic(
  () => import('@/features/map/map-canvas').then((module) => module.MapCanvas),
  { ssr: false },
)

/**
 * 장소 찾기 — 지도 보기.
 *
 * 아트보드 `혼디가개 장소 찾기` 05(데스크톱) · 06(모바일).
 *
 * **데이터 출처가 둘이고 갈리는 조건이 명확하다.**
 *  - 처음 들어오면 **목록 캐시를 재사용**한다 (architecture-guide.md §9 "지도 뷰: 별도
 *    조회 금지"). 목록에서 보던 것과 지도에서 보는 것이 달라지면 안 된다.
 *  - 사용자가 **"이 지역에서 재검색" 을 누르면** `GET /places/nearby` 로 갈아탄다.
 *
 * **지도를 옮겼다고 스스로 재조회하지 않는다** (#396 의 규칙을 이 화면에도 들였다).
 * 예전에는 `idle` 마다 나갔고, 그 전제가 **한 곳을 골라 확대하는 조작**에서 깨졌다 —
 * 확대는 우리가 그 핀으로 옮겨 준 결과인데 그때마다 목록이 다시 조회돼 방금 보던 결과가
 * 사라졌다. 이제 지도 조작은 버튼을 띄울 뿐이고, 목록도 **조회한 자리**(`searchedBounds`)
 * 를 세므로 팬·줌·선택 어느 것도 목록을 흔들지 않는다.
 *
 * **지도가 유일한 전달 수단이 아니다** (이슈 #14 완료 조건). SDK 가 실패하면 목록을
 * 그대로 그리고 위에 안내 한 줄을 둔다.
 */
export function PlaceMapView({
  filters,
  authed,
  fill = false,
  searchable = false,
  head,
  listHref,
  mapHref,
  fallbackHref,
  renderRowAction,
  renderRowNotice,
  mutedPlaceIds,
  sheetMaxTopInset,
  initialFocus,
  initialFocusName,
  preview = false,
  facilityLayer = false,
}: {
  filters: PlaceFilters
  /** 미로그인이면 반려견 목록을 조회하지 않는다 — 필터의 크기 축이 빠진다 (#200) */
  authed: boolean
  /**
   * `true` 면 **부모가 높이를 정한다.** 위에 헤더가 붙는 화면(담기, #370)이 쓴다.
   * `false`(기본)면 스스로 `map-canvas-height` 로 뷰포트를 채운다.
   */
  fill?: boolean | undefined
  /**
   * 지도 위·패널·폴백에 이름·주소 검색을 그린다 (#596). **기본은 끔이다.**
   *
   * `/places` 와 담기 화면(#1012)이 켠다. 담기 화면은 #596 때 **목록 갈래에도 검색이
   * 없어서** 지도에만 켜지 않았는데, #1012 가 두 갈래에 함께 들였다 — 같은 화면의 두
   * 보기가 같은 도구를 갖는다는 원칙은 그대로다.
   *
   * **1024 미만의 자리는 `head` 가 가른다.** 없으면 보기 토글 왼쪽, 있으면 그 머리 바로
   * 아래다 (`head` 주석).
   */
  searchable?: boolean | undefined
  /**
   * 지도 좌상단에 **떠 있는 머리** — 담기 화면의 `일정으로 돌아가기` · 제목 카드 (#556 · #1012).
   *
   * **자리만 이 컴포넌트가 정하고 내용은 호출부가 그린다.** place 는 plan 을 모른다 —
   * `renderRowAction` 과 같은 결의 슬롯이다. 담기지도 명세 D2 는 헤더를 슬롯으로 받지
   * 않기로 했었는데(판별 유니온이 `ReactNode` 의 `undefined` 때문에 갈리지 않는다는 근거),
   * 여기는 유니온이 아니라 **있으면 그리는 선택 슬롯**이라 그 근거가 닿지 않는다.
   *
   * **슬롯으로 올린 이유는 둘이다** (#1012).
   * - **모바일 검색이 설 자리가 머리와 같은 줄이다.** 토글 왼쪽 오버레이 검색이 머리
   *   카드(`end-32`) 밑에 그대로 깔려 **보이지 않는 채로 포커스를 받는다.** 머리를 여기서
   *   그리면 검색을 머리 아래 같은 기둥에 세울 수 있다
   * - **SDK 실패 폴백에서 머리가 목록을 덮었다.** 머리가 호출부의 `absolute` 였으므로
   *   폴백 안내 줄과 첫 행 위에 떠 있었다(375·1440 실측). 여기서 그리면 폴백은 머리를
   *   **정상 흐름**으로 세운다
   */
  head?: ReactNode
  /**
   * 지도 우상단에 떠 있는 보기 전환의 목적지. **둘 다 있어야 토글을 그린다.**
   * 헤더가 토글을 갖는 화면은 주지 않는다 — 같은 컨트롤이 두 개 뜨면 안 된다.
   *
   * 예전에는 이 컴포넌트가 `'/places'` 를 하드코딩해 링크를 만들었다. 그래서 다른
   * 화면이 이 지도를 쓰면 토글이 남의 화면으로 보냈다 (#370).
   */
  listHref?: string | undefined
  mapHref?: string | undefined
  /**
   * **지도를 못 띄우면 갈 목록 보기** (#1289). SDK 가 실패하면 안내 화면 대신 이 주소로 옮기고 토스트로
   * 이유를 말한다(`useMapFailureFallback`). 토글 주소(`listHref`)와 따로 받는 이유: 헤더가 토글을 갖는
   * 담기 화면은 `listHref` 를 주지 않는다 — 그래도 실패하면 갈 목록은 있어야 한다.
   */
  fallbackHref: string
  /** 패널·시트 행의 액션 열. 담기 버튼이 여기 온다 */
  renderRowAction?: ((place: PlaceSummary) => ReactNode) | undefined
  /** 행 아래 전폭 줄. 담기 실패 알림이 여기 온다 */
  renderRowNotice?: ((place: PlaceSummary) => ReactNode) | undefined
  /** 핀 톤을 낮출 장소들. 담기 화면은 "이미 담은 곳" 을 넘긴다 */
  mutedPlaceIds?: ReadonlySet<string> | undefined
  /**
   * 모바일 시트를 끝까지 올렸을 때 비워 둘 상단 높이(px).
   *
   * **헤더가 정상 흐름인 화면(담기, #370)이 자기 헤더 높이를 알려 준다.** 이 컴포넌트는
   * 위에 무엇이 얹히는지 모른다.
   *
   * **주지 않으면 `MAP_TOP_CONTROLS_INSET`(136)이다** (#901 D2). 예전에는 시트 기본
   * 상한(`85dvh`)으로 떨어졌는데, 그 값은 **비율**이라 윗변이 기기 높이를 따라가
   * 짧은 기기일수록 `/places` 자신의 플로팅 컨트롤을 더 덮었다 — 812 에서 2px 여유,
   * 800 에서 0, **640 에서 24px 덮음**(실측).
   */
  sheetMaxTopInset?: number | undefined
  /**
   * **처음 열 자리** — 담기 화면이 그날 직전 장소를 넘긴다 (#1177, `addPlaceFocus`).
   *
   * 주면 지도가 이 점으로 카메라를 옮기고, 첫 목록을 **"이 지역에서 재검색" 을 이미 누른
   * 상태로** 시작한다(`focusedPlaceMapArea` — 서버 거리순 `/places/nearby`). 주지 않으면
   * (`/places`, 기준점이 없는 날) 지금까지와 한 글자도 다르지 않다 — 제주 기본 화면에 목록 캐시.
   *
   * **마운트 때 값만 쓴다.** 담기는 응답으로 상세를 갈아끼워 호출부의 기준점이 방금 담은
   * 곳으로 바뀌는데, 그때마다 카메라가 옮겨지면 여러 곳을 연달아 담는 흐름(#370)이 매번
   * 끊긴다 — 사용자가 맞춰 둔 확대·위치가 날아간다. 이름이 `initial` 인 이유다.
   */
  initialFocus?: LatLng | null | undefined
  /**
   * 기준점의 이름 (#1223). 주면 그 자리에 누를 수 없는 `기준 · {이름}` 이름표가 선다 — 기준이 올레
   * 시작점이거나 필터에 걸린 장소면 그 자리에 핀이 없어, 왜 여기서 열렸는지 알 수 없었다.
   * `initialFocus` 와 함께 **마운트 때 값만 쓴다** — 담을 때마다 이름표가 옮겨 가면 카메라는 그대로인데
   * 기준만 바뀐 것처럼 읽힌다.
   */
  initialFocusName?: string | null | undefined
  /**
   * 고른 장소를 **미리보기 패널**로 보이고 `?place=` 에 남긴다 (#1227). `/places` 만 켠다.
   *
   * 담기 지도는 켜지 않는다 — 행마다 담기 버튼이 이미 있고(`renderRowAction`), 그 화면의 일은
   * "이 일정에 넣을 곳 고르기" 라 미리보기가 그 버튼과 같은 일을 두 번 하게 된다. 그 주소에
   * `place` 가 붙을 이유도 없다. 끄면 선택은 예전처럼 화면 안 상태다 (`usePlacePreview`).
   */
  preview?: boolean | undefined
  /**
   * 오른쪽 위 묶음에 **병원 · 약국 함께 보기** 토글을 둔다 (#1286, `지도시설토글-세부명세.md`). `/places` 만
   * 켠다 — 담기 지도는 켜지 않는다(그 화면의 일은 "이 일정에 넣을 곳 고르기" 다).
   *
   * 켜도 **처음에는 꺼진 토글**이고, 누르기 전에는 시설 조회가 나가지 않는다(`architecture-guide.md` §9 —
   * 지도 뷰 첫 화면은 별도 조회 금지). 시설 요약은 미리보기 자리를 쓰므로 `preview` 와 함께 켠다.
   */
  facilityLayer?: boolean | undefined
}) {
  /*
    **`undefined` 만이 아니라 `null`·`false` 도 "머리 없음" 이다** (#1012 검토). 호출부가
    `head={조건 && …}` 로 넘기면 `false` 가 오는데, `!== undefined` 로 가르면 빈 래퍼가 그려지고
    오버레이 검색도 꺼진다.
  */
  const hasHead = head !== undefined && head !== null && head !== false

  const [bounds, setBounds] = useState<MapBounds | null>(null)
  /*
    **영역이 둘이다** (#1143, `lib/map/place-map-area.ts`).

    - `searchedBounds` — **지금 목록이 대응하는 지도 영역.** 이 값을 놓는 것은 **"이 지역에서
      재검색" 버튼뿐**이다 (#396 의 규칙을 이 화면에도 들였다). 재검색 전에는 `null` 이라
      목록·핀을 거르지 않는다.
    - `originBounds` — **재검색 권유의 기준.** 첫 `idle` 에 놓이고 재검색 때 같이 옮겨 간다.

    예전에는 `movedBounds` 였고 `idle` 마다 갱신되며 **스스로 재조회**했다. 그래서 한
    장소를 눌러 확대하거나 화면을 조금만 옮겨도 그 프레임 기준으로 목록을 다시 불러와,
    방금 보던 결과가 통째로 갈렸다 — 조회를 시킨 적이 없는데 목록이 흔들린다.

    **목록 필터의 기준은 `searchedBounds` 다** (`bounds` 가 아니다). 그래서 지도를 옮기거나
    한 곳을 골라 확대해도 목록·핀이 그대로 남는다 — `/emergency` 가 선택 순간에만
    `frozenBounds` 로 얼려 두는 일을, 이 화면은 이 하나로 항상 한다.

    **첫 `idle` 이 목록 필터를 켜지 않는다** (#1143). 예전에는 하나의 `searchedBounds` 를 첫
    `idle` 이 채웠고, 서버 렌더·첫 페인트에 선 행이 SDK 가 뜨는 순간 지도 밖 장소만큼 빠져
    아래 행이 당겨졌다 — Lighthouse 모바일 CLS 0.159, 범인이 시트 행이었다. 권유의 자는
    처음부터 있어야 해서 그 일만 `originBounds` 로 떼어 냈다.
  */
  /* 마운트 때 값으로 얼린다 — `initialFocus` 주석 */
  const [focus] = useState<LatLng | null>(initialFocus ?? null)
  const [focusName] = useState<string | null>(initialFocusName ?? null)
  /* 얼린 두 값에서만 나오므로 참조가 바뀌지 않는다 — `MapCanvas` 가 이 참조로 다시 그린다 */
  const focusMarker = useMemo(
    () => (focus === null || focusName === null ? null : { ...focus, name: focusName }),
    [focus, focusName],
  )
  const [area, setArea] = useState<PlaceMapArea>(() =>
    focus === null ? INITIAL_PLACE_MAP_AREA : focusedPlaceMapArea(focus),
  )
  const searchedBounds = area.searched
  const originBounds = area.origin
  /*
    재검색을 한 번이라도 눌렀는가 — **목록 캐시 ↔ 주변 조회를 가르는 유일한 스위치**다.

    처음에는 목록 캐시를 재사용한다 (architecture-guide.md §9 "지도 뷰: 별도 조회 금지").
    #1143 뒤로 `searchedBounds !== null` 과 늘 같은 값이지만 **스위치를 따로 둔다** — 영역은
    목록 필터의 자리이고 이것은 데이터 출처의 자리다. 영역 쪽이 다시 첫 `idle` 에 채워지는
    변경이 와도 들어오자마자 프리페치한 캐시를 버리는 일이 없게 한다.
  */
  /* 기준점이 있으면 재검색을 누른 상태로 시작한다 (#1177) — 들어오자마자 주변 조회가 나간다 */
  const [researched, setResearched] = useState(focus !== null)
  /*
    **기준점 지도의 카메라가 어디까지 왔나** (#1177, `framingAfterIdle`). `null` 이면 기준점이
    없는 지도라 `/places` 의 `areaAfterIdle` 그대로다.

    ref 인 이유: 화면에 그리는 값이 아니라 다음 `idle` 을 어떻게 받을지만 정한다.
  */
  const framingRef = useRef<FocusFraming | null>(focus === null ? null : 'pending')
  const { selectedId, select: setSelectedId } = usePlacePreview(preview)
  const [sheetStop, setSheetStop] = useState<SheetStop>('mid')
  const [panelOpen, setPanelOpen] = useState(true)
  /*
    **미리보기를 열면 접힌 스택도 편다** (#1232). 미리보기는 도킹 스택 안이라, 접힌 채 핀을 고르면
    화면 밖 `inert` 스택 안에 마운트돼 보이지도 닿지도 않는다(리뷰 지적). 예전에는 접힌 목록 옆에
    홀로 섰다. 담기 지도(미리보기 꺼짐)는 고른다고 패널을 펴지 않는다 — 지금과 같다.
  */
  const selectPlace = (id: string | null) => {
    // 장소와 시설은 하나만 고른다 (#1286 D3-3) — 장소를 고르면 시설 요약이 닫힌다
    setPickedFacilityId(null)
    setSelectedId(id)
    if (preview && id !== null) setPanelOpen(true)
  }

  /*
    ── 병원 · 약국 층 (#1286, `지도시설토글-세부명세.md` D3) ─────────────────────────────

    **토글 · 고른 시설 둘 다 화면 안 상태다** — URL 에 싣지 않는다(D3-2 · D8-1). 시설 층은 결과 조건이 아니라
    보기 층이라 카메라 위치 · 패널 접힘과 같은 수명이다. URL 에 실으면 필터 칩마다(`placeFilterHref`) 이 키를
    실어 날라야 하고, 미리보기의 `pushState` · `back` 과 어긋난다.

    **고른 시설은 최신 응답에서 id 로 찾는다** — `openNow` 가 1분마다 갱신되고, 없어지면 선택이 풀린다.
    끄면(`layerOn` 거짓) 응답을 읽지 않는다 — 조회 훅은 끈 뒤에도 직전 응답을 남긴다(`useFacilityLayer`).
  */
  const [facilityOn, setFacilityOn] = useState(false)
  const layerOn = facilityLayer && facilityOn
  const [pickedFacilityId, setPickedFacilityId] = useState<string | null>(null)
  /** 요약을 ✕ 로 닫으면 포커스가 돌아올 곳 (D6) — 고른 핀은 다시 그려져 사라졌고, 시설은 목록 행이 없다 */
  const facilityToggleRef = useRef<HTMLButtonElement>(null)
  const facilityQuery = useFacilityLayer(layerOn)
  const facilityStatus = facilityLayerStatus({
    on: layerOn,
    data: facilityQuery.data,
    error: facilityQuery.error,
  })
  const layerFacilities = facilityLayerFacilities({ on: layerOn, data: facilityQuery.data })
  const { facility: selectedFacility, gone: pickedFacilityGone } = pickedFacility({
    picked: pickedFacilityId,
    facilities: layerFacilities,
  })
  const facilityId = selectedFacility?.facilityId ?? null
  /*
    **응답에서 빠지면 고른 id 를 비운다** (리뷰 5). 파생만 하면 요약 · 고른 핀은 바로 사라지지만 id 가 남아, 같은
    시설이 나중 응답에 다시 오면 사용자가 닫은 적 없는 요약이 저절로 다시 열린다.
  */
  useEffect(() => {
    if (pickedFacilityGone) setPickedFacilityId(null)
  }, [pickedFacilityGone])
  /*
    **URL 의 장소 선택이 다른 값으로 바뀌면 시설을 비운다** (리뷰 3 · `placeTakesOverFacility`). 시설 선택은 기록에
    없어서, 장소 → 시설 → 브라우저 앞으로 가면 `?place=` 만 돌아오고 시설이 고른 채 남아 이긴다.
  */
  const lastPlaceIdRef = useRef(selectedId)
  useEffect(() => {
    const previous = lastPlaceIdRef.current
    lastPlaceIdRef.current = selectedId
    if (placeTakesOverFacility(previous, selectedId)) setPickedFacilityId(null)
  }, [selectedId])

  /*
    시설을 고르면 장소 미리보기를 닫고(동시에 하나만) 접힌 스택을 편다 — `selectPlace` 와 같은 규칙. 장소
    미리보기가 열려 있을 때만 닫는다: `?place=` 가 없는데 `select(null)` 을 부르면 할 일이 없다.
  */
  const selectFacility = (id: string) => {
    if (selectedId !== null) setSelectedId(null)
    setPickedFacilityId(id)
    setPanelOpen(true)
  }
  /** 핀 하나의 선택이 장소인지 시설인지는 id 앞머리가 가른다 (`facilityPinId`) */
  const selectOnMap = (id: string) => {
    const picked = readFacilityPinId(id)
    if (picked === null) selectPlace(id)
    else selectFacility(picked)
  }
  const toggleFacilityLayer = () => {
    // 끄면 요약도 닫힌다 — 켤 때는 고른 것이 없다
    setPickedFacilityId(null)
    setFacilityOn((on) => !on)
  }
  const closeFacility = () => {
    setPickedFacilityId(null)
    facilityToggleRef.current?.focus()
  }
  /** 데스크톱 목록 영역 — 시설 요약의 `‹ 목록` 이 포커스를 돌려줄 곳 (D6) */
  const listRegionRef = useRef<HTMLDivElement>(null)
  /*
    **`‹ 목록` 은 목록으로 포커스를 보낸다** (D6 · 리뷰 8). ✕ 와 같은 함수면 포커스가 토글로 가서 "목록으로" 라는
    말과 닿는 곳이 갈린다. 스크롤 영역에 보이는 첫 행으로, 행이 없으면(빈 상태 · 실패) 목록 영역으로.

    **요약을 먼저 걷고(`flushSync`) 옮긴다.** 1024~1279 는 요약이 서 있는 동안 목록이 `invisible` 이라
    (`lg:max-xl:invisible`) 그 안의 행은 포커스를 받지 않는다 — 실측: 그대로 부르면 포커스가 `body` 로 떨어졌다.
  */
  const backToListFromFacility = () => {
    flushSync(() => setPickedFacilityId(null))
    const region = listRegionRef.current
    if (region === null) return

    const top = region.getBoundingClientRect().top
    const row = [...region.querySelectorAll<HTMLElement>('button[data-place-id]')].find(
      (candidate) => {
        const box = candidate.getBoundingClientRect()
        return box.height > 0 && box.bottom > top
      },
    )
    ;(row ?? region).focus()
  }
  const [failure, setFailure] = useState<MapSdkFailure | null>(null)
  // 실패하면 목록 보기로 옮긴다 — 안내 화면을 그리지 않는다 (#1289)
  useMapFailureFallback(failure, fallbackHref)
  /** 밖에서 지도 중심을 옮길 때만 값이 든다 (현재 위치 버튼) */
  const [center, setCenter] = useState<LatLng | null>(null)
  /**
   * "내 위치" 버튼을 그릴까. 알기 전까지는 `false` 라 버튼이 나중에 나타난다 —
   * 제주 밖에서 버튼이 한 번 보였다가 사라지는 것보다 늦게 나타나는 편이 낫다.
   */
  const [locatable, setLocatable] = useState(false)

  /*
    **고른 핀을 미리보기에 덮이지 않는 자리로 옮긴다** (`MapCanvas` 의 `selectedOffset`).
    1440 에서 목록 + 미리보기가 왼쪽 800px 을 덮어(#1232 도킹) 정중앙(720)이 미리보기 뒤다. 모바일은
    미리보기 시트가 아래를 덮는다. **고르는 순간 실제 크기를 잰다** — 폭마다 배치가 갈리고
    (1280 부터 목록 옆) 시트 높이는 내용만큼이다. 미리보기가 없으면(담기 지도 · 닫힘) 정중앙
    그대로다 — 목록 패널만 있을 때의 동작은 이 이슈가 바꾸지 않는다.
  */
  const rootRef = useRef<HTMLDivElement>(null)
  /** 손잡이의 `aria-controls` — 접는 대상인 데스크톱 스택 */
  const stackId = useId()
  const previewPanelRef = useRef<HTMLDivElement>(null)
  const previewSheetRef = useRef<HTMLDivElement>(null)
  const selectedOffset = useCallback((): MapOffset | null => {
    const root = rootRef.current?.getBoundingClientRect()
    if (root === undefined) return null

    /*
      `display: none` 인 갈래는 크기가 0 이다 — 지금 폭에서 서 있는 쪽만 잰다.

      **데스크톱은 `getBoundingClientRect` 가 아니라 배치 상자(`offsetLeft` · `offsetWidth`)로 잰다**
      (#1232). 스택은 `transform` 으로 여닫혀서, 펴는 도중(고르면 스택을 편다 — `selectPlace`)에 재면
      중간 프레임 값이 나온다. 배치 상자는 transform 을 모르므로 **다 펴진 자리**의 오른쪽 끝(400 · 800)이다.
      스택은 지도 루트 왼쪽 끝(0)에 붙어 있다.
    */
    const panel = previewPanelRef.current
    if (panel !== null && panel.offsetWidth > 0)
      return { x: (panel.offsetLeft + panel.offsetWidth) / 2, y: 0 }

    /*
      모바일은 위아래가 다 덮인다 — 아래는 시트, 위는 검색 · 보기 전환(`MAP_TOP_CONTROLS_INSET`).
      둘 사이 띠의 가운데로 보낸다. 띠가 없으면(아주 짧은 화면) 옮기지 않는다.
    */
    const sheet = previewSheetRef.current?.getBoundingClientRect()
    if (sheet !== undefined && sheet.height > 0) {
      // `MAP_TOP_CONTROLS_INSET` 은 뷰포트 위에서 잰 값이다(헤더 포함) — `root.top` 에 더하지 않는다
      const top = Math.max(root.top, MAP_TOP_CONTROLS_INSET)
      if (sheet.top <= top) return null
      return { x: 0, y: (top + sheet.top) / 2 - (root.top + root.bottom) / 2 }
    }

    return null
  }, [])

  /*
    **닫으면 포커스를 고른 행으로 돌려준다** (WCAG 2.4.3). ✕ 가 언마운트되면 포커스가 `body` 로
    떨어지고, 1024~1279 · 모바일은 행이 다시 보이게 된 참이다. 포커스가 다른 곳에 살아 있으면
    (사용자가 이미 옮겼으면) 건드리지 않는다.
  */
  const lastPreviewRef = useRef<string | null>(null)
  useEffect(() => {
    const closed = lastPreviewRef.current
    lastPreviewRef.current = preview ? selectedId : null
    if (closed === null || selectedId !== null) return
    /*
      **시설로 갈아탄 것이면 건너뛴다** (#1286 D3-3). 장소 미리보기는 그때도 닫히지만, 포커스는 방금 연 시설
      요약 몫이다 — 여기서 숨은 목록 행으로 데려가면 요약에서 포커스를 빼앗는다.
    */
    if (facilityId !== null) return
    if (document.activeElement !== null && document.activeElement !== document.body) return

    const row = [
      ...document.querySelectorAll<HTMLElement>(`button[data-place-id="${CSS.escape(closed)}"]`),
    ].find((candidate) => candidate.getClientRects().length > 0)
    row?.focus()
  }, [preview, selectedId, facilityId])

  /*
    ── 현재 위치 ────────────────────────────────────────────────────────────

    **버튼을 그릴지 정하려고 들여다볼 뿐, 묻지 않는다** (#1133). 제주 밖에서는 눌러도 갈
    곳이 없어(`lib/geo/jeju-bounds.ts`) 버튼 자체를 두지 않는데, 그 판정에 좌표가 필요하다.
    예전에는 그 좌표를 얻으려고 마운트에서 `getCurrentPosition()` 을 불러 **들어오자마자
    권한 팝업이 떴다** — Lighthouse `geolocation-on-start`. 지금은 이미 허용된 경우에만
    읽는다(`getPositionIfGranted()`).

    **아직 묻지 않았으면(`unasked`) 버튼을 그린다** (`offersLocate`). 묻는 자리가 그
    버튼뿐이라, 감추면 이 화면에서 위치를 켤 길이 사라진다. 제주 밖인지는 눌러 본 뒤에야
    안다 — 그때 `locate` 가 버튼을 거둔다.
  */
  useEffect(() => {
    void getPositionIfGranted().then((result) => setLocatable(offersLocate(result)))
  }, [])

  /*
    **누를 때마다 다시 묻는다.** 마운트 때 받은 좌표를 재사용하면 사용자가 이동한 뒤
    누른 "내 위치" 가 옛 자리를 가리킨다. 매번 새 객체가 나오므로 같은 좌표를 두 번
    눌러도 `MapCanvas` 의 중심 effect 가 다시 돈다.
  */
  const locate = useCallback(() => {
    void getCurrentPosition().then((result) => {
      const granted = result.kind === 'granted'
      setLocatable(granted)
      if (granted) setCenter({ lat: result.lat, lng: result.lng })
    })
  }, [])

  const listQuery = usePlaceList(filters)
  const listPlaces = useMemo(
    () => (listQuery.data === undefined ? [] : mergeSlices(listQuery.data.pages)),
    [listQuery.data],
  )

  const searchCenter = searchedBounds === null ? null : boundsCenter(searchedBounds)
  const searchRadius = searchedBounds === null ? 0 : boundsRadiusMeters(searchedBounds)
  /*
    **권유의 자는 조회 자리와 따로 잰다** (#1143). 재검색 전에는 `searchedBounds` 가 없으므로
    그것으로 재면 버튼이 영영 뜨지 않는다. 재검색 뒤에는 두 영역이 같아 값도 같다.
  */
  const originCenter = originBounds === null ? null : boundsCenter(originBounds)
  const originRadius = originBounds === null ? 0 : boundsRadiusMeters(originBounds)
  /*
    **조회 시점을 사용자가 쥔다** (#396 의 규칙을 이 화면에도 들였다). 예전에는 `idle`
    마다 자동으로 나갔고(#240 에서 체크박스를 걷으며 "지도를 옮기는 것이 곧 '여기를 보여
    줘' 다" 로 정리했다), 그 전제가 **한 곳을 골라 확대하는 조작**에서 깨졌다 — 확대는
    사용자가 "다른 지역을 보겠다" 고 한 것이 아니라 우리가 그 핀으로 옮겨 준 결과인데,
    그때마다 좁아진 프레임으로 목록이 다시 조회돼 방금 보던 결과가 사라졌다.

    이제 지도 조작은 **버튼을 띄울 뿐**이고, 조회는 누를 때만 나간다.
  */
  const nearbyQuery = useNearbyPlaces(searchCenter, searchRadius, filters, researched)

  const usingNearby = nearbyQuery.data !== undefined
  /*
    **목록이 아직 없으면 "비어 있다" 가 아니라 "기다린다" 다.** 프리페치가 실패해 클라이언트가
    처음 받는 동안 `visible` 은 `[]` 라, 예전에는 패널·시트가 `이 지역에는 표시할 곳이 없어요`
    와 `목록 0곳` 을 먼저 말했다가 행으로 바뀌었다. 그 동안은 로딩 폴백과 같은 행 골격을 둔다
    (`PlaceMapRowsSkeleton`).
  */
  /*
    **기준점 지도는 주변 조회를 기다린다** (#1177). 목록 캐시(프리페치한 첫 장)는 이미 있어
    `listQuery.isPending` 이 거짓이라, 그것만 보면 주변 조회가 오기 전에 첫 장을 기준점
    영역으로 거른 결과 — 대개 0곳 — 가 `이 지역에는 표시할 곳이 없어요` 로 먼저 깜빡인다.
    조회가 실패하면(`isPending` 거짓) 지금처럼 목록 캐시로 떨어진다.
  */
  const listPending =
    !usingNearby && (listQuery.isPending || (focus !== null && nearbyQuery.isPending))
  const places: PlaceSummary[] = useMemo(
    () => (usingNearby ? (nearbyQuery.data?.places.map((entry) => entry.place) ?? []) : listPlaces),
    [usingNearby, nearbyQuery.data, listPlaces],
  )

  /*
    **마지막으로 조회한 영역** 안에 든 것만 목록에 남긴다. 재검색 전에는 거르지 않는다
    (#1143) — 서버가 그린 행이 SDK 로드 순간 빠지지 않게.

    **지금 보고 있는 `bounds` 가 아니다.** 그러면 지도를 옮기거나 한 곳을 골라 확대하는
    것만으로 목록이 줄어, 재조회를 막아도 "목록이 흔들린다" 는 문제가 그대로 남는다 —
    `/emergency` 가 선택 순간에 `frozenBounds` 로 얼려 막는 것과 같은 결함이다.
    이 화면은 조회 자리가 곧 목록의 자리라, 그 하나로 항상 얼려 둔다.

    영역이 옮겨 갔다는 사실은 캡션(`countLine`)과 재검색 버튼이 말한다.
  */
  const visible = useMemo(() => placesInArea(places, searchedBounds), [places, searchedBounds])

  /*
    **빈 목록이 무엇 때문인지 가른다** (#1155). 검색어로 받은 결과가 아예 없는데도 `이 지역에는
    표시할 곳이 없어요 · 지도를 움직이거나…` 라서, 2026-10-06 사용성 점검에서 사용자가 지도를
    옮기며 헤맸다. 받은 결과(`places`)가 0 이면 검색어 탓, 있는데 영역 밖이면 지역 탓이다.
    검색어 갈래는 **검색어만** 지운다 — 다른 필터까지 풀면 사용자가 고른 조건이 사라진다.
  */
  /*
    **기준점 지도의 첫 주변 조회가 일시 장애로 실패했다** (#1177 검토). 목록 캐시로 떨어지면
    프리페치한 첫 장(placeId 순)을 기준점 영역으로 거른 결과 — 대개 0곳 — 가 `이 지역에는 표시할
    곳이 없어요` 로 서서 **장애를 데이터 부재로 말한다.** 사용자가 아무것도 하지 않은 첫 화면이다.
    5xx · 무응답만 재시도를 준다(404 에는 재시도를 달지 않는다 — 이 저장소 규칙). `/places` 의
    재검색 실패는 이 갈래가 아니다(`focus` 가 없다) — 예전 그대로다.
  */
  const nearbyFailed =
    focus !== null && !usingNearby && nearbyQuery.isError && isRetriable(nearbyQuery.error)
  const nearbyErrorState = (
    <ErrorState
      title={messages.place.errorTitle}
      description={messages.common.temporaryErrorDescription}
      onRetry={() => void nearbyQuery.refetch()}
    />
  )

  const { apply: applyFilters } = usePlaceFilterNav()
  const emptyCopy = mapEmptyCopy({ keyword: filters.keyword, fetchedCount: places.length })
  const emptyState = (
    <EmptyState
      title={emptyCopy.title}
      description={emptyCopy.description}
      action={
        emptyCopy.clearKeyword ? (
          <Button
            variant="secondary"
            size="md"
            onClick={() => applyFilters({ ...filters, keyword: null })}
          >
            {messages.place.clearKeyword}
          </Button>
        ) : undefined
      }
    />
  )

  /*
    **내용이 같으면 같은 Set 으로 취급한다.** `mutedPlaceIds` 는 참조 동등성으로만
    메모 판정에 들어가는데, 호출부가 매 렌더 새 `Set` 을 만들면(담기 화면이 그렇다 —
    `placeIdsOf` 를 조건부 return 뒤에서 부르므로 useMemo 로 감쌀 수 없다) `pins` 가
    매 렌더 새 배열이 되고 `MapCanvas` 가 오버레이를 전부 지웠다 다시 그린다. 무관한
    리렌더마다 지도 위 핀이 통째로 깜빡인다.

    "안정된 참조로 넘겨라" 를 호출부 계약으로 두지 않는 이유는 그 계약이 호출부에서
    보이지 않기 때문이다 — 다음 소비자가 또 밟는다. `placeId` 는 숫자 문자열이라
    쉼표로 이어 붙여도 안전하다.
  */
  const mutedKey = mutedPlaceIds === undefined ? '' : [...mutedPlaceIds].sort().join(',')
  const mutedIds = useMemo(() => new Set(mutedKey === '' ? [] : mutedKey.split(',')), [mutedKey])

  const pins: MapPin[] = useMemo(
    () =>
      visible.map((place) => ({
        id: place.placeId,
        title: place.title,
        lat: place.lat,
        lng: place.lng,
        /*
            **이미 담은 곳은 톤을 낮춘다** (#370). 훑어볼 때 항상 보이는 채널이 이것뿐이다 —
            `caption` 은 선택됐을 때만 라벨에 붙고, `MapCanvas` 는 마커에 판정 색을 쓰지
            않는다는 규약이 있다. 긴급 시설의 약국이 쓰던 표현을 그대로 재사용한다.
          */
        muted: mutedIds.has(place.placeId),
        icon: placePinIcon(place),
      })),
    [visible, mutedIds],
  )
  /*
    **시설 사각을 장소 원 뒤에 잇는다** (#1286). 묶음은 `MapCanvas` 가 모양별로 따로 접는다. 거리 캡션은
    두지 않는다 — 조회 중심이 제주시청이라 사용자와 무관한 거리다(D3-1).
  */
  const mapPins: MapPin[] = useMemo(
    () =>
      layerFacilities === undefined
        ? pins
        : [
            ...pins,
            ...layerFacilities.map((item) =>
              toFacilityPin(item, { id: facilityPinId(item.facilityId), caption: null }),
            ),
          ],
    [pins, layerFacilities],
  )

  const handleBounds = useCallback((next: MapBounds, userMoved: boolean) => {
    /*
      **기준점 지도는 따로 받는다** (#1177, `framingAfterIdle`). 첫 `idle` 은 카메라가 옮기기
      전의 제주 기본 시야라, 아래 갈래로 받으면 권유 기준이 그것으로 덮여 카메라가 옮기자마자
      재검색 버튼이 뜬다. 카메라를 놓은 뒤 첫 `idle` 을 권유 기준으로 삼는다.
    */
    const framing = framingRef.current
    if (framing !== null) {
      const step = framingAfterIdle(framing)
      framingRef.current = step.framing
      if (!step.seen) return

      setBounds(next)
      if (step.adoptOrigin) setArea((current) => areaAfterFramedIdle(current, next))
      return
    }

    setBounds(next)

    /*
      **첫 영역은 재검색 권유의 기준만 된다 — 목록을 거르지도, 조회하지도 않는다.**

      목록 필터를 켜지 않는 이유 (#1143): 서버 렌더·첫 페인트의 행은 프리페치한 첫 페이지
      전체인데, 여기서 거르면 SDK 가 뜨는 순간 지도 밖 장소가 빠지며 아래 행이 당겨진다.
      조회를 켜지 않는 이유: 들어오자마자 주변 검색으로 갈아타면 프리페치한 목록 캐시를
      버리게 되고, 첫 화면이 반경 밖이라 비어 보인다 (실제로 그랬다). 그래서 `researched`
      는 건드리지 않는다.

      그 뒤의 `idle` 은 **`bounds` 만** 옮긴다 — 재검색을 권할지 판단하고 캡션 문구를
      고르는 데만 쓰인다. `searchedBounds` 를 놓는 것은 버튼뿐이다.
    */
    setArea((current) => areaAfterIdle(current, next, userMoved))
  }, [])

  /** 카메라를 놓았다 — 다음 `idle` 이 그 결과다 (`framingAfterIdle`) */
  const handleCameraApplied = useCallback(() => {
    if (framingRef.current === 'pending') framingRef.current = 'applied'
  }, [])

  /*
    **기준점으로 옮기는 카메라** (#1177). `MapCanvas` 는 새 객체를 새 틀로 읽으므로 반드시
    `useMemo` 이고, `focus` 가 마운트 때 얼린 값이라 렌더마다 다시 옮기지 않는다.

    - `spanMeters` 는 기준점 영역의 한 변(지름)이다 — 첫 목록이 세는 사각형이 짧은 변에
      통째로 든다. 단계가 정수라 실제 화면은 그보다 넓다(375 폭 레벨 8 ≈ 12km)
    - `anchorRatio` 는 기본(0.35)에 맡긴다. **0.5 가 아니다** — 모바일 시트 `mid`(45dvh)가
      지도 아래 절반을 덮고 위에는 머리·검색 카드가 떠서, 기준점이 보이는 띠가 대략 지도 높이의
      18~47% 다(375×812 에서 머리·검색 바닥 182 · 시트 윗변 383 으로 **계산한 값**이다 — 카카오
      지도가 뜬 상태로는 재지 못했다). 0.5 면 기준점이 시트 윗변에 걸린다. 데스크톱은 시트가 없어 어느
      쪽이든 보인다
    - `refitOnResize` 는 켜지 않는다. 시트·패널은 지도 위에 떠서 컨테이너 크기를 바꾸지 않고,
      창 크기를 바꾼 사람을 처음 틀로 되돌릴 이유도 없다 — `/emergency` 와 같은 판단이다
  */
  const focusCamera = useMemo(
    () =>
      focus === null ? null : { anchor: focus, spanMeters: PLACE_MAP_FOCUS_RADIUS_METERS * 2 },
    [focus],
  )

  /**
   * "이 지역에서 재검색" — 지금 보이는 영역을 조회 자리로 삼는다.
   *
   * **`bounds` 를 그대로 커밋한다.** 중심만 옮기고 반경을 두는 `/emergency` 와 다른데,
   * 그 화면의 반경은 URL 이 소유하는 칩 값이고 이 화면의 반경은 화면에서 역산하기
   * 때문이다 — 축소해 두고 누른 사람은 "더 넓게 찾아 줘" 라고 한 것이다.
   */
  const researchHere = useCallback(() => {
    if (bounds === null) return

    setArea(areaAfterResearch(bounds))
    setResearched(true)
  }, [bounds])

  /*
    ── SDK 실패 → 목록 보기로 옮기는 중 (#1289) ──────────────────────────────
    이동은 `useMapFailureFallback` 이 한다. 예전에는 여기서 안내 한 줄 + 축소판 목록을 그렸는데, 그 목록은
    필터 칩 · 레일 · 초기화가 없어 진짜 목록 보기보다 못했다. 옮기는 한 순간은 아무것도 그리지 않는다.
  */
  if (failure !== null) return null

  /*
    **지도가 조회 자리에서 벗어났으면 "지도에 보이는" 이라고 말하지 않는다.** 목록은
    `searchedBounds` 를 세는데 화면은 다른 곳을 보고 있어, 그대로 두면 캡션이 화면과
    다른 것을 주장한다. 개수 자체는 그대로 참이라 숫자는 두고 문구만 바꾼다 —
    `/emergency` 가 선택·stale 구간에서 쓰는 것과 같은 함수다 (`lib/map/visible-count.ts`).

    `isSameViewport` 는 둘 중 하나가 `null` 이면 `false` 다 — **재검색 전에는 영역 필터가
    아예 걸리지 않으므로** 첫 화면 내내 "목록 N곳" 이다 (#1143). 지도 밖 장소도 목록에
    남아 있으니 "지도에 보이는" 이 거짓이 된다. 예전에는 첫 `idle` 에 필터가 켜지며
    "지도에 보이는 N곳" 으로 바뀌었고, 그때 빠진 행이 레이아웃을 흔들었다.
  */
  const countLine = visibleCountLabel(visible.length, !isSameViewport(searchedBounds, bounds))
  /*
    조회한 자리에서 충분히 벗어났을 때만 재검색을 권한다 (#396). 판정은
    `shouldOfferResearch` 순수 함수가 갖는다 — 임계값이 반경에 비례한다.

    **자는 `originBounds` 다 — `searchedBounds` 가 아니다** (#1143). 재검색 전에는 목록
    영역이 없어도 "첫 화면에서 충분히 벗어났나" 는 재야 한다. 재검색 뒤에는 두 영역이 같다.

    **`originScreenRadius` 를 넘긴다.** 이 화면은 조회 반경을 화면에서 역산하므로
    축소가 곧 "더 넓게 찾아 줘" 다 — 중심이 한 픽셀도 안 움직여도 재조회할 이유가
    생긴다. 반경이 URL 소유인 `/emergency` 는 이 갈래를 켜지 않는다.

    **`suppressed` 가 늘 `false` 다.** 그 인자는 "우리가 카메라를 옮겨 놓고 그 결과를
    아직 재지 못한 구간" 을 막는 것인데, 이 화면은 목록이 `searchedBounds` 를 세므로
    선택-확대가 목록을 흔들지 못한다 — 막을 이유가 없다.
  */
  const offerResearch = shouldOfferResearch({
    bounds,
    origin: originCenter,
    radius: originRadius,
    suppressed: false,
    originScreenRadius: originRadius,
  })
  /** 둘 다 있을 때만 그린다 — 헤더가 토글을 갖는 화면은 주지 않는다 */
  const showToggle = listHref !== undefined && mapHref !== undefined
  /*
    ── 미리보기 (#1227)

    **목록에 없는 id 로도 연다** — 공유 링크 · 재검색 밖으로 나간 장소. 그때는 `summary` 가
    `null` 이고 패널이 상세 응답으로 그린다. 지도 SDK 가 실패한 갈래(목록 폴백)는 위에서 이미
    돌아갔다 — 행이 상세 링크라 미리보기가 할 일이 없다.
  */
  /* 시설을 골랐으면 장소 미리보기는 없다 — 닫히는 `back` 이 오기 전 한 박자도 둘이 겹치지 않게 */
  const previewId = preview && facilityId === null ? selectedId : null
  /** 도킹 칸 · 모바일 미리보기 시트를 장소 미리보기와 시설 요약이 번갈아 쓴다 (D4-3) */
  const docked = previewId !== null || facilityId !== null
  const previewSummary =
    previewId === null ? null : (places.find((place) => place.placeId === previewId) ?? null)
  const closePreview = () => setSelectedId(null)

  return (
    /*
        **높이를 여기서 잡는다.** `map-canvas-height` 는 뷰포트를 정확히 다 쓰므로
        (`calc(100dvh - --header-h - --tabbar-h)`), 캔버스에 걸어 둔 채 위에 헤더를 얹으면
        그 높이만큼 넘쳐 지도 화면에 세로 스크롤이 난다. `fill` 이면 부모가 정한 높이를
        채우고, 아니면 예전처럼 스스로 뷰포트를 채운다 — `/places` 는 픽셀이 같다.
      */
    <div ref={rootRef} className={cn('relative', fill ? 'h-full' : 'map-canvas-height')}>
      {/* 지도가 바탕이다. 데스크톱은 좌측 패널이 그 위에 얹힌다 (아트보드 05) */}
      <MapCanvas
        pins={mapPins}
        /* 장소와 시설은 하나만 고른다 — 시설이 골라져 있으면 그 핀이다 (D3-3) */
        selectedId={facilityId !== null ? facilityPinId(facilityId) : selectedId}
        onSelect={selectOnMap}
        onBoundsChange={handleBounds}
        onCameraApplied={handleCameraApplied}
        camera={focusCamera}
        center={center}
        /* 카드를 누르면 그 핀으로 옮기고 동네가 보이는 단계까지 확대한다 */
        selectedLevel={SELECTED_PLACE_MAP_LEVEL}
        selectedOffset={preview ? selectedOffset : undefined}
        focusMarker={focusMarker}
        squareClusterLabel={messages.map.facilityClusterCount}
        /* 왼쪽은 도킹 스택이 덮는다 — 카카오 로고 · 축척을 우하단으로 비킨다 (#1232 D5) */
        copyrightPosition="right"
        onFailure={setFailure}
        className="h-full w-full"
      />

      {/*
        **"이 지역에서 재검색" — 데스크톱은 지도 하단 중앙, `lg` 미만은 검색 줄 바로 아래** (#396 · #1278). `/emergency` 와 **같은 문구 ·
        같은 모양 · 같은 자리**다 (`messages.map.researchHere`) — 두 지도 화면에서 같은
        일을 하는 컨트롤이 다르게 생기면 안 된다. 근거와 실측은 `emergency-map-view.tsx`
        의 같은 자리에 있다.

        세로 자리는 `.map-research-offset`(globals.css)이 갖는다 — 모바일은 시트에 가려지지
        않게 위에 둔다(#1278).
      */}
      {offerResearch && (
        <div
          className={cn(
            // 데스크톱만 — `lg` 미만은 상단 컨트롤 묶음 맨 아래에 선다(아래, #1278)
            'map-research-offset absolute inset-x-0 z-30 hidden justify-center px-4 lg:flex',
            /*
              **남은 지도의 가운데** (#1232 D4) — 도킹 스택이 왼쪽을 덮으므로 그 폭만큼 비킨다. 1280 부터
              미리보기가 목록 옆에 서면 800, 그 아래는 미리보기가 목록 자리라 400 이다(#1227). 접히면 0.
            */
            panelOpen && 'lg:left-100',
            docked && panelOpen && 'xl:left-200',
          )}
        >
          <ResearchHereButton onClick={researchHere} />
        </div>
      )}

      {/*
        ── 떠 있는 머리 (#556, #1012 에서 호출부에서 옮겨 왔다) — **모바일과 접힌 데스크톱**의 자리

        **데스크톱에서 패널이 열려 있으면 머리는 패널 맨 위 블록이다** (#1232 D9). 패널을 접으면 머리도
        함께 접히는데, 담기 화면의 `일정으로 돌아가기` 는 유일한 퇴로라 그동안만 여기 떠서 닿게 둔다.

        **1440 열이 아니라 왼쪽 기둥(`left-4`)에 붙인다.** 열에 맞추면 폭에 따라 그림이
        갈린다 — 1920 에서는 x=561 이라 지도 한복판에 카드가 혼자 뜬다. 기둥에 붙이면 1024~1920
        어디서나 같은 그림이고, 접힌 패널이 펴질 자리와 같은 쪽이다.

        모바일은 오른쪽 토글 자리를 비운다(`end-32`). `pointer-events-none` 은 바깥 기둥이
        지도를 가로막지 않게 하는 것이고, 누르는 것만 되살린다.

        **우상단 컨트롤보다 앞에 둔다** (#1012 검토). 모바일에서 화면 맨 위에 보이는 것이
        머리와 검색인데, 예전처럼 맨 뒤에 두면 키보드로는 토글 → 내 위치 → 시트 행 수십 개를
        지나야 닿았다 (WCAG 2.4.3). `/places` 의 오버레이 검색이 토글보다 앞인 것과 같은 순서다.
        예전에 맨 뒤였던 이유는 같은 `z-30` 인 시트를 끝까지 올려도 머리가 위에 남게 하려는
        것이었는데, **이제 시트가 머리에 닿지 않는다** — `sheetMaxTopInset` 이 머리+검색 바닥에
        여유를 더한 값이다. 그래서 순서가 쌓임을 정하지 않는다.

        **1024 미만은 검색이 머리 바로 아래다** (#1012). 토글 왼쪽 자리가 머리 카드 밑이라
        거기 두면 보이지 않는 입력이 된다. 1024 이상은 패널 맨 위가 같은 일을 하므로
        `lg:hidden` 이다 — `/places` 의 오버레이 검색과 같은 갈림이다. 폭은 머리 카드와
        같게 둔다(`max-w-md` 를 걸지 않는다): 한 기둥에 선 두 표면의 오른쪽 끝이 어긋나면
        따로 떠 있는 것으로 읽힌다.
      */}
      {hasHead && (
        <div
          className={cn(
            'pointer-events-none absolute start-4 end-32 top-5 z-30 flex flex-col gap-2 lg:end-auto lg:top-6',
            /*
              **데스크톱은 열린 패널 맨 위가 머리 자리다** (#1232 D9). 패널을 접으면 머리도 함께 접히는데
              머리는 담기 화면의 유일한 퇴로라(#556) 그동안만 여기 떠서 닿게 둔다 — 한 번에 하나만 보인다.
            */
            panelOpen && 'lg:hidden',
          )}
        >
          {/*
            **카드 모양은 자리가 정한다** (#1232). 같은 머리가 떠 있을 때는 카드, 패널 안에서는 맨 위
            블록이다 — 호출부는 내용만 넘긴다. 곡률 16(`rounded-xl`)은 §5 가 "떠 있는 것" 에 준 값이고,
            폭 `lg:w-100` 은 `.map-panel-width` 와 같은 400 이다(그 클래스는 `lg:` variant 를 못 만든다).
          */}
          <div className="bg-bg border-border pointer-events-auto rounded-xl border p-3 shadow-lg lg:w-100">
            {head}
          </div>
          {searchable && (
            <PlaceSearchField
              filters={filters}
              compact
              id="place-keyword-head"
              className="pointer-events-auto min-w-0 lg:hidden"
            />
          )}
        </div>
      )}

      {/*
        ── 지도 우상단 컨트롤 ──────────────────────────────────────────────

        **여백이 목록 보기의 헤더와 정확히 같다.** 목록은 `px-4 pt-5 md:px-10 lg:pt-6`
        안에서 제목 오른쪽에 같은 토글을 두는데, 지도가 `top-3 right-3` 이던 탓에 두 보기를
        번갈아 누르면 버튼이 매번 자리를 옮겼다 — 같은 컨트롤이면 같은 자리에 있어야 한다.

        **그 정렬이 1440 위에서 다시 깨져 있었다** (#412). `--content-max`(#376) 가 들어온
        뒤 목록 헤더는 1440 컨테이너 안에 서는데 **지도는 전폭이라 뷰포트 끝을 잡았다**
        (DESIGN.md §7-1 — 지도만 `.rail-layout` 에 가입하지 않는다). 1920 실측으로
        목록 right 1637 · 지도 right 1880, **243px** 벌어졌다 — 정확히 `(1920−1440)/2` 다.
        그래서 뷰포트가 아니라 **콘텐츠 열의 오른쪽 끝**에 매단다. 1440 이하에서는
        `.content-container` 가 전폭이라 예전과 같은 자리(16 / 40)다.

        **`pointer-events-none` 이 필수다.** 바깥 줄이 지도 폭을 가로지르므로, 켜 두면
        상단 띠에서 지도 드래그가 먹지 않는다. 실제로 누르는 스택만 되살린다.

        현재 위치 버튼이 **토글 바로 아래**에 붙으므로 둘을 한 세로 스택으로 묶는다.
        따로 배치하면 토글 높이(44)를 두 곳에서 알아야 한다.

        **왼쪽 도킹 스택은 건드리지 않는다.** 그쪽은 목록 레일(인셋 40)과 원래부터
        다른 값이고, 지도 가장자리에 붙는 것이 그 표면의 의도다 (#1232).
      */}
      <div className="pointer-events-none absolute inset-x-0 top-5 z-30 lg:top-6">
        <div className="content-container flex items-start justify-end gap-2 px-4 md:px-10">
          {/*
            **검색은 토글 왼쪽, 1024 미만에서만** (#596). 그 위는 좌측 패널 머리가 같은
            일을 하므로 둘 다 그리면 데스크톱 지도에 검색창이 둘이 된다.

            **`flex-1 min-w-0` 이라 남는 폭을 먹고 `max-w-md` 로 멈춘다** — 상한이 없으면
            768 에서 입력이 538 로 벌어져 짧은 문구 하나를 담고 지도를 가로로 길게 가린다.
            375 에서는 `flex-1` 이 준 245 가 상한보다 작아 그대로다.

            `items-start` 는 검색(44)과 토글 묶음(토글 44 + 내 위치 44)의 **윗변**을
            맞춘다 — `items-end` 면 검색이 내 위치 버튼 옆까지 내려간다.

            **머리가 있으면 여기 두지 않는다** (#1012). 그 자리가 머리 카드 밑이다 — 아래
            머리 기둥이 대신 그린다.
          */}
          {searchable && !hasHead && (
            <PlaceSearchField
              filters={filters}
              compact
              id="place-keyword-map"
              className="pointer-events-auto max-w-md min-w-0 flex-1 lg:hidden"
            />
          )}

          <div className="pointer-events-auto flex shrink-0 flex-col items-end gap-2">
            {/*
              **폭에 따라 두 벌을 두지 않는다** (#240). 갈 곳 하나만 말하는 글자 버튼이다
              (#1125) — 예전 아이콘 두 칸이 `title` 툴팁으로 메우던 이름을 글자가 직접 말한다.
              높이 44 는 같은 줄의 검색 · 아래 `내 위치` 와 맞춘 값이다.
            */}
            {showToggle && <ViewToggle current="map" listHref={listHref} mapHref={mapHref} />}

            {/*
              **병원 · 약국 토글은 `목록 보기` 아래 · `내 위치` 위다** (#1286 D4-1). `내 위치` 는 늦게 나타나므로
              (`locatable`) 그 아래에 두면 토글이 한 박자 뒤에 밀린다.
            */}
            {facilityLayer && (
              <PlaceMapFacilityToggle
                ref={facilityToggleRef}
                on={facilityOn}
                status={facilityStatus}
                onToggle={toggleFacilityLayer}
              />
            )}

            {/* 제주 밖·거부·미지원이면 렌더하지 않는다 — 눌러도 같은 답이다 */}
            {locatable && <MapLocateButton onLocate={locate} />}
          </div>
        </div>

        {/*
          **병원 · 약국 안내 카드 — 컨트롤 묶음 바로 아래 · 오른쪽 정렬** (#1286 D5). 묶음 기둥 안에 두면
          카드 폭이 기둥을 넓혀 375 에서 검색창을 밀어낸다 — 줄을 따로 둔다. 모바일 재검색 알약보다 위다.
          **카드가 있을 때만 줄을 둔다** — 빈 줄의 `pt-2` 가 재검색 알약을 8px 밀어 내렸다(`hasFacilityNotice`).
        */}
        {facilityLayer && hasFacilityNotice(facilityStatus) && (
          <div className="content-container flex justify-end px-4 pt-2 md:px-10">
            <PlaceMapFacilityNotice
              status={facilityStatus}
              onRetry={() => void facilityQuery.refetch()}
            />
          </div>
        )}

        {/*
          **`lg` 미만의 재검색은 상단 컨트롤 묶음 맨 아래다** (#1278). 하단에 두면 시트 중간 · 최대 단계에
          가려졌다. 흐름 안이라 위 줄(검색 · 보기 전환 · 내 위치)이 커져도 겹치지 않는다.
        */}
        {offerResearch && (
          <div className="flex justify-center px-4 pt-2 lg:hidden">
            <ResearchHereButton onClick={researchHere} />
          </div>
        )}
      </div>

      {/* ── 데스크톱: 왼쪽에 붙은 패널 스택 (#1232) ───────────────────────── */}
      {/*
        **떠 있는 카드가 아니라 화면 왼쪽에 붙는다** (지도패널-도킹-세부명세 D2). 헤더 아래부터 바닥까지,
        바깥 여백 0 · 각진 모서리 · 패널 사이 간격 0 — 목록 오른쪽 경계선이 둘을 가른다. 지도는 전폭
        그대로이고 스택이 그 위에 얹힌다: 지도 폭을 줄이면 여닫을 때마다 `relayout` → `idle` → 재검색
        권유가 떠서 #396 · #1143 의 "옮기지 않았는데 흔들리지 않는다" 가 깨진다.

        ── 여닫기는 **갈아끼우기가 아니라 슬라이드다** (#531). 스택은 항상 마운트된 채 래퍼째 자기 폭만큼
        밀려난다. **`prefers-reduced-motion` 은 전역이 잡는다** (`app/globals.css` 매체질의). 닫힌 스택은
        `inert` 다 — 화면 밖에 있을 뿐 DOM 에 남아, 그대로 두면 Tab 이 보이지 않는 행 수십 개를 지나간다.

        **손잡이는 래퍼의 오른쪽 끝(`left-full`)에 매단다** (D3). 래퍼 폭이 곧 스택 폭이라 목록만 400 ·
        목록 + 미리보기 800 · 미리보기가 목록 자리인 1024~1279 의 400 을 따로 적지 않아도 되고, 래퍼를
        `-100%` 밀면 손잡이가 정확히 x=0 에 남는다. 손잡이는 스택의 **형제**라 접혀도(`inert`) 포커스가 닿는다.
      */}
      <div
        className={cn(
          'absolute inset-y-0 left-0 z-30 hidden transition-transform lg:block',
          !panelOpen && '-translate-x-full',
        )}
      >
        <div
          id={stackId}
          inert={!panelOpen}
          // 그림자는 스택에 하나 — 접혀 있으면 x=0 에 회색 띠로 비친다 (#1123)
          className={cn('relative flex h-full', panelOpen && 'map-dock-shadow')}
        >
          <div
            className={cn(
              'map-panel-width bg-bg border-border flex h-full flex-col overflow-hidden border-r',
              /*
                **1024~1279 는 미리보기가 목록 자리를 쓴다** (#1227). 400 + 400 이면 지도가 224 남는다.
                `invisible` 이라 a11y 트리 · Tab 에서도 빠지고, 목록 스크롤과 선택은 남는다.
              */
              docked && 'lg:max-xl:invisible',
            )}
          >
            {/* 담기 화면의 머리 — 열린 패널의 맨 위 블록이다 (D9). 접혀 있으면 떠 있는 기둥이 대신 그린다 */}
            {hasHead && <div className="border-border border-b p-3">{head}</div>}

            {/*
              **검색이 패널 맨 위다** (#596) — 목록 갈래가 검색을 칩 위에 두는 것과 같은
              순서다. 검색어는 목록을 좁히는 **범위**이고 칩은 그 안의 축이다.

              **`compact` 가 아니다.** 이 패널 툴바 안쪽은 374px 로 목록 갈래의 모바일
              검색(343px)보다 넓다 — 글자 버튼이 들어가는 자리에서 아이콘으로 줄이면 같은
              컨트롤이 이유 없이 화면마다 갈린다. 오버레이만 자리가 없다.
            */}
            {searchable && (
              <div className="border-border border-b px-3 py-2">
                <PlaceSearchField
                  filters={filters}
                  id="place-keyword-panel"
                  className="flex items-start gap-2"
                />
              </div>
            )}

            <div className="border-border border-b px-3 py-2">
              <PlaceMapFilterBar filters={filters} authed={authed} />
            </div>

            {/*
              **`p` 가 아니라 `div` 다** (#1177). 대기 중에는 골격(`Skeleton` 은 `div`)을 품는데 `p`
              안의 `div` 는 HTML 이 허락하지 않아 하이드레이션이 깨진다. 담기 지도가 기준점으로
              열리면 서버 렌더 시점에 주변 조회가 대기 중이라 이 갈래가 처음으로 서버에서 그려졌다.
            */}
            <div className="text-caption text-fg-muted border-border bg-bg-sunken border-b px-4 py-2 font-medium">
              {listPending ? <Skeleton className="h-4.5 w-20" /> : countLine}
            </div>

            {/* `tabIndex={-1}` — Tab 정류장이 아니다. 시설 요약 `‹ 목록` 이 행이 없을 때 포커스를 놓는 자리다 */}
            <div
              ref={listRegionRef}
              tabIndex={-1}
              className="focus-visible:ring-brand-500 min-h-0 flex-1 overflow-y-auto focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-inset"
            >
              {listPending ? (
                <PlaceMapRowsSkeleton />
              ) : nearbyFailed ? (
                nearbyErrorState
              ) : visible.length === 0 ? (
                emptyState
              ) : (
                <PlaceMapPanel
                  places={visible}
                  selectedId={selectedId}
                  onSelect={selectPlace}
                  renderRowAction={renderRowAction}
                  renderRowNotice={renderRowNotice}
                  detailLink={!preview}
                />
              )}
            </div>
          </div>

          {/*
            ── 데스크톱 미리보기 (#1227) — 1280 부터 목록 **바로 옆**(흐름 안, 간격 0), 그 아래는 목록 자리
            (`absolute left-0` — 래퍼 폭에 들지 않아 손잡이가 400 에 남는다).
          */}
          {docked && (
            <div
              ref={previewPanelRef}
              className="map-panel-width bg-bg border-border absolute inset-y-0 left-0 overflow-hidden border-r xl:static"
            >
              {/* 같은 칸을 번갈아 쓴다 — 동시에 하나만 골라져 있어 겹치지 않는다 (#1286 D4-3) */}
              {selectedFacility !== null ? (
                <PlaceMapFacilitySummary
                  key={selectedFacility.facilityId}
                  facility={selectedFacility}
                  variant="panel"
                  onClose={closeFacility}
                  onBackToList={backToListFromFacility}
                />
              ) : previewId !== null ? (
                <PlaceMapPreview
                  key={previewId}
                  placeId={previewId}
                  summary={previewSummary}
                  authed={authed}
                  variant="panel"
                  onClose={closePreview}
                />
              ) : null}
            </div>
          )}
        </div>

        {/*
          ── 손잡이 하나 (D3) — 보이는 가장 오른쪽 패널의 오른쪽 가장자리, 세로 중앙

          예전의 "패널 밖 오른쪽 위 접기 탭" 과 "접힌 뒤 좌상단 펼치기 버튼" 을 하나로 합쳤다 — 손이 두
          군데로 갔다. **접는 대상은 스택 전체다** (D8, 네이버와 같다). 미리보기만 닫는 일은 그 머리의 ✕ 다.
          보이는 탭은 24×48 이고 누르는 자리는 `::before` 로 44 까지 넓힌다(DESIGN.md 44px 하한 — `ViewToggle` 과 같은 수법).
          세로 중앙은 지도 위 컨트롤(위: 보기 전환 · 내 위치, 아래: 재검색 · 축척)과 떨어져 있다.
        */}
        <button
          type="button"
          onClick={() => setPanelOpen((open) => !open)}
          aria-expanded={panelOpen}
          aria-controls={stackId}
          aria-label={panelOpen ? messages.map.collapsePanel : messages.map.expandPanel}
          title={panelOpen ? messages.map.collapsePanel : messages.map.expandPanel}
          className="bg-bg border-border text-fg-muted hover:text-fg focus-visible:ring-brand-500 absolute top-1/2 left-full flex h-12 w-6 -translate-y-1/2 items-center justify-center rounded-r-md border border-l-0 shadow-md before:absolute before:inset-y-0 before:left-0 before:w-11 before:content-[''] focus-visible:ring-2 focus-visible:-outline-offset-2 focus-visible:outline-none"
        >
          {panelOpen ? <ChevronLeftIcon size={16} /> : <ChevronRightIcon size={16} />}
        </button>
      </div>

      {/* ── 모바일: 하단 시트 3단 ────────────────────────────────────────── */}
      <MapSheet
        label="장소 목록"
        /*
          미리보기가 열리면 **같은 자리를 내준다** (#1227). 언마운트하지 않는다 — 닫으면 보던
          목록 스크롤 · 단계 그대로 돌아와야 한다.
        */
        className={cn(docked && 'hidden')}
        stop={sheetStop}
        onStopChange={setSheetStop}
        /*
          시트도 데스크톱 패널과 같은 순서다: **전폭 필터 줄 → 개수.**
          **모바일 지도에는 필터가 아예 없었다** — 목록 칩 줄은 목록 보기에만 붙어 있어서,
          지도에서 조건을 좁히려면 목록으로 되돌아가야 했다.
        */
        toolbar={<PlaceMapFilterBar filters={filters} authed={authed} />}
        header={
          listPending ? (
            <Skeleton className="h-4.5 w-20" />
          ) : (
            <p className="text-caption text-fg-muted truncate font-medium">{countLine}</p>
          )
        }
        /*
          **주지 않으면 지도 위 플로팅 컨트롤 기준이다** (#901 D2). 예전 기본값(85dvh)은
          비율이라 **짧은 기기일수록 검색·보기 전환을 더 덮었다** — 640 실측 24px.
          `/emergency` 와 같은 값을 쓴다: 두 화면의 상단 컨트롤이 같은 자리·같은 크기다.
        */
        maxTopInset={sheetMaxTopInset ?? MAP_TOP_CONTROLS_INSET}
      >
        {listPending ? (
          <PlaceMapRowsSkeleton />
        ) : nearbyFailed ? (
          nearbyErrorState
        ) : visible.length === 0 ? (
          emptyState
        ) : (
          <PlaceMapPanel
            places={visible}
            selectedId={selectedId}
            onSelect={selectPlace}
            renderRowAction={renderRowAction}
            renderRowNotice={renderRowNotice}
            detailLink={!preview}
          />
        )}
      </MapSheet>

      {/*
        모바일 미리보기 — 목록 시트와 **같은 층(`z-30`) · 같은 바닥(탭바 위)**이다. 높이는 내용만큼이고
        상한이 있다(`.map-preview-sheet`) — 위쪽 검색 · 보기 전환을 덮지 않는다.
      */}
      {docked && (
        // 목록 시트(`MapSheet`)와 같은 면이다 — 같은 자리를 번갈아 쓴다
        <div
          ref={previewSheetRef}
          className="map-sheet-clears-tabbar map-preview-sheet bg-bg border-border fixed inset-x-0 z-30 flex flex-col overflow-hidden rounded-t-xl border-t shadow-lg lg:hidden"
        >
          {selectedFacility !== null ? (
            <PlaceMapFacilitySummary
              key={selectedFacility.facilityId}
              facility={selectedFacility}
              variant="sheet"
              onClose={closeFacility}
            />
          ) : previewId !== null ? (
            <PlaceMapPreview
              key={previewId}
              placeId={previewId}
              summary={previewSummary}
              authed={authed}
              variant="sheet"
              onClose={closePreview}
            />
          ) : null}
        </div>
      )}
    </div>
  )
}
