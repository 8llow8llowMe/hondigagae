'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import dynamic from 'next/dynamic'

import { Button } from '@/components/button'
import { EmptyState } from '@/components/empty-state'
import { ErrorState } from '@/components/error-state'
import { ChevronLeftIcon, ChevronRightIcon } from '@/components/icons'
import { MapSheet, type SheetStop } from '@/components/map-sheet'
import { ViewToggle } from '@/components/view-toggle'
import { EmergencyFilterBar } from '@/features/emergency/emergency-filter-bar'
import { EmergencyBoardSection } from '@/features/emergency/emergency-list-view'
import { EmergencyMapPanel } from '@/features/emergency/emergency-map-panel'
import { EmergencyMapSkeleton } from '@/features/emergency/emergency-map-skeleton'
import {
  applyFilters,
  countsAreComplete,
  type FilterRelief,
  reliefs,
} from '@/features/emergency/facility-filters'
import { useEmergencyBoard } from '@/features/emergency/use-emergency-board'
import type { MapPin } from '@/features/map/map-canvas'
import { MapLocateButton } from '@/features/map/map-locate-button'
import { formatDistance } from '@/lib/format/distance'
import { SELECTED_FACILITY_MAP_LEVEL, toLatLng } from '@/lib/geo/coord'
import type { MapSdkFailure } from '@/lib/map/sdk'
import { isWithinBounds, type MapBounds } from '@/lib/map/viewport'
import { messages } from '@/lib/messages'
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
  const [selectedId, setSelectedId] = useState<string | null>(null)
  /*
    선택 순간의 `bounds` 를 얼려 둔다 (B1).

    **선택하면 지도가 `SELECTED_FACILITY_MAP_LEVEL`(4)까지 확대된다** — 그런데 그
    확대는 `setLevel(animate) + panTo` 로 이루어지고, 카카오 SDK 가 이 애니메이션
    이동에서는 쓸 만한 `idle` 을 내지 않는다(브라우저 실측 — 10초를 기다려도 `onIdle`
    이 다시 안 온다). 그래서 `bounds` 자체는 지금도 바뀌지 않고 목록이 살아남는다.

    **그 "안 바뀜" 에 기대면 안 된다.** 그것은 SDK 타이밍의 사고이지 우리가 만든
    규칙이 아니다 — 다음 SDK 버전이 그 애니메이션에서도 `idle` 을 내는 순간, 좁아진
    레벨 4 영역으로 `bounds` 가 실제로 갱신되고 목록이 4곳 안팎으로 줄어 다음 행을
    이어 누를 수 없게 된다(반경 10km 에 136곳 — `docs/.../emergency-map-unification-design.md`
    §4). 그래서 **선택이 살아 있는 동안 쓸 `inBounds` 를 선택 시점의 값으로 명시적으로
    고정한다.** 수동 드래그는 여전히 `bounds` 를 갱신하고(§5-2), 선택을 풀면
    `frozenBounds` 도 함께 비운다.
  */
  const [frozenBounds, setFrozenBounds] = useState<MapBounds | null>(null)
  const [sheetStop, setSheetStop] = useState<SheetStop>('mid')
  const [panelOpen, setPanelOpen] = useState(true)
  const [failure, setFailure] = useState<MapSdkFailure | null>(null)

  // 선택이 풀리면 얼린 영역도 같이 비운다 — 다음 수동 이동이 다시 `bounds` 를 갱신한다
  useEffect(() => {
    if (selectedId === null) setFrozenBounds(null)
  }, [selectedId])

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

  const handleBounds = useCallback((next: MapBounds) => {
    // **`userMoved` 를 쓰지 않는다.** 재조회가 없으니 첫 `idle` 과 사용자 이동을
    // 가를 이유가 없다 — 어느 쪽이든 "지금 보이는 영역" 이 답이다
    setBounds(next)
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
  */
  const handleSelect = useCallback(
    (id: string) => {
      if (selectedId === id) {
        // 해제 — `frozenBounds` 정리는 위 `selectedId === null` effect 가 맡는다.
        setSelectedId(null)
        return
      }

      setSelectedId(id)
      setFrozenBounds(bounds)
      setSheetStop((stop) => (stop === 'min' ? 'mid' : stop))
    },
    [selectedId, bounds],
  )

  // ── SDK 실패 → 목록으로 되돌리고 안내 한 줄 ──────────────────────────────
  if (failure !== null) {
    return (
      <div>
        {/* 안내 한 줄 — 배너(링크형)가 아니다. 갈 곳이 없고 알릴 사실만 있다 */}
        <p
          role="status"
          className="text-caption text-fg-muted bg-bg-sunken border-border border-b px-4 py-3 font-medium md:px-10"
        >
          {failureMessage(failure)}
        </p>
        {/* **자기 보드를 넘긴다.** `EmergencyListView` 를 렌더하면 보드가 두 벌이 된다 */}
        <EmergencyBoardSection board={board} />
      </div>
    )
  }

  const countLine = `${visibleCountLabel(visible.length, selectedId !== null)} · ${messages.emergency.radiusLabel.replace('{radius}', formatDistance(board.radius))}`
  const basisLine = board.showDistance
    ? messages.emergency.basisCurrent
    : messages.emergency.basisJeju

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
      facilities={inBounds}
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
        camera={board.camera}
        /* 고르면 도로가 읽히는 단계까지 확대한다 — `/places` 보다 한 단계 깊다 */
        selectedLevel={SELECTED_FACILITY_MAP_LEVEL}
        onFailure={setFailure}
        className="map-canvas-height w-full"
      />

      {/* 여백이 `/places` 지도 보기와 정확히 같다 — 같은 컨트롤이면 같은 자리에 있어야 한다 */}
      <div className="absolute top-5 right-4 z-30 flex flex-col items-end gap-2 md:right-10 lg:top-6">
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
        **시트에서는 위치 안내가 캡션 줄 아래에 온다** — 패널과 순서가 다르다.
        `MapSheet` 에 `header` 위 슬롯이 없고, 그것을 위해 prop 을 더하면 `/places` 도
        같이 바뀐다. 한 번 읽고 마는 설명이라 스크롤 영역 맨 위가 맞는 자리다.
      */}
      <MapSheet
        label={messages.emergency.sheetLabel}
        stop={sheetStop}
        onStopChange={setSheetStop}
        toolbar={toolbar}
        header={caption}
      >
        {board.fallback !== null && (
          <div className="border-border border-b px-4 py-3">
            <PositionNotice reason={board.fallback} onRetry={board.locate} />
          </div>
        )}
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

    return (
      <div className="flex flex-col items-start gap-2 px-4 py-6">
        <h3 className="text-title-2 text-fg font-semibold">{messages.emergency.narrowedTitle}</h3>
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
 * **한 줄이다 (B2).** 두 줄 문구 + 별도 44px 버튼 블록이던 이전 모양은 375px 시트
 * `mid` 단계에서 칩 두 줄 + 캡션 + 이 안내를 합치면 첫 행의 52px 전화 버튼이 화면
 * 아래로 밀려났다 — 이 화면이 지도를 기본으로 바꾼 근거("시트가 열리면 행과 전화
 * 버튼이 이미 보인다")가 폴백 상태에서는 거짓이 되는 결함이었다. 다시 시도는 문장
 * 끝에 붙는 **인라인 링크**로 줄여 안내 전체를 한 줄(짧으면) 또는 줄바꿈 없는 한
 * 문단으로 좁힌다.
 *
 * **네 갈래를 여전히 가른다.** `unsupported` · `outside` 는 다시 시도해도 답이 같아
 * 링크 자체를 두지 않는다 — 버튼을 눈에 덜 띄게 줄인 것이 아니라 아예 없다.
 *
 * **링크의 터치 영역은 44px 를 유지한다** (`DESIGN.md` §7). 글자 크기를 줄이거나
 * 버튼 높이를 낮춰 맞추지 않는다 — `h-11` 그대로 두고, 짧은 안내문 옆에 나란히 서도록
 * **줄(행)이 items-center 로 정렬해 세로 여백을 흡수**한다. 그래서 다시 시도가 없는
 * 두 갈래는 이 만큼의 세로 공간도 필요 없어 한층 더 얕아진다.
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
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
      <p className="text-body-2 text-fg break-keep">{text}</p>
      {canRetry && (
        <button
          type="button"
          onClick={onRetry}
          className={cn(
            // `text-link` 는 DESIGN.md 가 "링크 · 인라인 액션" 으로 정의한 토큰이다 —
            // 이 자리(문장 끝의 인라인 다시 시도)가 정확히 그 용도다
            'text-link hover:text-link-hover shrink-0 rounded-md font-semibold',
            'focus-visible:ring-brand-500 focus-visible:ring-2 focus-visible:outline-none',
            // 44px 터치 영역 — 글자는 본문 크기 그대로, 상하 여백으로만 높이를 채운다
            'flex h-11 items-center px-1',
          )}
        >
          {messages.emergency.retryPosition}
        </button>
      )}
    </div>
  )
}

/**
 * 캡션의 개수 라벨 (B1). `selected` 가 `true` 면 `messages.map.visibleCount`("지도에
 * 보이는 {n}곳") 대신 `messages.emergency.selectedCount`("목록 {n}곳") 를 쓴다.
 *
 * **선택 중에는 "지도에 보이는" 이라고 말하지 않는다.** 선택하면 지도가 확대되어
 * 실제 프레임과 `frozenBounds` 가 어긋나므로, 그 주장은 그 순간 거짓이 된다. 개수
 * 자체(목록 길이)는 얼려도 참이라 숫자는 그대로 두고 문구만 바꾼다 — 순수 함수라
 * `emergency-map-view.test.ts` 가 문자열로 고정한다.
 */
export function visibleCountLabel(count: number, selected: boolean): string {
  const template = selected ? messages.emergency.selectedCount : messages.map.visibleCount
  return template.replace('{n}', String(count))
}

function reliefLabel(option: FilterRelief): string {
  const template =
    option.kind === 'openNowOnly'
      ? messages.emergency.reliefOpenNow
      : option.kind === 'open24Only'
        ? messages.emergency.reliefOpen24
        : messages.emergency.reliefType

  return template.replace('{n}', String(option.count))
}

function failureMessage(reason: MapSdkFailure): string {
  if (reason === 'no-key') return messages.map.errorNoKey
  if (reason === 'unsupported') return messages.map.errorUnsupported
  return messages.map.errorScript
}
