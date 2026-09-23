'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import dynamic from 'next/dynamic'

import { Button } from '@/components/button'
import { EmptyState } from '@/components/empty-state'
import { ErrorState } from '@/components/error-state'
import { ChevronLeftIcon, ChevronRightIcon, SearchIcon } from '@/components/icons'
import { MapSheet, type SheetStop } from '@/components/map-sheet'
import { ViewToggle } from '@/components/view-toggle'
import { EmergencyFilterBar } from '@/features/emergency/emergency-filter-bar'
import { EmergencyFilterChips } from '@/features/emergency/emergency-filter-chips'
import { EmergencyBoardSection } from '@/features/emergency/emergency-list-view'
import { EmergencyMapPanel } from '@/features/emergency/emergency-map-panel'
import { EmergencyMapSkeleton } from '@/features/emergency/emergency-map-skeleton'
import { EmergencySearchField } from '@/features/emergency/emergency-search-field'
import { emergencyBasisLabel } from '@/features/emergency/emergency-summary-line'
import {
  applyFilters,
  countsAreComplete,
  facilityCounts,
  narrowByKeyword,
  reliefLabel,
  reliefs,
} from '@/features/emergency/facility-filters'
import { PositionFallbackHead } from '@/features/emergency/position-fallback-head'
import { useEmergencyBoard } from '@/features/emergency/use-emergency-board'
import type { MapPin } from '@/features/map/map-canvas'
import { MapLocateButton } from '@/features/map/map-locate-button'
import { formatDistance } from '@/lib/format/distance'
import { type LatLng, SELECTED_FACILITY_MAP_LEVEL, toLatLng } from '@/lib/geo/coord'
import type { PositionResult } from '@/lib/geo/current-position'
import { shouldOfferResearch } from '@/lib/map/research-offer'
import type { MapSdkFailure } from '@/lib/map/sdk'
import { boundsCenter, isWithinBounds, type MapBounds } from '@/lib/map/viewport'
import { visibleCountLabel } from '@/lib/map/visible-count'
import { messages } from '@/lib/messages'
import { INSET_CLASS } from '@/lib/ui/inset'
import { cn } from '@/lib/utils/cn'
import type { NearbyFacilityItem } from '@/types/emergency'

/**
 * **`ssr: false` 가 필수다.** SDK 가 `window` 를 읽어 서버 렌더에서 깨진다
 * (docs/external-api-guide.md §1).
 */
const MapCanvas = dynamic(
  () => import('@/features/map/map-canvas').then((module) => module.MapCanvas),
  { ssr: false },
)

/**
 * 병원 · 약국 — 지도 보기. **`/places` 지도 보기와 같은 구조다**
 * (`features/place/place-map-view.tsx`).
 *
 * **`useMediaQuery` 로 갈라 그리지 않는다.** 이전 구현은 감춰진 쪽도 mount 되면
 * `MapCanvas` 가 두 벌 만들어지는 것을 피하려고 브레이크포인트를 값으로 읽었다.
 * 여기는 **지도가 하나**고 패널·시트는 목록 껍데기일 뿐이라 CSS 로 감춰도 비용이 없다 —
 * `/places` 가 같은 이유로 `hidden lg:block` / `lg:hidden` 을 쓴다.
 *
 * **지도를 옮겨도 재조회하지 않는다.** 재조회하면 `distanceMeters` 가 지도 중심 기준이
 * 되어 "가까운 순 · 480m" 이 거짓이 된다. 이동은 이미 받은 배열을 **거를 뿐**이고,
 * 반경 밖으로 나가면 그 자리에서 반경을 넓히도록 한다.
 */
export function EmergencyMapView({ listHref, mapHref }: { listHref: string; mapHref: string }) {
  const board = useEmergencyBoard()

  const [bounds, setBounds] = useState<MapBounds | null>(null)
  /*
    **카메라가 마지막으로 놓은 지도 중심** (#578). 재검색을 권할지는 `board.anchor` 가
    아니라 이것과 비교해 정한다.

    `camera` 는 기준점을 화면 위쪽 35%(`JEJU_MAP_SEA_RATIO`) 지점에 놓으므로 **지도
    중심은 기준점보다 남쪽**이고, 그 거리는 확대 단계에 비례해 커진다(첫 화면 4~5.5km).
    기준점과 비교하면 그 의도된 오프셋이 "사용자가 옮겼다" 로 읽혀, 조작 0회에서
    버튼이 뜨고 누를 때마다 지도가 남하했다.

    **사용자가 끄는 동안에는 갱신되지 않는다** — `camera` 는 기준점·반경이 바뀔 때만
    다시 만들어진다(`useEmergencyBoard`). 그래서 이 값은 "우리가 놓은 자리" 로 남고,
    드래그가 벌린 거리가 그대로 잰다.
  */
  const [cameraCenter, setCameraCenter] = useState<LatLng | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  /*
    선택 순간의 `bounds` 를 얼려 둔다 (B1).

    **선택하면 지도가 `SELECTED_FACILITY_MAP_LEVEL`(4)까지 확대된다** — `setLevel(animate)
    + panTo` 로. 예전 관찰은 *"카카오 SDK 가 이 애니메이션 이동에서는 쓸 만한 `idle` 을
    내지 않는다(10초를 기다려도 `onIdle` 이 다시 안 온다)"* 였고, 그래서 `bounds` 가
    안 바뀌어 목록이 저절로 살아남았다.

    **그 "안 바뀜" 에 기대지 말라고 적어 둔 것이 맞았다.** 2026-09-23 브라우저 실측에서
    **카카오는 이 애니메이션 이동에서도 `idle` 을 낸다** — `bounds` 가 좁아진 레벨 4
    영역으로 실제로 갱신된다. 그래서 이 상태가 없으면 목록이 4곳 안팎으로 줄어 다음
    행을 이어 누를 수 없다(반경 10km 에 136곳 —
    `docs/.../emergency-map-unification-design.md` §4). **선택이 살아 있는 동안 쓸
    `inBounds` 를 선택 시점의 값으로 명시적으로 고정한다** — 이제는 예방이 아니라
    실제로 그 일을 막고 있는 코드다. 수동 드래그는 여전히 `bounds` 를 갱신하고(§5-2),
    선택을 풀면 `frozenBounds` 도 함께 비운다.
  */
  const [frozenBounds, setFrozenBounds] = useState<MapBounds | null>(null)
  /*
    `bounds` 가 지금 실제 지도 프레임과 맞는지 (B1 후속).

    선택 시 `MapCanvas` 가 `setLevel(animate) + panTo` 로 레벨 4 까지 확대한다.
    그 이동이 `idle` 을 내기까지 **한 박자가 빈다** — 그동안 `bounds` 는 확대 전
    프레임 그대로다 (예전 관찰은 그 `idle` 이 아예 안 온다는 것이었는데, 2026-09-23
    실측에서는 온다. 위 `frozenBounds` 설명 참고 — 어느 쪽이든 "아직 못 잰 구간" 이
    있다는 사실은 같다). `frozenBounds` 는 선택이 풀리면 비워지지만, 그렇다고
    `bounds` 가 갑자기 최신이 되는 것은 아니다: 지도는 여전히 확대된 채로 남아 있고
    (`MapCanvas` 는 `selectedId` 가 `null` 이 돼도 되돌아가지 않는다 — 그 효과는
    `selectedId === null` 이면 그냥 return 한다), 실제 팬/줌이 일어나 `onIdle` 이
    다시 올 때까지 `bounds` 는 선택 이전 값 그대로다. 그 상태에서 캡션이 "지도에
    보이는 136곳" 이라고 말하면 거짓이다 — 화면은 도로 단계인데 숫자는 반경
    10km 기준이기 때문이다. 그래서 **`selectedId` 와 별개로** 이 플래그를 둔다:
    선택하는 순간 켜고(`handleSelect`), 진짜 `idle` 이 올 때만 끈다(`handleBounds`).
  */
  const [boundsStale, setBoundsStale] = useState(false)
  const [sheetStop, setSheetStop] = useState<SheetStop>('mid')
  const [panelOpen, setPanelOpen] = useState(true)
  const [failure, setFailure] = useState<MapSdkFailure | null>(null)

  // 선택이 풀리면 얼린 영역도 같이 비운다 — 다음 수동 이동이 다시 `bounds` 를 갱신한다
  useEffect(() => {
    if (selectedId === null) setFrozenBounds(null)
  }, [selectedId])

  /*
    선택이 딛고 선 전제 — `handleSelect` 가 고를 때의 `radius`·`position` 를
    담아 둔다 (review #353, Finding 1 + 2).

    렌더에 쓰이지 않아 `useState` 가 아니라 `ref` 다 — 여기 값이 바뀐다고 다시
    그릴 것이 없다. 아래 해제 effect 만 읽는다.
  */
  const selectionAnchorRef = useRef<{ radius: number; position: PositionResult | null } | null>(
    null,
  )

  const inRadius = board.query.data?.facilities ?? []

  /*
    ── 파이프라인 ───────────────────────────────────────────────────────────

    `inRadius` → `inBounds` → `visible`. **순서가 개수의 정확성을 정한다** —
    칩 개수는 `inBounds`(필터 적용 전)를 세고, 목록과 핀은 `visible` 을 쓴다.

    **좌표가 없는 시설은 영역 필터에서 살린다.** 지도가 판단할 수 없다는 이유로 병원을
    숨기면 안 된다 (`/places` 와 같은 규칙).

    **선택 중에는 `frozenBounds` 를 우선한다** — 바로 위 설명대로다.
  */
  const inBounds = useMemo(() => {
    const effectiveBounds = frozenBounds ?? bounds
    if (effectiveBounds === null) return inRadius

    return inRadius.filter((entry) => {
      const coord = toLatLng(entry)
      return coord === null || isWithinBounds(effectiveBounds, coord)
    })
  }, [inRadius, bounds, frozenBounds])

  const visible = useMemo(() => applyFilters(inBounds, board.filters), [inBounds, board.filters])

  /*
    **선택은 그것이 딛고 있던 전제가 깨지면 놓아준다** — 하나의 규칙으로 두 리뷰
    발견(review #353 Finding 1 · 2)을 함께 고친다.

    - **Finding 1**: 재조회(60초 `staleTime`)나 칩(필터)이 바뀌어 고른 시설이
      `visible` 에서 사라지면, 패널·핀·`aria-pressed` 어디에도 그 행이 없어
      다시 눌러 해제할 방법이 사라진다 — 세션이 끝날 때까지 `frozenBounds` 가
      풀리지 않는 영구 고착이었다.
    - **Finding 2**: `반경 넓히기`/반경 시트나 `내 위치` 는 "다른 영역을 보여줘"
      라는 명시적 조작이다. `radius`·`position` 이 바뀌면 카메라도(§ `camera`
      memo) 실제로 움직이는데, `frozenBounds` 가 옛 프레임을 붙들고 있으면
      목록·칩 개수가 늘지 않는다 — "넓히기" 를 눌렀는데 아무것도 안 넓어진
      것처럼 보인다.

    두 갈래 모두 "선택을 고른 순간의 전제(anchor)가 지금도 참인가" 로 통합된다:
    `handleSelect` 가 채우는 `selectionAnchorRef` 의 `radius`·`position` 이
    지금 값과 같고, 고른 시설이 여전히 `visible` 안에 있어야 유효하다
    (`isSelectionStillValid` — 순수 함수라 `emergency-map-view.test.ts` 가
    표로 고정한다). 셋 중 하나라도 깨지면 `setSelectedId(null)` 만 부른다 —
    그러면 위 `selectedId === null` effect 가 `frozenBounds` 를 마저 비운다.

    **`idle` 을 트리거로 쓰지 않는다.** 선택-확대(`setLevel(animate) + panTo`)
    가 카카오 SDK 에서 쓸 만한 `idle` 을 내지 않는다는 사실은 위 `frozenBounds`
    doc-comment 가 설명하는 SDK 타이밍 사고다 — 그것이 바뀌어 `idle` 이 오기
    시작해도 이 effect 는 여전히 `visible` 멤버십과 anchor 로만 판단하므로
    영향받지 않는다. `idle` 로 풀도록 바꾸면 오히려 그 사고에 기대는 것이 되어
    좁아진 레벨 4 프레임으로 목록이 즉시 몇 곳까지 줄어드는, `frozenBounds` 를
    만든 이유 그 자체가 재발한다.

    **클러스터 클릭 확대는 일부러 그대로 얼어 있다.** `map-canvas.tsx` 의 클러스터
    오버레이는 두 단계 확대 + 팬으로 실제 `idle` 을 낸다(`bounds` 가 갱신된다).
    하지만 그때도 `frozenBounds` 가 우선이라 목록은 그대로다 — 이 effect 가
    고치는 두 발견과 달리 **고착이 아니다**: 고른 시설은 여전히 `visible` 안에
    있으므로(그 행을 다시 누르면) 언제든 풀 수 있다. `radius`/`position` 처럼
    "다른 영역을 보여줘" 로 볼 명시적 신호도 아니다. 그래서 anchor 에 클러스터
    확대는 넣지 않는다 — 알려진 잔존 동작이지 결함이 아니다.

    **무한 루프가 안 나는 이유.** 가드가 `selectedId !== null` 이다 — 한 번
    `setSelectedId(null)` 을 부르면 다음 렌더에서 이 effect 는 그 즉시 return
    하고, 그 뒤로 `visible`·`radius`·`position` 이 아무리 바뀌어도 다시
    `setSelectedId` 를 부르지 않는다. 새로 고르면 `handleSelect` 가 anchor 를
    다시 채우므로 같은 판정이 그 새 선택에 대해 처음부터 다시 시작된다.

    **지도·시트를 움직이지 않는다.** 여기서 하는 일은 상태를 하나 지우는 것뿐이다
    — `MapCanvas` 는 `selectedId` 가 `null` 이 되어도 카메라를 되돌리지 않고
    (아래 `handleSelect` doc-comment 참고), 시트 단계도 이 effect 는 건드리지
    않는다. 수동 재클릭 해제와 동일한 보장이다.
  */
  useEffect(() => {
    if (selectedId === null) return // 해제된 선택은 다시 검사하지 않는다 — 루프 방지

    const anchor = selectionAnchorRef.current
    if (anchor === null) return

    const stillValid = isSelectionStillValid({
      anchorRadius: anchor.radius,
      anchorPosition: anchor.position,
      currentRadius: board.radius,
      currentPosition: board.position,
      selectedId,
      visible,
    })

    if (!stillValid) setSelectedId(null)
  }, [selectedId, board.radius, board.position, visible])

  const pins: MapPin[] = useMemo(
    () =>
      visible.map((entry) => ({
        id: entry.facilityId,
        title: entry.name,
        lat: entry.lat,
        lng: entry.lng,
        caption: board.showDistance ? formatDistance(entry.distanceMeters) : null,
        // 약국은 글자 톤을 낮춘다 — 등급 색을 마커에 쓰지 않는다
        muted: entry.facilityType.code === 'ANIMAL_PHARMACY',
      })),
    [visible, board.showDistance],
  )

  /*
    **고른 시설의 좌표** — 고른 동안 재검색 판정의 기준점이 된다 (`offerResearch`, 아래).

    `visible` 에서 찾는다: 선택이 살아 있는 한 그 행은 `frozenBounds` 덕분에 목록에
    남아 있고, 사라지면 해제 effect 가 선택을 놓아준다(위 `isSelectionStillValid`).
    좌표가 없는 시설이면 `null` 이다 — 그런 시설은 핀이 없어 카메라도 움직이지 않으므로
    기준점을 바꿀 이유가 없다.

    **쓰는 자리가 아니라 여기서 만든다.** 아래 `if (failure !== null)` 이 조기 반환이라,
    그 뒤에 두면 SDK 가 실패하는 순간 훅 개수가 줄어 React 가 터진다 — 폴백 목록이
    통째로 안 그려진다. e2e 가 잡았다 (`emergency-search.spec.ts` 의 지도 갈래 검색 2건:
    `MOCK_API=true` 라 카카오 키가 없어 **항상** 이 갈래로 온다).
  */
  const selectedCoord = useMemo(() => {
    if (selectedId === null) return null

    const entry = visible.find((item) => item.facilityId === selectedId)
    return entry === undefined ? null : toLatLng(entry)
  }, [selectedId, visible])

  const handleBounds = useCallback((next: MapBounds) => {
    // **`userMoved` 를 쓰지 않는다.** 재조회가 없으니 첫 `idle` 과 사용자 이동을
    // 가를 이유가 없다 — 어느 쪽이든 "지금 보이는 영역" 이 답이다
    setBounds(next)
    // 진짜 `idle` 이 왔다 — 지금부터 `bounds` 는 현재 지도 프레임을 신뢰할 수 있다
    setBoundsStale(false)
  }, [])

  /*
    핀·행·제목 세 경로가 모두 이것을 부른다.

    **선택을 토글로 만든다 — 이미 고른 것을 다시 누르면 해제한다.** 이것이
    `frozenBounds` 를 푸는 **유일한** 경로다: 위 effect 는 `selectedId === null`
    일 때만 얼린 영역을 비우는데, 지금 화면에는 그 외에 `selectedId` 를 `null` 로
    되돌리는 트리거가 없다 — 닫기 버튼이 있던 플로팅 선택 카드는 이 브랜치에서
    이미 삭제됐다. 토글이 없으면 한 번 고른 뒤로는 세션 내내 목록이 얼어붙고,
    이후 지도를 드래그해도 목록·칩 개수가 전혀 안 바뀐다(브라우저 실측 — 캡션이
    `목록 136곳` 에 그대로 머무름). `MapCanvas.onBoundsChange` 의 `userMoved` 로
    "사용자가 옮겼다" 를 구분해 그때 풀면 되지 않냐고 생각하기 쉬운데, 그 값은
    선택-확대가 낸 idle 을 포함해 **첫 idle 이후 전부** `true` 라 SDK 가 애니메이션
    이동에서 idle 을 안 낸다는(바로 위 얼리는 이유) 같은 타이밍 사고에 다시 기대는
    것일 뿐이다. 그래서 해제는 명시적인 사용자 조작(재클릭)에만 건다.

    **해제는 어디로도 가지 않는다.** 시트를 올리거나 `frozenBounds` 를 다시 얼리는
    것은 **새로 고를 때**만이다 — 해제는 "그만 볼게" 라는 뜻이지 "다른 곳을 보여줘"
    가 아니다. 시트나 지도가 그 순간 움직이면 사용자가 두 번째 탭에서 화면이
    다시 튀는 것으로 느낀다.

    **시트가 최소 단계면 올린다(새 선택에 한해).** 안 올리면 고른 행이 화면 밖이라
    "눌렀는데 아무 일도 안 일어난다" 로 보인다. 이미 중간·최대면 사용자가 맞춰 둔
    것을 건드리지 않는다.

    **`bounds` 를 이 순간 그대로 얼린다(새 선택에 한해).** 이후 지도가 확대되며
    `bounds` 가 바뀌어도(또는 안 바뀌어도) 목록은 지금 이 영역 기준으로 남는다.
    다른 행을 이어 고르면 그 시점의 `bounds` 로 다시 얼린다 — 그사이 수동 드래그가
    있었다면 그 갱신된 영역을 반영해야 하기 때문이다.

    **`boundsStale` 도 이 순간 켠다(새 선택에 한해).** 지금부터 `MapCanvas` 가
    보고 없이 지도를 확대한다는 것을 아는 유일한 지점이 여기다 — 해제 분기에서는
    켜지 않는다: 해제는 지도를 전혀 움직이지 않으므로(위 설명) 새로 켤 이유가
    없고, 그렇다고 여기서 끄지도 않는다 — 지도는 해제된 뒤에도 여전히 확대된
    채이므로 `bounds` 는 그대로 stale 이다. 끄는 것은 오직 `handleBounds` 뿐이다.

    **`selectionAnchorRef` 도 이 순간 채운다(새 선택에 한해).** 위 `visible` 아래
    해제 effect 가 "지금 `radius`·`position` 이 고를 때와 같은가" 를 판단할 때
    쓰는 기준값이다 — `frozenBounds` 와 같은 순간에 같이 얼려 둔다.
  */
  const handleSelect = useCallback(
    (id: string) => {
      if (selectedId === id) {
        // 해제 — `frozenBounds` 정리는 위 `selectedId === null` effect 가 맡는다.
        // `boundsStale` 은 여기서 건드리지 않는다 — 지도가 실제로는 안 움직였으니
        // (바로 위 설명) `bounds` 가 그 사이 최신이 됐을 리 없다.
        setSelectedId(null)
        return
      }

      setSelectedId(id)
      setFrozenBounds(bounds)
      setBoundsStale(true)
      selectionAnchorRef.current = { radius: board.radius, position: board.position }
      setSheetStop((stop) => (stop === 'min' ? 'mid' : stop))
    },
    [selectedId, bounds, board.radius, board.position],
  )

  // ── SDK 실패 → 목록으로 되돌리고 안내 한 줄 ──────────────────────────────
  if (failure !== null) {
    return (
      <div>
        {/* 안내 한 줄 — 배너(링크형)가 아니다. 갈 곳이 없고 알릴 사실만 있다 */}
        <p
          role="status"
          className={cn(
            'text-caption text-fg-muted bg-bg-sunken border-border border-b py-3 font-medium',
            // 아래 칩·목록과 같은 축 — 값이 한 곳(`inset.ts`)에 있어야 한 곳만 어긋난다
            INSET_CLASS.main,
          )}
        >
          {failureMessage(failure)}
        </p>
        {/*
          **레일이 없으니 칩은 모든 폭에서 남는다** — `lg:hidden` 을 걸지 않는다 (공통명세 E0 ·
          E5). 이 갈래는 카드가 없는 페이지라(`Canvas` 도 `Surface` 도 없다 — `/places`
          폴백 #452 와 같다) 인셋은 페이지 값 `main` 이다. 칩 아래 선(`divider`)은 위 안내 줄과
          같은 L0 위 스트립 규약이다.

          개수는 **반경 전량**을 센다 — 지도 없이 목록만 있으니 목록 갈래와 같은 기준이다.
          단 검색어까지는 먼저 좁힌다 (#584) — 검색어는 축이 아니라 범위다
          (`facilityCounts` 머리주석).
        */}
        {/*
          **검색도 이 갈래에 남아야 한다** (#584). 이 폴백은 카카오 키 도메인이 안 맞을 때
          **항상** 오는 경로라 예외가 아니고(E5), 여기서는 목록 갈래가 통째로 대체된다 —
          입력을 빼면 `?keyword=` 를 달고 들어온 사용자가 그것을 지울 방법이 없다
          (`EmergencyFilterChips` 에는 `초기화` 가 없고, 0건일 때의 완화 버튼뿐이다).
          지도 갈래에 검색을 두지 않는다는 판단은 **지도가 실제로 그려질 때**의 이야기다.

          인셋은 아래 칩·목록과 같은 페이지 값 `main` 이다.
        */}
        {/*
          **위치 폴백 블록이 이 갈래에도 선다** (#639). `EmergencySection` 이 갖고 있던
          `PositionNotice` 가 카드 머리로 올라가면서, 여기에 다시 세우지 않으면 이 갈래만
          "왜 거리가 없는지" 를 말하지 않게 된다 — 카카오 키 도메인이 안 맞을 때 **항상**
          오는 경로라 예외가 아니다 (공통명세 E5).

          카드가 없는 페이지라 인셋은 아래 칩·목록과 같은 `main` 이다.
        */}
        <PositionFallbackHead
          reason={board.fallback}
          regionCode={board.regionCode}
          onRegionChange={board.researchAtRegion}
          onLocate={board.locate}
          inset="main"
        />
        <EmergencySearchField
          filters={board.filters}
          onFiltersChange={board.setFilters}
          className={cn('pt-3', INSET_CLASS.main)}
        />
        <EmergencyFilterChips
          filters={board.filters}
          onFiltersChange={board.setFilters}
          radius={board.radius}
          onRadiusChange={board.setRadius}
          counts={facilityCounts(narrowByKeyword(inRadius, board.filters.keyword))}
          showCounts={board.query.data !== undefined && countsAreComplete(board.query.data)}
          inset="main"
          divider
        />
        {/* **자기 보드를 넘긴다.** `EmergencyListView` 를 렌더하면 보드가 두 벌이 된다.
         **`inset="main"` 이다** — 카드가 아니다 (`EmergencyBoardSection` 머리주석) */}
        <EmergencyBoardSection board={board} inset="main" />
      </div>
    )
  }

  /*
    "지도에 보이는" 이라는 주장을 감출 두 상태를 하나로 합친다 — 선택 중이거나,
    선택은 풀렸어도 `bounds` 가 아직 그 선택-확대를 반영하지 못한 상태(`boundsStale`).
    후자를 빼면 해제 직후 캡션이 이미 확대된 지도 앞에서 "지도에 보이는 136곳" 으로
    돌아가 버린다 — `boundsStale` 위 doc-comment 가 설명하는 바로 그 결함이다.
  */
  const hideViewportClaim = selectedId !== null || boundsStale
  const countLine = `${visibleCountLabel(visible.length, hideViewportClaim)} · ${messages.emergency.radiusLabel.replace('{radius}', formatDistance(board.radius))}`
  /*
    거리·정렬의 기준을 말한다 — 네 갈래다 (#396 · #639). 재검색·권역으로 기준점을 옮기면
    거리는 여전히 진짜 거리지만 **내 위치에서가 아니다.** 감추지 않고 기준을 바꿔 말한다:
    사용자가 직접 밀어 놓고 누른 자리라 그 자리에서 480m 인 것은 알고 싶은 사실이다.

    **문구 갈래는 목록 갈래와 같은 함수가 갖는다** (`emergencyBasisLabel`) — 인라인으로
    두면 한쪽만 고쳐져 같은 화면의 두 보기가 다른 기준을 주장한다.
  */
  const basisLine = emergencyBasisLabel(board.basis, board.regionCode)

  /*
    조회한 자리에서 충분히 벗어났을 때만 재검색을 권한다 (#396). 판정은
    `shouldOfferResearch` 순수 함수가 갖는다 — 임계값이 반경에 비례한다.

    **고른 동안에는 기준점이 "그 핀" 이다.** 예전에는 `selected: selectedId !== null`
    로 아예 막았고, 그래서 시설을 고른 뒤에는 **사용자가 지도를 직접 끌어도** 버튼이
    뜨지 않았다 — 한 곳을 보다가 옆 동네를 확인하려면 선택부터 풀어야 했다.

    그렇다고 `cameraCenter` 로만 재면 반대로 **고르자마자** 버튼이 뜬다: 선택은 지도를
    `SELECTED_FACILITY_MAP_LEVEL` 까지 확대하며 그 핀으로 옮기는데, 그 이동은 사용자가
    "다른 지역을 보겠다" 고 한 것이 아니라 우리가 한 일이다 (브라우저 실측 — 카카오는
    이 애니메이션 이동에서도 `idle` 을 내므로 `bounds` 가 실제로 그 좁은 프레임으로
    갱신된다. 위 `frozenBounds`·`boundsStale` doc-comment 가 "쓸 만한 `idle` 을 내지
    않는다" 고 적어 둔 관찰은 **더 이상 기대면 안 되는 것**이 됐다).

    **우리가 옮겨 놓은 자리를 기준으로 삼으면 두 요구가 동시에 만족된다** — 고른 직후에는
    지도 중심이 곧 그 핀이라 이동량이 0 이라 뜨지 않고, 거기서 사용자가 반경의 30% 를
    넘게 끌면 고른 상태 그대로 뜬다. `/places` 는 반대로 선택에도 버튼을 띄우는데
    (사용자 결정), 그 화면은 선택이 목록을 흔들지 않아 "여기를 다시 찾자" 가 늘 참이다.

    `suppressed` 는 그대로 `boundsStale` 이다 — 선택 직후 아직 `idle` 이 오지 않아
    `bounds` 가 옛 프레임인 구간을 막는다. 위 관찰이 다시 뒤집혀 `idle` 이 아예 오지
    않게 되어도 이 조합은 그대로 맞는다.

    **확대·축소 갈래(`originScreenRadius`)는 켜지 않는다.** 이 화면의 반경은 URL 이
    소유하는 칩 값이고 재검색은 그것을 그대로 두므로, 줌으로 뜬 버튼을 눌러도 조회
    범위가 안 바뀐다 — `/places` 만 그 갈래를 쓴다 (`research-offer.ts`).
  */
  const offerResearch = shouldOfferResearch({
    bounds,
    origin: selectedCoord ?? cameraCenter,
    radius: board.radius,
    suppressed: boundsStale,
  })

  const body = (
    <PanelBody
      board={board}
      inBounds={inBounds}
      visible={visible}
      selectedId={selectedId}
      onSelect={handleSelect}
    />
  )

  const toolbar = (
    <EmergencyFilterBar
      /* 검색어까지 좁힌 뒤 세게 한다 (#584) — 검색어는 축이 아니라 범위다 */
      facilities={narrowByKeyword(inBounds, board.filters.keyword)}
      filters={board.filters}
      onFiltersChange={board.setFilters}
      radius={board.radius}
      onRadiusChange={board.setRadius}
      showCounts={board.query.data === undefined ? false : countsAreComplete(board.query.data)}
    />
  )

  const caption = (
    <div className="flex items-baseline justify-between gap-3">
      <p className="text-caption text-fg-muted font-medium tabular-nums">{countLine}</p>
      <p className="text-caption text-fg-muted shrink-0 font-medium">{basisLine}</p>
    </div>
  )

  return (
    <div className="relative">
      {/* 지도가 바탕이다. 데스크톱은 좌측 패널이 그 위에 얹힌다 */}
      <MapCanvas
        pins={pins}
        selectedId={selectedId}
        onSelect={handleSelect}
        onBoundsChange={handleBounds}
        onCameraApplied={setCameraCenter}
        camera={board.camera}
        /* 고르면 도로가 읽히는 단계까지 확대한다 — `/places` 보다 한 단계 깊다 */
        selectedLevel={SELECTED_FACILITY_MAP_LEVEL}
        onFailure={setFailure}
        className="map-canvas-height w-full"
      />

      {/*
        **"이 지역에서 재검색" — 지도 하단 중앙** (#396). 네이버·구글 지도가 쓰는 자리이고
        형태다. `/places` 처럼 자동으로 재조회하지 않는 이유는 PR #373 에 있다 — 거리 기준이
        모르는 사이에 바뀌면 안 된다. 재조회 시점을 사용자가 쥐면 그 우려가 "모르는 사이에"
        에서 "누른 뒤에" 로 내려온다.

        **`rounded-full` 은 `ScrollRailArrows` 가 이미 낸 예외를 따른다** — DESIGN.md §5 의
        원형은 사진·아바타 몫이지만, 이것은 **면 위에 떠 있는 오버레이**라 아래 지도의
        사각 격자와 같은 모양이면 지도의 일부로 읽힌다.

        세로 자리는 `.map-research-offset`(globals.css)이 갖는다 — 모바일 시트 최소 단계를
        피해야 해서 그 계산이 CSS 에 있다.
      */}
      {offerResearch && bounds !== null && (
        <div className="map-research-offset absolute inset-x-0 z-30 flex justify-center px-4">
          <button
            type="button"
            onClick={() => board.researchAt(boundsCenter(bounds))}
            className="text-body-2 bg-bg text-fg border-border hover:bg-band focus-visible:ring-brand-500 inline-flex h-11 max-w-full items-center gap-2 rounded-full border px-5 font-semibold whitespace-nowrap shadow-md transition-colors focus-visible:ring-2 focus-visible:outline-none"
          >
            <SearchIcon size={16} />
            {messages.map.researchHere}
          </button>
        </div>
      )}

      {/*
        여백이 `/places` 지도 보기와 정확히 같다 — 같은 컨트롤이면 같은 자리에 있어야 한다.
        **뷰포트가 아니라 콘텐츠 열(1440)의 오른쪽 끝에 매단다** (#412) — 지도는 전폭이고
        목록 보기 헤더는 `--content-max` 안이라, 그러지 않으면 1440 위에서 같은 토글이 두
        보기에서 다른 자리에 선다. 근거와 실측은 `place-map-view.tsx` 의 같은 자리에 있다.
      */}
      <div className="pointer-events-none absolute inset-x-0 top-5 z-30 lg:top-6">
        <div className="content-container flex items-start justify-end gap-2 px-4 md:px-10">
          {/*
            **검색은 토글 **왼쪽**, 1024 미만에서만** (#584). 그 위는 좌측 패널 머리가
            같은 일을 하고(아래), 둘 다 그리면 데스크톱 지도에 검색창이 둘이 된다.

            **`flex-1 min-w-0` 이라 남는 폭을 전부 먹는다** — 토글·내 위치 버튼은
            `shrink-0` 로 자기 크기를 지키므로, 375 에서 245 / 768 에서 590 이 검색 몫이다.
            `items-start` 는 검색(44)과 토글 묶음(토글 44 + 내 위치 44)의 **윗변**을 맞춘다:
            `items-end` 면 검색이 내 위치 버튼 옆까지 내려간다.
          */}
          <EmergencySearchField
            filters={board.filters}
            onFiltersChange={board.setFilters}
            compact
            id="emergency-keyword-map"
            /*
              **`max-w-md` 로 상한을 둔다.** 768 실측에서 상한이 없으면 입력이 538px 로
              벌어져, 짧은 placeholder 하나를 담고 지도를 가로로 길게 가린다. 375 에서는
              `flex-1` 이 준 245 가 상한보다 작아 그대로다 — 좁은 쪽은 손대지 않는다.
            */
            className="pointer-events-auto max-w-md min-w-0 flex-1 lg:hidden"
          />

          <div className="pointer-events-auto flex shrink-0 flex-col items-end gap-2">
            <ViewToggle
              current="map"
              listHref={listHref}
              mapHref={mapHref}
              variant="icon"
              className="shadow-md"
            />

            {/* 제주 밖이면 렌더하지 않는다 — 눌러도 갈 곳이 없다 */}
            {board.inJeju && <MapLocateButton onLocate={board.locate} />}
          </div>
        </div>

        {/*
          **위치 안내는 지도 위 · 검색 줄 아래다** (#883). 시트 본문 맨 위에 있던 동안에는
          `현재 위치로 다시 찾기` 를 보려면 **시트를 올려야 했다** — 위치를 못 받아 거리
          기준이 흔들린 바로 그 상태에서, 그것을 되돌리는 손잡이가 한 단계 뒤에 접혀 있었다.
          여기로 올리면 시트 본문은 통째로 목록에 돌아간다.

          **`lg:hidden` 이다.** 데스크톱은 좌측 패널이 같은 안내를 검색·필터 아래에 이미
          세운다(아래) — 둘 다 그리면 같은 문장이 한 화면에 두 번 뜬다.

          바깥 컨테이너가 `pointer-events-none` 이라 **면에 다시 켜 준다** — 안 켜면 안내
          안의 다시 찾기 버튼이 눌리지 않는다. 지도 타일 위에 뜨는 글이라 면과 테두리를
          함께 둔다(`.map-research-offset` 알약과 같은 판단).
        */}
        {board.fallback !== null && (
          <div className="content-container px-4 pt-2 md:px-10 lg:hidden">
            <div className="bg-bg border-border pointer-events-auto max-w-md rounded-lg border px-3 py-2 shadow-md">
              <PositionNotice reason={board.fallback} onRetry={board.locate} />
            </div>
          </div>
        )}
      </div>

      {/* ── 데스크톱: 좌측 400 고정 패널 ─────────────────────────────────── */}
      <div
        className={cn(
          // 상단은 보기 전환 토글과 같은 높이(lg 헤더의 pt-6). 하단 32 는 카카오
          // 축척·로고 막대(바닥 0~19px)를 피한 값이다 — 줄이면 축척이 눌려 보인다
          'absolute top-6 bottom-8 left-4 z-30 hidden lg:block',
          panelOpen ? 'map-panel-width' : 'w-auto',
        )}
      >
        {panelOpen ? (
          // 접기 탭이 패널 밖으로 튀어나오므로 여기서 자르지 않는다
          <div className="relative h-full">
            <div className="bg-bg border-border flex h-full w-full flex-col overflow-hidden rounded-xl rounded-tr-none border shadow-lg">
              {/*
                **검색이 패널 맨 위다** (#584) — 목록 갈래가 검색을 칩 위에 두는 것과 같은
                순서다. 검색어는 축이 아니라 **범위**이고 칩은 그 안을 좁힌다
                (`facility-filters.ts` 의 `narrowByKeyword`).

                **`compact` 가 아니다.** 이 패널 툴바 안쪽은 374px 로 목록 갈래의 모바일
                검색(343px)보다 넓다 — 글자 버튼이 들어가는 자리에서 아이콘으로 줄이면
                같은 컨트롤이 화면마다 다른 이유 없이 갈린다. 오버레이만 자리가 없다.
              */}
              <div className="border-border border-b px-3 py-2">
                <EmergencySearchField
                  filters={board.filters}
                  onFiltersChange={board.setFilters}
                  id="emergency-keyword-panel"
                />
              </div>

              <div className="border-border border-b px-3 py-2">{toolbar}</div>

              {board.fallback !== null && (
                <div className="border-border border-b px-4 py-3">
                  <PositionNotice reason={board.fallback} onRetry={board.locate} />
                </div>
              )}

              <div className="border-border bg-bg-sunken border-b px-4 py-2">{caption}</div>

              <div className="min-h-0 flex-1 overflow-y-auto">{body}</div>
            </div>

            {/* 책갈피처럼 오른쪽 모서리에 물린다 — 안쪽 머리에 두면 목록의 컨트롤로 읽힌다.
                높이는 닫혔을 때 펼치기 버튼이 서는 자리와 같다 (top-0 · 44) */}
            <button
              type="button"
              onClick={() => setPanelOpen(false)}
              aria-expanded
              aria-label={messages.map.collapsePanel}
              title={messages.map.collapsePanel}
              className="bg-bg border-border text-fg-muted hover:text-fg focus-visible:ring-brand-500 absolute top-0 -right-6 flex h-11 w-6 items-center justify-center rounded-r-lg border border-l-0 shadow-md focus-visible:ring-2 focus-visible:-outline-offset-2 focus-visible:outline-none"
            >
              <ChevronLeftIcon size={16} />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setPanelOpen(true)}
            aria-expanded={false}
            aria-label={messages.map.expandPanel}
            className="bg-bg border-border text-fg-muted hover:text-fg focus-visible:ring-brand-500 flex size-11 items-center justify-center rounded-xl border shadow-lg focus-visible:ring-2 focus-visible:outline-none"
          >
            <ChevronRightIcon size={20} />
          </button>
        )}
      </div>

      {/* ── 모바일: 하단 시트 3단 ────────────────────────────────────────── */}
      {/*
        **시트 본문은 목록만 갖는다** (#883). 위치 안내는 지도 위로 올라갔다(위) — 여기
        맨 위에 있던 동안에는 한 번 읽고 마는 설명이 목록 자리를 먹었고, 그 안의
        `현재 위치로 다시 찾기` 는 시트를 올려야 보였다.

        개수 줄(`caption`)은 `header` 슬롯이라 **스크롤 영역 밖**이고 최소 단계에서도 남는다
        (`map-sheet.tsx`) — 본문을 차지하지 않는다.
      */}
      <MapSheet
        label={messages.emergency.sheetLabel}
        stop={sheetStop}
        onStopChange={setSheetStop}
        toolbar={toolbar}
        header={caption}
      >
        {body}
      </MapSheet>
    </div>
  )
}

/**
 * 패널·시트 안의 본문 — 로딩 / 오류 / 0건 두 갈래 / 목록.
 *
 * **패널과 시트가 같은 함수를 쓴다.** 두 곳에 같은 분기를 쓰면 한쪽만 고쳐진다.
 */
function PanelBody({
  board,
  inBounds,
  visible,
  selectedId,
  onSelect,
}: {
  board: ReturnType<typeof useEmergencyBoard>
  inBounds: NearbyFacilityItem[]
  visible: NearbyFacilityItem[]
  selectedId: string | null
  onSelect: (id: string) => void
}) {
  // 좌표를 기다리는 동안에도 로딩이다 — 조회는 아직 시작도 못 했다
  if (board.position === null || board.query.isPending) return <EmergencyMapSkeleton />

  if (board.query.error !== null || board.query.data === undefined) {
    return (
      <ErrorState
        title={messages.emergency.errorTitle}
        description={messages.common.temporaryErrorDescription}
        onRetry={() => void board.query.refetch()}
        inset="panel"
      />
    )
  }

  /*
    **0건을 두 갈래로 가른다.**
     - 영역 안이 비었다 → 지도를 조회 범위 밖으로 옮긴 것이다. 반경이 답이다
     - 영역 안은 있는데 필터로 0 이 됐다 → 무엇을 끄면 몇 개인지 세어 준다
  */
  if (inBounds.length === 0) {
    return (
      <EmptyState
        title={messages.map.emptyInView}
        description={messages.emergency.emptyInViewDescription}
        action={
          board.canWiden ? (
            <Button variant="secondary" onClick={board.widenRadius}>
              {messages.emergency.widenRadius}
            </Button>
          ) : undefined
        }
        inset="panel"
      />
    )
  }

  if (visible.length === 0) {
    const options = reliefs(inBounds, board.filters)

    /* 무엇으로 찾았는지 되돌려 준다 (#584) — `EmergencySection` 의 0건과 같은 규칙이다 */
    const title =
      board.filters.keyword === null
        ? messages.emergency.narrowedTitle
        : messages.emergency.searchNarrowedTitle.replace('{keyword}', board.filters.keyword)

    /* 잘린 목록에서 "없어요" 를 확언하지 않는다 — `EmergencySection` 과 같은 규칙 (#584) */
    const truncated = board.query.data !== undefined && !countsAreComplete(board.query.data)

    return (
      <div className="flex flex-col items-start gap-2 px-4 py-6">
        <h3 className="text-title-2 text-fg font-semibold">{title}</h3>

        {truncated && board.filters.keyword !== null && (
          <p className="text-body-2 text-fg-muted break-keep">
            {messages.emergency.searchTruncatedNote}
          </p>
        )}

        <div className="mt-1 flex flex-wrap gap-2">
          {options.map((option) => (
            <Button
              key={option.kind}
              variant="secondary"
              onClick={() => board.setFilters(option.next)}
            >
              {reliefLabel(option)}
            </Button>
          ))}
        </div>
      </div>
    )
  }

  return (
    <EmergencyMapPanel
      facilities={visible}
      selectedId={selectedId}
      onSelect={onSelect}
      showDistance={board.showDistance}
    />
  )
}

/**
 * 위치를 못 얻었을 때. **목록을 지우지 않고 그 위에 얹는다.**
 *
 * **이 블록의 높이는 모바일 시트에서 load-bearing 이다.** 375px 시트 `mid` 단계는
 * 스크롤 영역이 204px 뿐이고, 첫 시설 행(183px, 52px 전화 버튼이 117px 지점에서
 * 끝난다)이 첫 화면에 보이려면 이 블록이 109px 을 넘으면 안 된다. **한 줄로 줄여도
 * (B2) 부족했다** — 문구 한 줄(~22px) 아래에 다시 시도 링크가 `h-11` 블록으로 자기
 * 줄을 새로 차지해 안내문 전체가 70px(문구 22 + 링크 44 + 사이 여백)이 됐고, 바깥
 * `py-3` 테두리(24+1)를 더하면 95px — 부족분 8px 이 바로 저 전화 버튼을 시트
 * 스크롤 영역 밖으로 8px 밀어낸다. **그래서 지금은 링크를 별도 줄이 아니라 문장
 * 안의 인라인 단어로 넣는다** — `<p>` 하나에 안내문과 링크를 같은 텍스트 흐름으로
 * 넣어 두 줄(문구가 길면)로만 접히게 한다(줄당 `text-body-2` 라인하이트 22px, 총
 * ~44px). **다음에 이 블록에 줄을 하나라도 더 얹으면(문구를 늘리거나 링크를 다시
 * 별도 줄로 뺴면) 저 전화 버튼이 다시 화면 밖으로 밀려난다** — 이 doc-comment 를
 * 먼저 갱신할 것.
 *
 * **네 갈래를 여전히 가른다.** `unsupported` · `outside` 는 다시 시도해도 답이 같아
 * 링크 자체를 두지 않는다 — 버튼을 눈에 덜 띄게 줄인 것이 아니라 아예 없다.
 *
 * **링크가 문장 줄 안에 있어도 누르는 자리를 44 로 지킨다** (§7 하한이 아니라 이 자리의 선택이다 · #883).
 * 글자 크기를 줄이거나 링크를 별도 블록으로 빼서 맞추지 않는다 — `py-3`(상하 각
 * 12px)로 히트 영역을 키우고, 그만큼을 `-my-3` 음수 마진으로 되돌려 문단의 줄
 * 높이(레이아웃)에는 반영되지 않게 한다. `text-body-2` 라인하이트가 22px이므로
 * 히트 박스는 22 + 24 = **46px** — 링크가 문장 한가운데 있어도 44 를 넘는다. 패딩(히트 영역)과 마진(줄 높이 상쇄)은 서로 다른 역할이라 하나가 없으면
 * 이 트릭이 성립하지 않는다.
 */
export function PositionNotice({
  reason,
  onRetry,
}: {
  reason: NonNullable<ReturnType<typeof useEmergencyBoard>['fallback']>
  onRetry: () => void
}) {
  const text =
    reason === 'denied'
      ? messages.emergency.positionDenied
      : reason === 'unsupported'
        ? messages.emergency.positionUnsupported
        : reason === 'outside'
          ? messages.emergency.positionOutside
          : messages.emergency.positionTimeout

  // **다시 시도할 것이 없는 두 갈래에는 링크를 두지 않는다.** 미지원 브라우저는
  // 눌러도 같은 답이고, 제주 밖은 좌표를 이미 정확히 받은 상태다.
  const canRetry = reason !== 'unsupported' && reason !== 'outside'

  return (
    <p className="text-body-2 text-fg break-keep">
      {text}
      {canRetry && (
        <>
          {' '}
          <button
            type="button"
            onClick={onRetry}
            className={cn(
              // `text-link` 는 DESIGN.md 가 "링크 · 인라인 액션" 으로 정의한 토큰이다 —
              // 이 자리(문장 안의 인라인 다시 시도)가 정확히 그 용도다
              'text-link hover:text-link-hover rounded-md font-semibold',
              'focus-visible:ring-brand-500 focus-visible:ring-2 focus-visible:outline-none',
              // 누르는 자리 44 를 만들되(py-3 = 상하 12px) 줄 높이에는 남기지 않는다
              // (-my-3 로 그만큼 되돌린다) — 위 doc-comment 의 46px 계산 참고
              '-my-3 px-1 py-3',
            )}
          >
            {messages.emergency.retryPosition}
          </button>
        </>
      )}
    </p>
  )
}

/**
 * 선택이 지금도 유효한가 (review #353 Finding 1 + 2) — `EmergencyMapView` 의
 * 해제 effect 가 매 렌더 판단에 쓰는 순수 predicate. 세 조건을 모두 만족해야
 * 유효하다:
 *  1. 고를 때의 `radius`(anchor)가 지금 `radius` 와 같다 — 다르면 반경을
 *     넓히거나 좁힌 것이다(Finding 2)
 *  2. 고를 때의 `position`(anchor)이 지금 `position` 과 같은 참조다 — 다르면
 *     `내 위치` 를 다시 눌러 새 좌표를 받은 것이다(Finding 2). 좌표값이 우연히
 *     같아도 `locate()` 는 매번 새 `PositionResult` 객체를 만들므로 참조
 *     비교로 충분하다 — "다시 눌렀다" 는 사실 자체가 신호다
 *  3. 고른 시설이 지금 `visible` 안에 있다 — 없으면 필터·재조회로 목록에서
 *     빠진 것이다(Finding 1)
 *
 * 지도·좌표·SDK 를 몰라도 되는 순수 로직이라 여기 분리해 표로 고정한다
 * (`emergency-map-view.test.ts`) — effect 자체는 상태 전이라 브라우저로만
 * 검증한다.
 */
export function isSelectionStillValid(params: {
  anchorRadius: number
  anchorPosition: PositionResult | null
  currentRadius: number
  currentPosition: PositionResult | null
  selectedId: string
  visible: NearbyFacilityItem[]
}): boolean {
  if (params.anchorRadius !== params.currentRadius) return false
  if (params.anchorPosition !== params.currentPosition) return false
  return params.visible.some((entry) => entry.facilityId === params.selectedId)
}

function failureMessage(reason: MapSdkFailure): string {
  if (reason === 'no-key') return messages.map.errorNoKey
  if (reason === 'unsupported') return messages.map.errorUnsupported
  return messages.map.errorScript
}
