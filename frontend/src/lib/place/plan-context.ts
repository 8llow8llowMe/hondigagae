import { parseDay } from '@/lib/date/day'
import { addPlanDays, totalDaysBetween } from '@/lib/plan/date'
import type { DailyCongestionItem } from '@/types/insight'
import type { Pet } from '@/types/pet'
import type { PlanDetail } from '@/types/plan'

/**
 * 장소 상세 — **일정에서 들어왔을 때의 기준** (#1429 · `장소상세-세부명세.md` D1-5).
 *
 * 일정 항목을 누르고 들어온 사람이 묻는 것은 "지금 이 장소" 가 아니라 **"그 일정의 그 날,
 * 그 아이와 가면"** 이다. 예전에는 헤더에서 고른 반려견 · 오늘 기준으로만 판정해, 보리 일정에서
 * 들어와도 "몽 기준" 이 나오고 덜 붐비는 날이 이미 정한 여행일을 무시했다.
 *
 * **맥락은 URL(`?plan=&day=`)에 싣는다** (architecture-guide.md §10). 메모리 상태로 넘기면
 * 새로고침 · 뒤로가기에서 사라지고, 어느 일정의 몇째 날인지는 그 주소가 가리키는 화면의 일부다.
 *
 * **이 파일은 순수 함수만 둔다** — 쿼리 파싱 · 링크 조립 · 기준 반려견/날짜 고르기.
 * 조회는 `features/place/use-place-plan-basis.ts` 가 한다.
 */

export const PLAN_CONTEXT_PARAM = { plan: 'plan', day: 'day' } as const

export type PlanContextQuery = {
  /** Snowflake — 문자열 그대로 다룬다. `Number()` 로 바꾸면 정밀도를 잃는다 */
  planId: string
  /** 1부터 */
  day: number
}

/** 백엔드가 `@PathVariable long` 으로 받는다 — 숫자가 아니면 400 이 정해진 요청이다 */
const PLAN_ID_PATTERN = /^\d+$/
/** 앞자리 0 · 부호 · 소수점을 받지 않는다. 일정 일수 상한(서버)보다 넉넉한 세 자리까지 */
const DAY_PATTERN = /^[1-9]\d{0,2}$/

/**
 * `?plan=&day=` 를 읽는다. **하나라도 없거나 모양이 틀리면 `null`** — 호출부는 그때
 * 지금 동작(헤더의 반려견 · 오늘)으로 돌아간다.
 */
export function parsePlanContext(params: {
  get(name: string): string | null
}): PlanContextQuery | null {
  const planId = params.get(PLAN_CONTEXT_PARAM.plan)
  const day = params.get(PLAN_CONTEXT_PARAM.day)
  if (planId === null || day === null) return null
  if (!PLAN_ID_PATTERN.test(planId) || !DAY_PATTERN.test(day)) return null

  return { planId, day: Number(day) }
}

/** 장소 상세 주소. 맥락이 있으면 `?plan=&day=` 를 싣는다 — `parsePlanContext` 와 짝이다 */
export function placeHrefFromPlan(placeId: string, context: PlanContextQuery | null): string {
  if (context === null) return `/places/${placeId}`

  const query = new URLSearchParams({
    [PLAN_CONTEXT_PARAM.plan]: context.planId,
    [PLAN_CONTEXT_PARAM.day]: String(context.day),
  })
  return `/places/${placeId}?${query.toString()}`
}

export type PlanBasis = {
  /** 판정 기준 반려견 — 이 일정의 동행 중 하나다 */
  pet: Pet
  /** 들어온 일차의 날짜 (`yyyy-MM-dd`) */
  date: string
  /** 여행 날짜 전체 (양끝 포함, 날짜 순) */
  tripDates: string[]
}

/**
 * 일정 · 일차 · 그날의 기준견으로 **판정 기준**을 고른다. 못 고르면 `null`(= 지금 동작).
 *
 * **반려견은 그날 일정 판정의 기준견(`basisPetId`)이 먼저다.** 서버가 "아이별 판정 중 점수가
 * 가장 낮은 아이" 로 고른 값이고(`PlanWeatherProcessor.pickBasisPet` — 한 마리라도 힘든 날이면
 * 그날은 힘든 날이다), 일정 상세의 항목 산책 판정도 같은 아이를 쓴다
 * (`PlanItemWalkSafetyItem.basisPetId`). 장소 상세가 다른 아이를 고르면 같은 항목을 두 화면이
 * 다른 아이로 판정한다. 없으면 **대표 반려견(`petIds[0]`)** 이고, 내 반려견 목록에 없는
 * 아이(삭제 등)는 건너뛴다.
 *
 * **날짜는 FE 가 센다** — 시작일 + (일차 - 1). 오늘을 만들지 않으므로 타임존 문제가 없다
 * (`addPlanDays` 가 UTC 달력 칸으로 센다). 일차가 기간을 넘으면 없는 날이라 `null` 이다.
 */
export function resolvePlanBasis({
  plan,
  day,
  basisPetId,
  pets,
}: {
  plan: PlanDetail
  day: number
  /** 그날 일정 판정의 기준견. 판정을 못 냈거나 아직 없으면 `null` */
  basisPetId: string | null
  pets: Pet[]
}): PlanBasis | null {
  const total = totalDaysBetween(plan.startDate, plan.endDate)
  if (total === null || day < 1 || day > total) return null

  const tripDates: string[] = []
  for (let offset = 0; offset < total; offset += 1) {
    const date = addPlanDays(plan.startDate, offset)
    if (date === null) return null
    tripDates.push(date)
  }

  const date = tripDates[day - 1]
  if (date === undefined) return null

  const candidates =
    basisPetId !== null && plan.petIds.includes(basisPetId)
      ? [basisPetId, ...plan.petIds]
      : plan.petIds
  const petById = new Map(pets.map((entry) => [entry.petId, entry]))
  const chosen = candidates.map((petId) => petById.get(petId)).find((entry) => entry !== undefined)
  if (chosen === undefined) return null

  return { pet: chosen, date, tripDates }
}

/**
 * `2026-11-06` · `2026-11-06T14:00:00` → `11/6`. 못 읽으면 `null`.
 *
 * **문자열을 그대로 자른다** — `Date` 로 파싱하면 브라우저 타임존이 KST 가 아닌 사용자에게
 * 다른 날이 나온다.
 */
export function shortDateLabel(value: string): string | null {
  const date = value.slice(0, 10)
  if (parseDay(date) === null) return null

  return `${Number(date.slice(5, 7))}/${Number(date.slice(8, 10))}`
}

/**
 * 이미 받은 날짜별 혼잡도에서 **여행일만** 고른다 — 여행일 순서다.
 *
 * **새로 조회하지 않는다.** 받은 기간 밖의 여행일은 빠질 뿐이고, 겹치는 날이 없으면 빈 배열이다 —
 * 호출부는 그때 자리를 만들지 않는다(모르는 날을 "한산" 으로 말하지 않는다).
 */
export function pickTripCongestions(
  items: DailyCongestionItem[],
  tripDates: string[],
): DailyCongestionItem[] {
  const byDate = new Map(items.map((item) => [item.date, item]))
  return tripDates
    .map((date) => byDate.get(date))
    .filter((item): item is DailyCongestionItem => item !== undefined)
}

/** 일정 기준을 정하는 중인가 · 정했는가 · 지금 동작으로 돌아가는가 */
export type PlanBasisState =
  { status: 'none' } | { status: 'pending' } | { status: 'ready'; basis: PlanBasis }

/**
 * 장소 상세 **한 화면이 쓰는 기준 반려견** (#1459 · 장소상세-세부명세 D1-5-4).
 *
 * 적합도 · 산책 위험도 · 동반 조건 절이 모두 이 값 하나를 쓴다. 한 화면에 "보리에게" 판정과
 * "몽은 소형견이라…" 대조가 함께 보이면 어느 아이 기준의 답인지 알 수 없다.
 *
 * - `ready` → 그 일정의 기준 반려견 (헤더에서 고른 아이보다 먼저다)
 * - `none` → 헤더에서 고른 아이 (지금 동작)
 * - `pending` → `null`. 헤더 아이로 먼저 그렸다가 일정 아이로 바꾸면 문장이 한 번 뒤바뀐다 —
 *   판정 패널이 스켈레톤으로 기다리는 것과 같은 이유다
 */
export function basisPetOf(state: PlanBasisState, selected: Pet | null): Pet | null {
  if (state.status === 'ready') return state.basis.pet
  if (state.status === 'pending') return null
  return selected
}

type Source<T> = { data: T | undefined; pending: boolean; failed: boolean }

/**
 * 세 조회(일정 상세 · 일정 판정 · 내 반려견 목록)를 **기준 상태 하나**로 접는다.
 *
 * - 맥락이 없으면(쿼리 없음 · 모양 틀림 · 미로그인) `none` — 지금 동작이다
 * - **일정이나 반려견 목록을 못 읽으면 `none`** 이다. 남의 일정(404) · 지운 일정이 이
 *   갈래다 — 판정 카드를 오류로 덮지 않고 지금 동작으로 물러선다
 * - **일정 판정(기준견)은 실패해도 된다** — 대표 반려견으로 고른다. 기다리기는 한다:
 *   먼저 대표로 부르고 나중에 기준견으로 바꾸면 요청이 두 번 나가고 판정이 한 번 뒤바뀐다
 */
export function planBasisState({
  context,
  plan,
  weatherBasisPetId,
  pets,
}: {
  context: PlanContextQuery | null
  plan: Source<PlanDetail>
  /** 그날 일정 판정의 기준견. `undefined` 면 아직 조회 중이다 */
  weatherBasisPetId: string | null | undefined
  pets: Source<Pet[]>
}): PlanBasisState {
  if (context === null) return { status: 'none' }
  if (plan.failed || pets.failed) return { status: 'none' }
  if (plan.pending || pets.pending || weatherBasisPetId === undefined) return { status: 'pending' }
  if (plan.data === undefined || pets.data === undefined) return { status: 'none' }

  const basis = resolvePlanBasis({
    plan: plan.data,
    day: context.day,
    basisPetId: weatherBasisPetId,
    pets: pets.data,
  })
  return basis === null ? { status: 'none' } : { status: 'ready', basis }
}
