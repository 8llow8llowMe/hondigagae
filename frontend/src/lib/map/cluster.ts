import type { LatLng } from '@/lib/geo/coord'
import { messages } from '@/lib/messages'

/**
 * 격자 묶음(클러스터).
 *
 * SDK 의 `MarkerClusterer` 를 쓰지 않는 이유가 둘이다.
 *  1. 그것은 기본 `Marker` 만 묶는다. 우리 핀은 **이름 라벨이 있는 `CustomOverlay`** 다
 *     (아트보드: "마커에 이름을 쓴다" · "선택된 핀이 초록 라벨로 커진다").
 *  2. 묶음 마커의 모양과 이름이 정해져 있다 — **보이는 것은 숫자 하나, 보조기기가 읽는
 *     이름은 "이 지역 12곳"** (진단 E-1 · 시안 §3 ①). 라이브러리 기본 렌더를 쓰면
 *     그 둘을 갈라 놓을 수 없다.
 *
 * 그래서 직접 계산한다. **순수 함수라 테스트로 고정된다** — 지도 코드에서 눈으로
 * 확인하기 가장 어려운 부분이다.
 */

export type ClusterInput<T> = {
  item: T
  coord: LatLng
}

export type ClusterGroup<T> = {
  /** 격자 셀 식별자. React key 로 쓴다 — 같은 셀은 화면이 흔들려도 같은 키다 */
  key: string
  center: LatLng
  items: T[]
}

/**
 * 확대 단계별 격자 크기(위도 기준 도).
 *
 * 카카오 `level` 은 **작을수록 확대**다 (1 이 가장 가깝다). 아트보드는 확대하면 묶음이
 * 풀려 개별 핀이 되기를 기대하므로, 레벨이 커질수록 셀이 커진다.
 */
export function cellSizeFor(level: number): number {
  if (level <= 4) return 0
  if (level <= 6) return 0.004
  if (level <= 8) return 0.012
  if (level <= 10) return 0.04
  return 0.12
}

/**
 * 좌표를 격자로 묶는다.
 *
 * `cellSize` 가 `0` 이면 묶지 않는다 — 충분히 확대한 상태에서는 개별 핀이 정답이다.
 * 셀에 하나뿐이면 그 자체가 개별 핀이므로 호출부가 `items.length` 로 갈라 그린다.
 *
 * **입력 순서를 보존한다.** 서버가 거리순으로 준 것을 뒤섞으면 목록과 지도의 순서가
 * 갈린다.
 */
export function clusterByGrid<T>(inputs: ClusterInput<T>[], cellSize: number): ClusterGroup<T>[] {
  if (cellSize <= 0) {
    return inputs.map((input, index) => ({
      key: `single-${String(index)}`,
      center: input.coord,
      items: [input.item],
    }))
  }

  const buckets = new Map<string, { coords: LatLng[]; items: T[] }>()

  for (const input of inputs) {
    const row = Math.floor(input.coord.lat / cellSize)
    const col = Math.floor(input.coord.lng / cellSize)
    const key = `${String(row)}:${String(col)}`

    const bucket = buckets.get(key)
    if (bucket === undefined) buckets.set(key, { coords: [input.coord], items: [input.item] })
    else {
      bucket.coords.push(input.coord)
      bucket.items.push(input.item)
    }
  }

  return [...buckets.entries()].map(([key, bucket]) => ({
    key,
    // 셀 중앙이 아니라 **실제 좌표의 평균**이다. 셀 중앙에 찍으면 바다 한가운데에
    // 묶음이 뜨는 일이 생긴다
    center: averageCoord(bucket.coords),
    items: bucket.items,
  }))
}

/**
 * 묶음 마커가 접는 상한. 여기를 넘으면 `999+` 로 쓴다.
 *
 * **지름 32 안에 12px(디자인 최소 글자) 로 들어가는 한계가 네 글자다.** 다섯 글자를
 * 허용하면 원이 가로로 늘어 알약으로 되돌아간다 — 그 알약이 진단 E-1 의 원인이었다.
 */
const CLUSTER_MARKER_MAX = 999

/**
 * 묶음 마커 안에 쓰는 글자.
 *
 * **숫자만 쓴다.** 라벨 알약("이 지역 42곳")은 글자 수만큼 폭이 늘어서 390px 밀집
 * 구간에서 서로 겹쳐 읽히지 않았다 (진단 E-1 [P0] · 시안 §3 ①). 폭이 고정된 원은
 * 겹침 면적이 훨씬 작고, 겹치더라도 무엇이 가려졌는지 알아볼 수 있다.
 *
 * **자릿수가 늘어도 원을 늘리지 않는다.** `3` · `42` · `135` 는 그대로 쓰고 네 자리부터
 * 접는다 — 원을 키우거나 좌우 여백을 주는 쪽을 고르면 알약으로 되돌아간다.
 *
 * 망가진 입력(`NaN` · 음수 · 소수)에도 글자를 만든다. 빈 원이 뜨면 그것이야말로 소음이다.
 */
export function clusterMarkerText(count: number): string {
  const safe = Number.isFinite(count) ? Math.max(0, Math.trunc(count)) : 0
  return safe > CLUSTER_MARKER_MAX ? `${String(CLUSTER_MARKER_MAX)}+` : String(safe)
}

/**
 * 묶음 마커의 접근성 이름.
 *
 * 원 안에는 숫자만 남으므로 **"무엇이 몇 곳인지" 는 여기서 말한다.** 화면에 보이는
 * 글자가 접혔더라도(`999+`) 이름에는 **접지 않은 실제 개수**를 넣는다 — 보조기기
 * 사용자에게까지 근사값을 줄 이유가 없다.
 */
export function clusterMarkerLabel(count: number): string {
  return messages.map.clusterCount.replace('{n}', String(count))
}

function averageCoord(coords: LatLng[]): LatLng {
  const sum = coords.reduce(
    (acc, coord) => ({ lat: acc.lat + coord.lat, lng: acc.lng + coord.lng }),
    { lat: 0, lng: 0 },
  )

  return { lat: sum.lat / coords.length, lng: sum.lng / coords.length }
}
