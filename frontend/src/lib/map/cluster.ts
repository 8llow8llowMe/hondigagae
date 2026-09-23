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
 * 묶음 마커가 접는 상한. 여기를 넘으면 `99+` 로 쓴다.
 *
 * **이전 값은 `999`(네 글자)였고, 그 근거로 쓴 자가 틀렸다** (#671 D-1). "안쪽 30px 에
 * 들어간다" 는 **정사각 패딩 박스**를 잰 것인데 이 마커는 원이다. 글자가 실제로 쓸 수
 * 있는 폭은 지름이 아니라 **글자 높이에서 잘린 현(弦)** 이다:
 *
 * ```
 * r = 15 (패딩 박스 30 ÷ 2), align-items: center 라 글자는 세로 중앙
 * 쓸 수 있는 가로폭 = 2·√(r² − h²),  h = 글자높이 ÷ 2
 *   figure height ≈ 0.73em → 8.76px → h = 4.38 → 2√(225 − 19.2) = 28.69px
 *   cap-height    ≈ 0.70em → 8.40px → h = 4.20 → 2√(225 − 17.6) = 28.80px
 *   em 박스(12px)          → h = 6.00 → 2√(225 − 36.0) = 27.50px
 * ```
 *
 * 네 글자 실측이 **29.5px** 이라 28.69px 예산을 0.8px **넘는다** — 들어가던 것이 아니다.
 * `letter-spacing` 을 `-0.08em` 까지 조이면 28.3px 로 수치상 들어가지만 여유가 0.39px
 * 뿐이고, **그 예산 자체가 글꼴 metric 추정값**이다 (figure height 를 0.80em 으로 잡으면
 * 여유가 0.1px 로 줄어든다). 추정에 기대는 주장을 다시 세우지 않고 **세 글자로 내린다** —
 * 22.1px(`135` 실측) 에 여유 6.6px 라 metric 편차를 흡수한다.
 *
 * **대가는 정보 손실이다.** 한 셀에 500곳이 묶여도 화면 글자는 `99+` 다. 긴급 시설은
 * 제주 전체가 135곳이라 100 을 넘는 셀이 사실상 없지만 **`/places` 는 다르다** — 거기서는
 * 접히는 묶음이 흔해진다. 접히지 않은 실제 개수는 `clusterMarkerLabel` 이 말한다.
 */
const CLUSTER_MARKER_MAX = 99

/**
 * 묶음 마커 안에 쓰는 글자.
 *
 * **숫자만 쓴다.** 라벨 알약("이 지역 42곳")은 글자 수만큼 폭이 늘어서 390px 밀집
 * 구간에서 서로 겹쳐 읽히지 않았다 (진단 E-1 [P0] · 시안 §3 ①). 폭이 고정된 원은
 * 겹침 면적이 훨씬 작고, 겹치더라도 무엇이 가려졌는지 알아볼 수 있다.
 *
 * **자릿수가 늘어도 원을 늘리지 않는다.** `3` · `42` 는 그대로 쓰고 **세 자리부터 접는다**
 * (`100` → `99+`) — 원을 키우거나 좌우 여백을 주는 쪽을 고르면 알약으로 되돌아간다.
 * 상한을 세 글자로 내린 계산은 `CLUSTER_MARKER_MAX` 에 적었다 (#671 D-1).
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
 * 글자가 접혔더라도(`99+`) 이름에는 **접지 않은 실제 개수**를 넣는다 — 보조기기
 * 사용자에게까지 근사값을 줄 이유가 없다.
 *
 * 상한을 `99` 로 내리면서(#671 D-1) **접히는 구간이 훨씬 흔해졌다.** 화면 글자가 근사값이
 * 되는 자리가 늘어난 만큼, 정확한 값을 가진 채널이 여기 하나뿐이라는 점이 더 중요해졌다.
 */
export function clusterMarkerLabel(count: number): string {
  /*
    **보이는 글자를 그대로 넣는다 — `String(count)` 가 아니다** (#671 D-1).

    상한을 세 글자로 내리면서 접히는 묶음이 흔해졌다. 원에 `99+` 가 보이는데 접근성
    이름이 `이 지역 135곳` 이면 **보이는 글자가 이름에 없다** — WCAG 2.5.3(Label in Name)
    위반이고, 음성 입력 사용자가 화면에서 읽은 대로 "99 플러스" 를 부를 수 없다.
    상한이 `999` 이던 때는 한 셀에 1000곳이 묶여야 생기는 일이라 드러나지 않았다.

    `clusterMarkerText` 를 통과시키면 **구조적으로** 이름이 보이는 글자를 담는다 —
    둘이 갈릴 자리가 없어진다 (`cluster.test.ts` 가 전 구간에서 그 포함 관계를 잠근다).

    대가는 **접힌 묶음에서 정확한 개수가 이름에도 안 남는다**는 것이다. 감수한다 —
    사용자가 볼 수 없는 수를 스크린리더에만 주면 두 사람이 다른 화면을 읽게 되고,
    정확한 수는 눌러서 확대하면 마커가 갈라지며 드러난다.
  */
  return messages.map.clusterCount.replace('{n}', clusterMarkerText(count))
}

function averageCoord(coords: LatLng[]): LatLng {
  const sum = coords.reduce(
    (acc, coord) => ({ lat: acc.lat + coord.lat, lng: acc.lng + coord.lng }),
    { lat: 0, lng: 0 },
  )

  return { lat: sum.lat / coords.length, lng: sum.lng / coords.length }
}
