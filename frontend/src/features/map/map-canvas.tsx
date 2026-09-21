'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

import {
  JEJU_MAP_ANCHOR,
  JEJU_MAP_LEVEL,
  JEJU_MAP_SEA_RATIO,
  type LatLng,
  toLatLng,
} from '@/lib/geo/coord'
import {
  cellSizeFor,
  clusterByGrid,
  clusterMarkerLabel,
  clusterMarkerText,
} from '@/lib/map/cluster'
import type { MapRouteSegment } from '@/lib/map/route'
import { loadKakaoMaps, MapSdkError, type MapSdkFailure } from '@/lib/map/sdk'
import { MAP_LAYER_Z, markerZIndex } from '@/lib/map/stacking'
import { framedCamera, framedCenterLat, type MapBounds } from '@/lib/map/viewport'
import { messages } from '@/lib/messages'
import { cn } from '@/lib/utils/cn'
import type {
  KakaoCustomOverlay,
  KakaoLatLng,
  KakaoMap,
  KakaoMaps,
  KakaoPolyline,
  KakaoStrokeStyle,
} from '@/types/kakao-maps'

/**
 * MapCanvas — SDK 수명주기를 감당하는 유일한 곳.
 *
 * **반드시 `dynamic(..., { ssr: false })` 로 임포트한다.** 직접 임포트하면
 * 빌드/런타임이 깨진다 (docs/external-api-guide.md §1).
 *
 * 담당하는 것
 *  - SDK 1회 로드와 실패 폴백 통지 (`onFailure`)
 *  - 오버레이 생성과 **이전 오버레이 `setMap(null)` 제거** — 이 SDK 의 대표 누수다
 *  - 선택 강조: **크기와 라벨로 구분한다. 등급 색을 마커에 쓰지 않는다**
 *    (아트보드 05 "목록↔지도 대응은 색이 아니라 크기와 라벨로 만든다")
 *  - 묶음 마커 — `lib/map/cluster.ts` 가 계산하고 여기서는 그리기만 한다
 *
 * 담당하지 않는 것: 데이터 조회, 목록 렌더, 시트/패널 레이아웃.
 *
 * 오버레이 내용을 JSX 가 아니라 DOM API 로 만드는 이유: `CustomOverlay` 는 문자열이나
 * `HTMLElement` 만 받는다. React 트리 밖이므로 **정리 책임이 전부 이 컴포넌트에 있다.**
 */

/**
 * 확대 애니메이션 길이. **뒤따르는 중심 이동을 언제 시작할지도 이 값이 정한다** —
 * 짧게 잡으면 확대가 끝나기 전에 이동이 끼어들어 튀고, 길게 잡으면 두 동작 사이가 끊긴다.
 * `panTo` 의 지속시간은 SDK 가 정하고 바꿀 수 없어서, 맞출 수 있는 쪽을 여기에 맞춘다.
 */
const ZOOM_MS = 300

/** 어지럼을 줄여야 하는 사용자인가. 모르면 `false` — 기본은 부드러운 이동이다 */
function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export type MapPin = {
  id: string
  title: string
  lat: number | null
  lng: number | null
  /** 선택됐을 때 라벨에 함께 붙는 보조 문구 (예: `480m`). 없으면 `null` */
  caption?: string | null
  /** 낮춤 표현. 긴급 시설의 약국이 쓴다 — 판정 색이 아니라 톤 낮춤이다 */
  muted?: boolean
  /**
   * 동선의 순번(#743). 주면 **이름표 대신 숫자 원**으로 그린다.
   *
   * 4~6곳이 1km 안에 몰리는 하루 동선에서 이름표를 다 펴면 서로 덮어 아무것도 못 읽는다
   * — `/places` 가 이름표를 쓰는 이유(어느 곳인지 눌러봐야 안다)가 여기서는 성립하지
   * 않는다. **순서가 곧 그 핀의 신원**이고, 이름은 고르면 붙는다.
   */
  order?: number
}

/**
 * 선 톤별 그리기 값. **색은 하나고 굵기·패턴만 다르다** (`lib/map/route.ts` 주석).
 *
 * `dashed` 는 어제 잔 숙소에서 들어오는 구간이라 한 단계 낮춘다 — 오늘의 이동이 아니다.
 */
const ROUTE_STROKE: Record<
  MapRouteSegment['tone'],
  { weight: number; style: KakaoStrokeStyle; opacity: number }
> = {
  default: { weight: 4, style: 'solid', opacity: 0.9 },
  dashed: { weight: 3, style: 'shortdash', opacity: 0.7 },
  emphasis: { weight: 7, style: 'solid', opacity: 0.9 },
}

/**
 * 선색을 토큰에서 읽는다. **선은 캔버스라 CSS 가 닿지 않는다** — `strokeColor` 는
 * 계산된 색 문자열이어야 하고 `var(--brand-500)` 을 넘기면 SDK 가 조용히 무시한다.
 *
 * 그래서 값을 런타임에 읽어 쓴다. 상수로 박으면 `DESIGN.md` 팔레트가 바뀔 때 여기만
 * 남는다 — `lib/brand/chrome-colors.ts` 가 meta 태그 속성에서 같은 문제를 겪는다.
 *
 * 아래 폴백은 **토큰을 못 읽었을 때만** 쓰인다(스타일시트가 아직 안 붙은 순간). 선이
 * 통째로 사라지는 것보다 한 톤 어긋난 초록이 낫다.
 */
// eslint-disable-next-line no-restricted-syntax -- 위 주석 참고: 캔버스는 CSS 변수를 못 읽는다. `--brand-500` 의 값과 같게 유지한다
const ROUTE_COLOR_FALLBACK = '#2e9b6b'

function routeColor(): string {
  if (typeof window === 'undefined') return ROUTE_COLOR_FALLBACK

  const token = window
    .getComputedStyle(document.documentElement)
    .getPropertyValue('--brand-500')
    .trim()

  return token === '' ? ROUTE_COLOR_FALLBACK : token
}

export function MapCanvas({
  pins,
  route,
  selectedId,
  onSelect,
  onBoundsChange,
  onCameraApplied,
  center,
  camera,
  selectedLevel,
  onFailure,
  className,
}: {
  pins: MapPin[]
  /**
   * 순서대로 이을 선. 구간마다 하나씩이고 **핀과 따로 그려진다**.
   *
   * 모델은 `lib/map/route.ts` 가 만든다 — 여기서는 그리기만 한다 (`cluster.ts` 와 같은
   * 역할 분담이다).
   */
  route?: MapRouteSegment[] | null
  selectedId: string | null
  onSelect: (id: string) => void
  /**
   * 지도가 멈춘 뒤(`idle`) 현재 영역을 알린다. "보이는 곳" 개수와 재검색이 쓴다.
   *
   * **`userMoved` 가 첫 영역과 사용자의 이동을 가른다.** 지도를 만들면 `idle` 이 한 번
   * 그냥 발생하는데 그것을 이동으로 세면, 화면에 들어오자마자 프리페치한 목록 캐시를
   * 버리고 주변 검색으로 갈아탄다 (architecture-guide.md §9 "지도 뷰: 별도 조회 금지").
   */
  onBoundsChange?: (bounds: MapBounds, userMoved: boolean) => void
  /**
   * **카메라가 지도 중심을 어디에 놓았는지** 알린다 — 이슈 #578.
   *
   * `camera` 는 기준점을 화면 정중앙이 아니라 위쪽 `seaRatio` 지점에 놓으므로
   * (`framedCamera`) **실제 지도 중심은 기준점과 다르다.** 그 차이를 모르는 바깥에서는
   * "지도가 옮겨졌는지" 를 기준점과 비교해 재게 되고, 그러면 **우리가 만든 프레이밍
   * 오프셋이 사용자의 이동으로 읽힌다.**
   *
   * 그래서 놓은 자리를 그대로 돌려준다 — 이것을 아는 곳이 여기뿐이다
   * (컨테이너 크기와 확대 단계가 여기에만 있다).
   */
  onCameraApplied?: (center: LatLng) => void
  /** 지도 중심을 밖에서 옮길 때 (현재 위치 버튼). 같은 값을 다시 주면 움직이지 않는다 */
  center?: LatLng | null
  /**
   * **기준점 + 담고 싶은 폭으로 카메라를 확정한다.** `center` 와 달리 확대 단계까지 함께
   * 옮긴다.
   *
   * 좌표를 비동기로 얻는 화면(`/emergency`)이 쓴다. 지도는 모듈 상수 기준으로 **먼저**
   * 만들고, 좌표가 도착하면 이것으로 한 번 옮긴다 — `position` 을 기다렸다가 만들면
   * 위치 타임아웃(10초)만큼 지도가 비어 있다.
   *
   * **호출부는 반드시 `useMemo` 로 만든다.** 렌더 중에 새 객체를 만들면 참조가 매번
   * 바뀌어 필터를 누를 때마다 카메라가 되돌아간다.
   */
  camera?: {
    anchor: LatLng
    spanMeters: number
    /**
     * 기준점이 화면 위쪽 몇 할 지점에 올지. 생략하면 `JEJU_MAP_SEA_RATIO`(0.35) —
     * 제주 전체를 담는 화면에서 위쪽을 바다로 여는 값이다.
     *
     * **한 곳만 담는 지도는 `0.5` 를 넘긴다.** 그 화면에는 바다도 맥락도 없고 주인공이
     * 하나라, 0.35 면 핀이 이유 없이 위로 치우쳐 보인다 (`PlaceMiniMap`).
     */
    anchorRatio?: number
  } | null
  /**
   * 핀을 고르면 이 단계까지 **확대**한다. 주지 않으면 이동만 한다.
   *
   * 이미 이 단계보다 가까우면 건드리지 않는다 — 사용자가 맞춰 둔 확대를 되돌리는 것은
   * 고르는 일과 무관하다.
   */
  selectedLevel?: number
  /** SDK 를 못 쓰면 호출부가 목록으로 되돌린다 */
  onFailure?: (reason: MapSdkFailure) => void
  className?: string
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<KakaoMap | null>(null)
  const mapsRef = useRef<KakaoMaps | null>(null)
  const overlaysRef = useRef<KakaoCustomOverlay[]>([])
  /*
    **오버레이와 같은 배열에 태우지 않는다.** 핀 effect 는 매번 `overlaysRef` 를 통째로
    비우고 다시 그리는데(`pins` 는 조회 결과라 자주 새 배열이 된다), 선이 거기 섞여 있으면
    핀이 갱신될 때마다 선도 함께 지워졌다 그려져 깜빡인다. 정리 책임은 아래 언마운트
    정리에서 **두 배열 모두** 진다.
  */
  const polylinesRef = useRef<KakaoPolyline[]>([])

  const [status, setStatus] = useState<'loading' | 'ready' | 'failed'>('loading')
  /** 확대 단계 — 묶음 셀 크기가 여기서 갈린다 */
  const [level, setLevel] = useState(JEJU_MAP_LEVEL)
  /** 지도 생성 직후의 첫 `idle` 인가. 그것은 사용자의 이동이 아니다 */
  const settledRef = useRef(false)

  // 콜백을 ref 로 들고 다닌다 — 부모가 인라인 함수를 넘겨도 지도를 재생성하지 않는다.
  // 재생성은 사용자가 맞춰 둔 확대·위치를 통째로 날리는 사고다
  const selectRef = useRef(onSelect)
  const boundsRef = useRef(onBoundsChange)
  const failureRef = useRef(onFailure)
  const cameraAppliedRef = useRef(onCameraApplied)
  useEffect(() => {
    selectRef.current = onSelect
    boundsRef.current = onBoundsChange
    failureRef.current = onFailure
    cameraAppliedRef.current = onCameraApplied
  })

  // ── 지도 생성. **의존성이 비어 있어야 한다** ──────────────────────────────
  useEffect(() => {
    let disposed = false
    const container = containerRef.current
    if (container === null) return

    let idleHandler: (() => void) | null = null

    void loadKakaoMaps()
      .then((maps) => {
        if (disposed) return

        mapsRef.current = maps

        /*
          **첫 중심은 지도를 만들기 전에 정한다.** 만든 뒤에 `setCenter` 로 옮기면 그
          이동이 `idle` 을 한 번 더 부르고, 아래 `settledRef` 판정에서 그것이 사용자의
          이동으로 세어져 첫 화면부터 주변 검색으로 갈아탄다.

          그래서 컨테이너 높이와 확대 단계로 위도 폭을 환산해 역산한다
          (`framedCenterLat`) — 화면 위쪽 35% 가 바다, 그 아래가 육지로 열린다.
        */
        const map = new maps.Map(container, {
          center: new maps.LatLng(
            framedCenterLat(
              JEJU_MAP_ANCHOR.lat,
              container.clientHeight,
              JEJU_MAP_LEVEL,
              JEJU_MAP_SEA_RATIO,
            ),
            JEJU_MAP_ANCHOR.lng,
          ),
          level: JEJU_MAP_LEVEL,
        })
        mapRef.current = map

        idleHandler = () => {
          setLevel(map.getLevel())
          const bounds = map.getBounds()
          const userMoved = settledRef.current
          settledRef.current = true
          boundsRef.current?.(toMapBounds(bounds.getSouthWest(), bounds.getNorthEast()), userMoved)
        }
        maps.event.addListener(map, 'idle', idleHandler)

        setStatus('ready')
        // 탭·시트 뒤에서 생성되면 컨테이너 크기가 0 이다. 노출 직후 되잡는다
        map.relayout()
        idleHandler()
      })
      .catch((error: unknown) => {
        if (disposed) return
        setStatus('failed')
        failureRef.current?.(error instanceof MapSdkError ? error.reason : 'script')
      })

    return () => {
      disposed = true
      settledRef.current = false

      const map = mapRef.current
      const maps = mapsRef.current
      if (map !== null && maps !== null && idleHandler !== null) {
        maps.event.removeListener(map, 'idle', idleHandler)
      }

      for (const overlay of overlaysRef.current) overlay.setMap(null)
      overlaysRef.current = []

      // 선도 마커와 같은 누수 경로를 갖는다 — 지우지 않으면 지도를 다시 만들 때 남는다
      for (const polyline of polylinesRef.current) polyline.setMap(null)
      polylinesRef.current = []

      mapRef.current = null
      mapsRef.current = null
    }
  }, [])

  // ── 오버레이 동기화 ──────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current
    const maps = mapsRef.current
    if (map === null || maps === null || status !== 'ready') return

    // **먼저 지운다.** 새로 그린 뒤에 지우면 한 프레임 동안 두 배로 겹치고,
    // 아예 안 지우면 필터를 만질 때마다 마커가 누적된다 — 이 SDK 의 대표 누수
    for (const overlay of overlaysRef.current) overlay.setMap(null)
    overlaysRef.current = []

    const positioned = pins.flatMap((pin) => {
      const coord = toLatLng(pin)
      // 좌표가 없거나 0 이면 그리지 않는다 — 기니 만에 핀이 찍힌다
      return coord === null ? [] : [{ item: pin, coord }]
    })

    /*
      **순번 핀은 묶지 않는다** (#743). 묶음은 "이 구역에 여럿" 을 한 원으로 접는 장치인데,
      동선에서는 그 여럿의 **순서**가 내용이다. 접는 순간 선은 그대로 남고 핀만 사라져
      "선이 지나가는데 점이 없는" 지도가 된다.

      하루 동선은 4~6곳이라 묶을 이유도 없다 — 묶음이 푸는 문제(밀집 구간의 겹침)는
      수백 곳을 한 화면에 그리는 `/places` 의 것이다.
    */
    const ordered = pins.some((pin) => pin.order !== undefined)

    const groups = clusterByGrid(positioned, ordered ? 0 : cellSizeFor(level))
    const created: KakaoCustomOverlay[] = []

    for (const group of groups) {
      const isCluster = group.items.length > 1
      const first = group.items[0]
      if (first === undefined) continue

      const content = isCluster
        ? clusterElement(group.items.length, () => {
            // 묶음을 누르면 그 구역으로 확대한다 (아트보드 05)
            map.setLevel(Math.max(1, map.getLevel() - 2))
            map.panTo(new maps.LatLng(group.center.lat, group.center.lng))
          })
        : pinElement(first, first.id === selectedId, () => selectRef.current(first.id))

      const overlay = new maps.CustomOverlay({
        position: new maps.LatLng(group.center.lat, group.center.lng),
        content,
        /*
          **핀과 묶음이 좌표를 잡는 자리가 다르다.**

          핀은 이름표라 아래 끝이 그 자리를 가리킨다(`yAnchor: 1`). 묶음은 원이고
          가리킬 뾰족한 끝이 없어서 **원의 중심**을 좌표에 놓는다(`0.5`) — 1 로 두면
          원이 좌표 위쪽에 통째로 떠서, 이웃한 묶음끼리 가로로 어긋난 것처럼 읽힌다.

          **고르지 않은 순번 핀도 원이라 같은 자리를 쓴다** (#743). 여기서 1 로 두면 선은
          좌표를 잇는데 원은 그 위에 떠서, 선이 핀 아래를 스쳐 지나가는 것처럼 보인다.
          고르면 이름표로 바뀌므로 그때는 다시 1 이다.
        */
        yAnchor: isCluster || (first.order !== undefined && first.id !== selectedId) ? 0.5 : 1,
        /*
          **묶음 > 선택 핀 > 일반 핀.** 순서와 근거는 `lib/map/stacking.ts` 에 있다 —
          축이 둘 섞인 삼항을 여기 인라인으로 두었던 탓에 *"원이 통째로 덮여 누를 수 없는
          묶음이 된다"* 는 근거를 적어 두고도 **선택 핀 축만 빠뜨린 채** 살아남았다
          (#671 A-1). 순수 함수로 빼서 `stacking.test.ts` 가 부등식을 잠근다.
        */
        zIndex: markerZIndex({ isCluster, selected: first.id === selectedId }),
        clickable: true,
      })
      overlay.setMap(map)
      created.push(overlay)
    }

    overlaysRef.current = created
  }, [pins, selectedId, status, level])

  // ── 동선 선 ──────────────────────────────────────────────────────────────
  /*
    **핀 effect 와 합치지 않는다.** 둘은 갱신 주기가 다르다 — 핀은 선택·확대 단계마다
    다시 그려지고(묶음이 풀리고 맺힌다), 선은 일자가 바뀔 때만 바뀐다. 한 effect 에 두면
    핀을 건드리는 모든 이유가 선을 다시 그리게 되어, 도로 경로처럼 늦게 오는 좌표를
    얹을 때(레인 B) 한 프레임씩 깜빡인다.

    **선은 묶지 않는다.** `cluster` 는 핀의 겹침을 푸는 장치인데, 선은 겹쳐도 읽히고
    묶으면 순서가 사라진다.
  */
  useEffect(() => {
    const map = mapRef.current
    const maps = mapsRef.current
    if (map === null || maps === null || status !== 'ready') return

    // 먼저 지운다 — 핀과 같은 이유다. 새로 그린 뒤 지우면 한 프레임 겹친다
    for (const polyline of polylinesRef.current) polyline.setMap(null)
    polylinesRef.current = []

    if (route === null || route === undefined) return

    const color = routeColor()

    polylinesRef.current = route.map((segment) => {
      const stroke = ROUTE_STROKE[segment.tone]

      const polyline = new maps.Polyline({
        path: segment.path.map((coord) => new maps.LatLng(coord.lat, coord.lng)),
        strokeWeight: stroke.weight,
        strokeColor: color,
        strokeOpacity: stroke.opacity,
        strokeStyle: stroke.style,
        // 모든 마커 아래다. 선이 핀을 덮으면 이름표가 잘려 읽히지 않는다
        zIndex: MAP_LAYER_Z.route,
      })
      polyline.setMap(map)

      return polyline
    })
  }, [route, status])

  /*
    ── 선택 핀으로 부드럽게 이동 ────────────────────────────────────────────

    **`pins` 를 의존성에 넣으면 지도가 되돌아온다** (#240). `pins` 는 조회 결과라
    지도를 옮길 때마다 새 배열이 되는데, 그것이 이 effect 를 다시 돌려 **선택된 핀으로
    `panTo`** 하고, 그 이동이 또 `idle` → 재조회 → 새 `pins` 를 만들어 사용자가 지도를
    옮길 수 없게 된다 (실측: '지도 이동 시 재검색' 을 켜면 같은 자리로 계속 돌아왔다).

    그래서 **`selectedId` 가 바뀔 때만** 움직인다. 좌표는 ref 로 최신 `pins` 에서 읽는다 —
    선택은 사용자 행동이고 조회 결과 갱신은 아니다.
  */
  const pinsRef = useRef(pins)
  pinsRef.current = pins

  useEffect(() => {
    const map = mapRef.current
    const maps = mapsRef.current
    if (map === null || maps === null || selectedId === null) return

    const pin = pinsRef.current.find((candidate) => candidate.id === selectedId)
    const coord = pin === undefined ? null : toLatLng(pin)
    if (coord === null) return

    const target = new maps.LatLng(coord.lat, coord.lng)
    const zoomIn = selectedLevel !== undefined && map.getLevel() > selectedLevel

    /*
      **어지럼을 줄여야 하는 사용자에게는 즉시 이동한다.**

      `app/globals.css` 의 `prefers-reduced-motion` 규칙은 CSS 애니메이션·전환만 끈다.
      지도의 이동·확대는 SDK 가 JS 로 그리는 것이라 그 규칙이 닿지 않는다 — 여기서
      직접 판정해야 한다 (`components/scroll-rail.tsx` 는 CSS 가 덮어 주므로 분기가 없다).
    */
    if (prefersReducedMotion()) {
      map.setCenter(target)
      if (zoomIn) map.setLevel(selectedLevel)
      return
    }

    if (!zoomIn) {
      map.panTo(target)
      return
    }

    /*
      ── 확대(핀 고정) → 중심 맞추기 ─────────────────────────────────────────

      **둘을 동시에 걸 수 없다.** 같은 변환을 두 애니메이션이 함께 밀면 중간에서 튄다.
      그래서 순서를 둬야 하는데, 순서가 틀어졌을 때 **덜 나쁜 쪽**을 고른다.

      이동 먼저(`panTo` → `setLevel`)는 위험하다. 이동이 실행되지 않은 채 확대만 걸리면
      **옛 중심을 확대**해서 고른 장소가 화면에서 아예 사라진다 (dev 실측: 목록이
      "지도에 보이는 0곳" 이 됐다).

      그래서 `anchor` 로 **핀을 화면에 붙여 둔 채** 확대한다. 뒤따르는 중심 맞추기가
      실행되지 않아도 고른 장소는 화면 안에 남는다 — 가운데가 아닐 뿐이다.
      확대 후에는 같은 화면 거리가 좁은 실거리라 `panTo` 도 부드럽게 움직인다
      (`panTo` 는 이동 거리가 화면보다 크면 애니메이션 없이 순간 이동한다).
    */
    map.setLevel(selectedLevel, { animate: { duration: ZOOM_MS }, anchor: target })

    const timer = setTimeout(() => {
      // 지도가 사라졌을 수 있다 (언마운트·SDK 실패) — ref 로 다시 확인한다
      mapRef.current?.panTo(target)
    }, ZOOM_MS)

    return () => clearTimeout(timer)
  }, [selectedId, selectedLevel])

  // ── 밖에서 중심을 옮길 때 (현재 위치 버튼) ───────────────────────────────
  useEffect(() => {
    const map = mapRef.current
    const maps = mapsRef.current
    if (map === null || maps === null || center === null || center === undefined) return

    map.setCenter(new maps.LatLng(center.lat, center.lng))
  }, [center])

  /*
    ── 밖에서 카메라를 확정할 때 (좌표가 늦게 도착하는 화면) ────────────────

    **`center` effect 와 나란히 두고 합치지 않는다.** 둘이 하는 일이 다르다 —
    `center` 는 확대를 건드리지 않고 옮기기만 하고(사용자가 맞춰 둔 확대를 지킨다),
    이쪽은 확대까지 확정한다(조회 범위와 보이는 범위를 맞춘다). 한 effect 로 묶으면
    어느 쪽 의도로 불렸는지 알 수 없다.

    컨테이너 크기를 여기서 읽는다 — 이 컴포넌트가 그것을 아는 유일한 곳이다.
  */
  useEffect(() => {
    const map = mapRef.current
    const maps = mapsRef.current
    const container = containerRef.current
    if (map === null || maps === null || container === null) return
    if (camera === null || camera === undefined) return

    const next = framedCamera({
      anchor: camera.anchor,
      spanMeters: camera.spanMeters,
      width: container.clientWidth,
      height: container.clientHeight,
      seaRatio: camera.anchorRatio ?? JEJU_MAP_SEA_RATIO,
    })

    // **단계를 먼저, 중심을 나중에.** 순서가 뒤집히면 옛 중심을 확대한 뒤 옮기게 되어
    // 한 프레임 동안 엉뚱한 곳이 보인다 (선택 핀 확대에서 같은 판단을 했다)
    map.setLevel(next.level)
    map.setCenter(new maps.LatLng(next.lat, next.lng))

    // 놓은 자리를 알린다 — 바깥이 "사용자가 옮겼는지" 를 이 자리 기준으로 잰다 (#578)
    cameraAppliedRef.current?.({ lat: next.lat, lng: next.lng })
  }, [camera, status])

  // 패널을 접거나 시트를 올리면 컨테이너 폭이 바뀐다 → 되잡지 않으면 지도가 잘린다
  const relayout = useCallback(() => mapRef.current?.relayout(), [])
  useEffect(() => {
    if (status !== 'ready') return

    window.addEventListener('resize', relayout)
    const container = containerRef.current
    const observer = container === null ? null : new ResizeObserver(relayout)
    if (container !== null) observer?.observe(container)

    return () => {
      window.removeEventListener('resize', relayout)
      observer?.disconnect()
    }
  }, [status, relayout])

  return (
    <div className={cn('bg-bg-sunken relative isolate', className)}>
      <div ref={containerRef} className="size-full" />

      {status === 'loading' && (
        <p
          role="status"
          className="text-caption text-fg-muted absolute inset-0 flex items-center justify-center font-medium"
        >
          {messages.map.loading}
        </p>
      )}
    </div>
  )
}

/**
 * 개별 핀. **이름을 쓴다** — 4~12곳 규모라 핀만 찍으면 눌러봐야 안다
 * (아트보드 `혼디가개 긴급 시설` 02).
 */
function pinElement(pin: MapPin, selected: boolean, onClick: () => void): HTMLElement {
  const button = document.createElement('button')
  button.type = 'button'

  /*
    **순번 핀은 고르기 전까지 숫자 원이다.** 고르면 이름표(`.map-pin-selected`)로 바뀐다 —
    원 안에 이름이 들어가지 않고, 이름이 필요한 순간은 사용자가 그 핀을 지목한 때뿐이다.
    보조기기는 두 상태 모두에서 이름을 읽는다 (`aria-label`).
  */
  if (pin.order !== undefined && !selected) {
    button.className = 'map-pin-order'
    button.textContent = String(pin.order)
    button.setAttribute('aria-label', `${String(pin.order)}. ${pin.title}`)
    button.setAttribute('aria-pressed', 'false')
    button.addEventListener('click', onClick)
    return button
  }

  button.className = ['map-pin', selected && 'map-pin-selected', pin.muted && 'map-pin-muted']
    .filter(Boolean)
    .join(' ')
  button.setAttribute('aria-pressed', String(selected))

  const label = document.createElement('span')
  const caption = pin.caption ?? null
  label.textContent = selected && caption !== null ? `${pin.title} · ${caption}` : pin.title
  button.appendChild(label)

  button.addEventListener('click', onClick)
  return button
}

/**
 * 묶음. **지름 32 숫자 원형 마커다** (진단 E-1 [P0] · 시안 §3 ①). 누르면 그 구역으로
 * 확대한다.
 *
 * 라벨 알약("이 지역 42곳")이었을 때는 폭이 글자 수만큼 늘어 390px 밀집 구간에서
 * 알약끼리 서로 덮었다. 폭을 고정하면 겹침 면적이 줄고, **개수가 늘어도 그 폭이
 * 변하지 않는다** — 글자는 `clusterMarkerText` 가 네 글자 안으로 접는다.
 *
 * **문구를 지우는 것이 아니라 옮긴다.** 보조기기는 여전히 "이 지역 42곳" 을 읽는다
 * (`aria-label`). 숫자만 남은 마커는 눈으로는 읽히지만 이름으로는 "42" 가 되어,
 * 무엇이 42인지 알 수 없어진다.
 */
function clusterElement(count: number, onClick: () => void): HTMLElement {
  const button = document.createElement('button')
  button.type = 'button'
  button.className = 'map-cluster'
  button.textContent = clusterMarkerText(count)
  button.setAttribute('aria-label', clusterMarkerLabel(count))
  button.addEventListener('click', onClick)
  return button
}

function toMapBounds(sw: KakaoLatLng, ne: KakaoLatLng): MapBounds {
  return {
    sw: { lat: sw.getLat(), lng: sw.getLng() },
    ne: { lat: ne.getLat(), lng: ne.getLng() },
  }
}
