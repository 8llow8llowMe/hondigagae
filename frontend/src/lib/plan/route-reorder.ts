import type { LatLng } from '@/lib/geo/coord'
import { haversineMeters } from '@/lib/geo/distance'
import { planItemDistanceCoord } from '@/lib/plan/detail'
import { formatStartTime } from '@/lib/plan/start-time'
import type { PlanItemDetail } from '@/types/plan'

/**
 * 되돌아가는 동선이면 더 짧은 순서를 제안한다 — 이슈 #1462 · 일정상세-세부명세 D31.
 *
 * **판정만 한다.** 받을지는 사용자가 정한다 — 제안을 누르면 순서 편집이 이 순서로 열리고, 저장은
 * 편집기의 일괄 교체 그대로다(메모 · 시각 · `itemType` 을 되싣는다, `planDayItemsPayload`).
 *
 * **거리는 직선이다** — 행의 `직선 N km 이동` 과 같은 좌표(`planItemDistanceCoord`)와 같은
 * 하버사인으로 잰다. 산간 · 해안도로를 다 반영하지 못하므로 문턱(아래 둘)을 넉넉히 잡는다.
 */

/**
 * 줄어드는 거리가 이보다 작으면 제안하지 않는다(m). 3km 는 이동 시간 어림(`travelMinutes` —
 * 직선 × 1.3 ÷ 40km/h)으로 약 6분이다. 그보다 작은 차이로 사용자가 짠 순서를 흔들면 제안이
 * 배경음이 된다 — 직선거리 오차만으로도 뒤집힐 수 있는 크기다.
 */
export const ROUTE_REORDER_MIN_SAVED_METERS = 3_000

/**
 * 그날 직선 이동 합의 이 비율보다 덜 줄면 제안하지 않는다. 하루 60km 를 도는 날의 3km 는
 * 되돌아감이 아니라 어림의 오차다.
 */
export const ROUTE_REORDER_MIN_SAVED_RATIO = 0.15

/**
 * 움직일 항목이 이보다 많이 이어진 구간은 다시 놓지 않는다. 구간마다 모든 순서를 견주므로
 * 7개면 5,040가지 — 렌더마다 돌아도 무시할 만하다. 8개면 40,320가지로 일자마다 매 렌더에
 * 돌리기에 크다. 하루에 시각 없는 장소가 8개 넘게 이어지는 일은 드물어 휴리스틱을 들이지 않았다.
 */
export const ROUTE_REORDER_MAX_SEGMENT = 7

export type RouteReorderSuggestion = {
  /** 제안하는 순서 — 그날 항목 전부. 고정 항목은 제자리다 */
  order: PlanItemDetail[]
  /** 줄어드는 직선거리(m) */
  savedMeters: number
}

/**
 * 움직이지 않는 항목인가.
 *
 * - **숙박(`LODGING`)** — 앞이면 체크아웃, 끝이면 그날 밤 묵을 곳이다. 동선의 양 끝을 정한다
 * - **시각이 박힌 항목** — 시각은 사용자가 적었거나 담기가 채운 약속이다. 이들이 제자리에
 *   있으면 시각들의 순서가 바뀌지 않아 **다시 정렬이 시각 역행(D25)을 새로 만들지 않는다**
 * - **좌표를 모르는 항목**(`MOVE` · 산책 코스 · 장소 요약 결손) — 잴 수 없으니 옮길 근거도 없다.
 *   이동 · 휴식은 앞뒤 사이에 끼는 항목이라 옮기면 뜻이 바뀐다
 */
function isFixed(item: PlanItemDetail): boolean {
  if (item.itemType.code === 'LODGING') return true
  if (formatStartTime(item.startTime) !== null) return true
  return planItemDistanceCoord(item) === null
}

function legMeters(from: LatLng | null, to: LatLng | null): number {
  return haversineMeters(from, to) ?? 0
}

/** 출발점 → 점들 → 도착점의 직선 합. 모르는 끝은 열어 둔다 */
function pathMeters(start: LatLng | null, points: (LatLng | null)[], end: LatLng | null): number {
  let total = 0
  let previous = start
  for (const point of points) {
    total += legMeters(previous, point)
    previous = point
  }
  return total + legMeters(previous, end)
}

/** 0..n-1 의 모든 순열을 사전순으로. 첫 번째가 지금 순서다 */
function permutations(size: number): number[][] {
  if (size <= 1) return [Array.from({ length: size }, (_, index) => index)]

  const result: number[][] = []
  const walk = (prefix: number[], rest: number[]) => {
    if (rest.length === 0) {
      result.push(prefix)
      return
    }
    rest.forEach((value, index) =>
      walk([...prefix, value], [...rest.slice(0, index), ...rest.slice(index + 1)]),
    )
  }
  walk(
    [],
    Array.from({ length: size }, (_, index) => index),
  )
  return result
}

/**
 * 그날 순서보다 충분히 짧은 순서가 있으면 그 순서를, 없으면 `null`.
 *
 * **고정 항목 사이 구간마다 따로 푼다.** 구간의 앞 경계는 앞의 고정 항목(첫 구간이면 앞날
 * 숙소 `startBasis`), 뒤 경계는 뒤의 고정 항목이고, 경계 좌표를 모르면 그 끝은 열어 둔다.
 * 구간 안에서는 모든 순서를 견준다 — 항목이 적어 근사 해법이 필요 없다. 거리가 같으면
 * 지금 순서에 가까운 쪽(사전순으로 먼저)을 고른다.
 *
 * @param startBasis 그날 출발점 — 앞날의 숙소(`lodgingBasisFor`). 행의 `숙소에서 직선 N km` 와 같다
 */
export function routeReorderSuggestion(
  items: readonly PlanItemDetail[],
  startBasis: PlanItemDetail | null,
): RouteReorderSuggestion | null {
  const coords = items.map(planItemDistanceCoord)
  const startCoord = startBasis === null ? null : planItemDistanceCoord(startBasis)
  const order = [...items]

  let index = 0
  while (index < items.length) {
    if (isFixed(items[index] as PlanItemDetail)) {
      index += 1
      continue
    }

    let end = index
    while (end < items.length && !isFixed(items[end] as PlanItemDetail)) end += 1

    const size = end - index
    if (size >= 2 && size <= ROUTE_REORDER_MAX_SEGMENT) {
      const before = index === 0 ? startCoord : (coords[index - 1] ?? null)
      const after = end < items.length ? (coords[end] ?? null) : null
      const segment = coords.slice(index, end)

      let best: number[] | null = null
      let bestMeters = pathMeters(before, segment, after)
      for (const candidate of permutations(size)) {
        const meters = pathMeters(
          before,
          candidate.map((position) => segment[position] ?? null),
          after,
        )
        // 1m 미만 차이는 같은 거리로 본다 — 부동소수 잡음으로 순서를 흔들지 않는다
        if (meters < bestMeters - 1) {
          best = candidate
          bestMeters = meters
        }
      }

      if (best !== null) {
        best.forEach((position, offset) => {
          order[index + offset] = items[index + position] as PlanItemDetail
        })
      }
    }

    index = end
  }

  const currentMeters = pathMeters(startCoord, coords, null)
  const nextMeters = pathMeters(startCoord, order.map(planItemDistanceCoord), null)
  const savedMeters = currentMeters - nextMeters

  if (savedMeters < ROUTE_REORDER_MIN_SAVED_METERS) return null
  if (savedMeters < currentMeters * ROUTE_REORDER_MIN_SAVED_RATIO) return null

  return { order, savedMeters }
}

/**
 * 이 날에 제안을 낼 수 있는가 (D31-3).
 *
 * - **완료 일정은 내지 않는다** — 다녀온 여행의 순서를 고칠 이유가 없다
 * - **지난 날은 내지 않는다** — 이미 그 순서로 다녀왔다. 오늘은 낸다(남은 곳을 다시 놓을 수 있다)
 * - **다녀옴이 하나라도 체크된 날은 내지 않는다** — 일괄 교체가 그날 체크를 전부 지운다(D9-2).
 *   제안이 잃을 것을 만들지 않게 한다
 * - 초안 · 확정은 같다 — 확정도 순서 편집을 막지 않는다
 *
 * @param date 그 일자의 `YYYY-MM-DD`. 모르면 내지 않는다
 * @param today 서버가 정한 오늘 `YYYY-MM-DD` (`todayDay`)
 */
export function routeReorderAllowed({
  statusCode,
  date,
  today,
  items,
}: {
  statusCode: string
  date: string | null
  today: string
  items: readonly PlanItemDetail[]
}): boolean {
  if (statusCode === 'COMPLETED') return false
  if (date === null || date < today) return false
  return !items.some((item) => item.visited)
}
