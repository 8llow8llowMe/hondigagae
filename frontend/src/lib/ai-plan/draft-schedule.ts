import type { LatLng } from '@/lib/geo/coord'
import { haversineMeters } from '@/lib/geo/distance'
import { toServerStartTime } from '@/lib/plan/clock-time'
import type { AiPlanScheduleItem } from '@/types/ai-plan'

/**
 * AI 초안을 담을 때 채우는 그날 항목 시각 — 이슈 #1424 (#1383 · 일정상세-세부명세 D24-1 을 고쳤다).
 *
 * **예전에는 순서 슬롯(10:00 · 12:30 · 15:00 …)이었다.** 2026-10-13 사용성 테스트에서 3일 모두
 * `10:00 / 12:30 / 15:00` 이 들어가 이동 거리(12km · 20km)와 상관없는 템플릿으로 읽혔고, 숙소 체크인
 * 시각과 겹쳤다. 이제 **앞 항목 시각 + 머무는 시간 + 직선거리 기반 이동 시간** 으로 이어 붙인다.
 *
 * **추천값이다.** 저장 뒤에는 출처가 남지 않으므로(D24-2) 담는 순간에 한 번 알린다 — 그 규칙은
 * 그대로다. 아래 상수는 "그럴듯한 하루" 를 만드는 값이지 정답이 아니다. 사용자는 시간 칩으로 고친다.
 *
 * **미리보기도 같은 함수를 쓴다** (#1432). 미리보기와 담기가 다른 시각을 말하면 신뢰가 깨진다 —
 * 호출부는 **담기가 실제로 싣는 항목만**(`toDraftItems` 가 걸러낸 뒤) 넘겨야 같은 값이 나온다.
 */

/** 그날 첫 항목 — 예전 첫 슬롯 · 시각 모달 기본값(`CLOCK_DEFAULT`)과 같다 */
const DAY_START_MINUTES = 10 * 60
/**
 * 이 시각을 넘으면 비운다 — **밤늦은 시각을 지어내지 않는다** (D24-1 의 마지막 슬롯 · 끼우기 상한과
 * 같다). 한 번 비면 그 뒤도 비운다 — 기준 없이 이어 붙일 수 없다.
 */
const LATEST_MINUTES = 20 * 60
/**
 * 숙박의 하한 — 국내 숙소 체크인은 대개 15:00 이다. 사용성 테스트의 겹침도 숙소 15:00 이었다.
 * 그날 마지막 일정이 늦으면 그 뒤로 밀린다.
 */
const CHECK_IN_MINUTES = 15 * 60

/**
 * 머무는 시간(분). **반려견 동반 기준으로 넉넉히 잡았다** — 산책 · 물 · 배변 쉬는 시간이 끼어
 * 사람만 갈 때보다 길다.
 *
 * - 장소 90 — 관광지 체류 1~2시간의 가운데
 * - 식사 · 산책 60 — 한 끼 · 산책 코스 한 바퀴
 * - 숙박 30 — **중간에 낀 숙박**(짐 맡기기 · 체크아웃)만 이 값을 쓴다. 끝의 숙박은 그날의 끝이다
 * - 이동 30 — 이동 항목은 그 자체가 이동이라 이 값이 이동 시간을 대신한다
 *
 * 모르는 유형(LLM raw string)은 장소로 본다.
 */
const STAY_MINUTES: Record<string, number> = {
  PLACE: 90,
  MEAL: 60,
  WALK: 60,
  LODGING: 30,
  MOVE: 30,
}
const DEFAULT_STAY_MINUTES = 90

/**
 * 직선 → 도로 거리 보정. 제주는 산간 · 해안도로가 많아 직선거리가 주행거리보다 짧다
 * (일정 상세가 "직선" 을 붙이는 이유와 같다, D3). 1.3 은 국내 도로 우회율의 흔한 근사다.
 */
const DETOUR_RATIO = 1.3
/** 평균 차량 속도(km/h). 제주 일반도로 제한 50~70 에 시내 신호 · 주차를 감안한 값이다 */
const DRIVE_KMH = 40
/** 아무리 가까워도 이 만큼은 잡는다 — 주차 · 걸어서 입장 */
const MIN_TRAVEL_MINUTES = 10
/** 좌표를 모를 때 — 제주 안 관광지 사이 평균 이동에 가깝게 */
const UNKNOWN_TRAVEL_MINUTES = 30
/** 시각은 10분 단위로 올린다 — `10:47` 같은 값은 계산한 티가 나서 오히려 믿기 어렵다 */
const ROUND_MINUTES = 10

function roundUp(minutes: number): number {
  return Math.ceil(minutes / ROUND_MINUTES) * ROUND_MINUTES
}

/** 직선거리(m) → 이동 시간(분). 좌표를 모르면(`null`) 30분이다 */
export function travelMinutes(meters: number | null): number {
  if (meters === null) return UNKNOWN_TRAVEL_MINUTES

  const minutes = ((meters / 1000) * DETOUR_RATIO * 60) / DRIVE_KMH
  return Math.max(MIN_TRAVEL_MINUTES, roundUp(minutes))
}

type ScheduleEntry = Pick<AiPlanScheduleItem, 'itemType' | 'placeId'>

function stayMinutes(entry: ScheduleEntry): number {
  return STAY_MINUTES[entry.itemType] ?? DEFAULT_STAY_MINUTES
}

function coordOf(entry: ScheduleEntry, coords: ReadonlyMap<string, LatLng>): LatLng | null {
  return entry.placeId === null ? null : (coords.get(entry.placeId) ?? null)
}

function legMinutes(
  from: ScheduleEntry,
  to: ScheduleEntry,
  coords: ReadonlyMap<string, LatLng>,
): number {
  // 이동 항목이 끼면 그 항목의 머무는 시간이 곧 이동이다 — 겹쳐 더하지 않는다
  if (from.itemType === 'MOVE' || to.itemType === 'MOVE') return 0

  return travelMinutes(haversineMeters(coordOf(from, coords), coordOf(to, coords)))
}

/** 끝에 연달아 붙은 숙박 묶음의 시작 — `itemInsertIndex`(#1175)와 같은 판단이다 */
function trailingLodgingStart(entries: readonly ScheduleEntry[]): number {
  let index = entries.length
  while (index > 0 && entries[index - 1]?.itemType === 'LODGING') index -= 1
  return index
}

/**
 * 한 날의 항목 시각 (서버 형식 `HH:mm:ss`). 입력과 **같은 길이 · 같은 순서**로 돌려주고,
 * 못 채우는 자리는 `undefined`(요청 본문에서 키를 뺀다)다.
 *
 * 1. 첫 항목은 10:00
 * 2. 다음 항목은 앞 시각 + 앞 항목의 머무는 시간 + 이동 시간 (10분 단위 올림)
 * 3. **끝에 붙은 숙박은 체크인 15:00 보다 이르지 않다** — 그날 마지막 일정 뒤다
 * 4. 20:00 을 넘으면 그 항목부터 비운다
 *
 * 앞 시각에 늘 양수를 더하므로 **역행 · 겹침이 생기지 않는다** (`timeOrderIssues` 가 잡는 것).
 */
export function draftDayStartTimes(
  entries: readonly ScheduleEntry[],
  coords: ReadonlyMap<string, LatLng> = new Map(),
): (string | undefined)[] {
  const lodgingFrom = trailingLodgingStart(entries)
  const times: (string | undefined)[] = []
  let previousMinutes: number | null = null

  entries.forEach((entry, index) => {
    const previous = index === 0 ? undefined : entries[index - 1]
    let minutes: number | null

    if (previous === undefined) {
      minutes = entry.itemType === 'LODGING' ? CHECK_IN_MINUTES : DAY_START_MINUTES
    } else if (previousMinutes === null) {
      minutes = null
    } else {
      minutes = roundUp(
        previousMinutes + stayMinutes(previous) + legMinutes(previous, entry, coords),
      )
      if (index >= lodgingFrom) minutes = Math.max(CHECK_IN_MINUTES, minutes)
    }

    if (minutes !== null && minutes > LATEST_MINUTES) minutes = null

    previousMinutes = minutes
    times.push(
      minutes === null
        ? undefined
        : toServerStartTime({ hour: Math.floor(minutes / 60), minute: minutes % 60 }),
    )
  })

  return times
}
