'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

import { JEJU_CENTER, JEJU_MAP_LEVEL, type LatLng, toLatLng } from '@/lib/geo/coord'
import { cellSizeFor, clusterByGrid } from '@/lib/map/cluster'
import { loadKakaoMaps, MapSdkError, type MapSdkFailure } from '@/lib/map/sdk'
import type { MapBounds } from '@/lib/map/viewport'
import { messages } from '@/lib/messages'
import { cn } from '@/lib/utils/cn'
import type { KakaoCustomOverlay, KakaoLatLng, KakaoMap, KakaoMaps } from '@/types/kakao-maps'

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

export type MapPin = {
  id: string
  title: string
  lat: number | null
  lng: number | null
  /** 선택됐을 때 라벨에 함께 붙는 보조 문구 (예: `480m`). 없으면 `null` */
  caption?: string | null
  /** 낮춤 표현. 긴급 시설의 약국이 쓴다 — 판정 색이 아니라 톤 낮춤이다 */
  muted?: boolean
}

export function MapCanvas({
  pins,
  selectedId,
  onSelect,
  onBoundsChange,
  center,
  onFailure,
  className,
}: {
  pins: MapPin[]
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
  /** 지도 중심을 밖에서 옮길 때 (현재 위치 버튼). 같은 값을 다시 주면 움직이지 않는다 */
  center?: LatLng | null
  /** SDK 를 못 쓰면 호출부가 목록으로 되돌린다 */
  onFailure?: (reason: MapSdkFailure) => void
  className?: string
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<KakaoMap | null>(null)
  const mapsRef = useRef<KakaoMaps | null>(null)
  const overlaysRef = useRef<KakaoCustomOverlay[]>([])

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
  useEffect(() => {
    selectRef.current = onSelect
    boundsRef.current = onBoundsChange
    failureRef.current = onFailure
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
        const map = new maps.Map(container, {
          center: new maps.LatLng(JEJU_CENTER.lat, JEJU_CENTER.lng),
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

    const groups = clusterByGrid(positioned, cellSizeFor(level))
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
        yAnchor: 1,
        zIndex: !isCluster && first.id === selectedId ? 10 : 1,
        clickable: true,
      })
      overlay.setMap(map)
      created.push(overlay)
    }

    overlaysRef.current = created
  }, [pins, selectedId, status, level])

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

    map.panTo(new maps.LatLng(coord.lat, coord.lng))
  }, [selectedId])

  // ── 밖에서 중심을 옮길 때 (현재 위치 버튼) ───────────────────────────────
  useEffect(() => {
    const map = mapRef.current
    const maps = mapsRef.current
    if (map === null || maps === null || center === null || center === undefined) return

    map.setCenter(new maps.LatLng(center.lat, center.lng))
  }, [center])

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

/** 묶음. 누르면 그 구역으로 확대한다 */
function clusterElement(count: number, onClick: () => void): HTMLElement {
  const button = document.createElement('button')
  button.type = 'button'
  button.className = 'map-cluster'
  button.textContent = messages.map.clusterCount.replace('{n}', String(count))
  button.addEventListener('click', onClick)
  return button
}

function toMapBounds(sw: KakaoLatLng, ne: KakaoLatLng): MapBounds {
  return {
    sw: { lat: sw.getLat(), lng: sw.getLng() },
    ne: { lat: ne.getLat(), lng: ne.getLng() },
  }
}
