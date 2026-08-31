import type { MockResult } from '@/lib/api/mock/auth-data'
import { MOCK_PLACES } from '@/lib/api/mock/place-data'
import {
  memberIdOf,
  type MockPlan,
  type MockPlanItem,
  mockStore,
  nextPlanId,
  nextPlanItemId,
} from '@/lib/api/mock/store'
import type { ApiResponse, CodeNameMetadata, SliceResponse } from '@/types/api'
import type { ScoreMetricMetadata } from '@/types/insight'
import type {
  PlanDayWeatherItem,
  PlanDetail,
  PlanItemDetail,
  PlanSummaryItem,
  PlanWeatherResponse,
} from '@/types/plan'

/**
 * 여행 일정 mock.
 *
 * **백엔드보다 느슨하거나 엄격해서는 안 된다.** mock 이 스키마보다 엄격하면 FE 는
 * 통과하는 입력이 mock 에서만 400 이 되어, 같은 브랜치가 자기 판정을 부정한다
 * (`pet-data.ts` 와 같은 규칙).
 *
 * 근거: `PlanWebController` · `PlanCreateRequest` · `PlanSummaryItem` ·
 * `PlanDetailResponse` · `PlanStatus` · `PlanErrorCode` · `PlanValidationMessage` ·
 * `PlanRepository` 소스 실측. 계약 상세는 docs/features/plan/공통명세.md.
 */

function ok<T>(dataBody: T): ApiResponse<T> {
  return { dataHeader: { success: true, resultCode: null, resultMessage: null }, dataBody }
}

function fail(status: number, resultCode: string, resultMessage: unknown): MockResult {
  return {
    status,
    payload: { dataHeader: { success: false, resultCode, resultMessage }, dataBody: null },
  }
}

/** Bean Validation 실패는 `{ message, errors: [...] }` 형태로 온다 — ValidationErrorSupport */
function failValidation(errors: { code: string; field: string; message: string }[]): MockResult {
  return fail(400, 'PLAN_100', {
    message: errors[0]?.message ?? '요청 값이 올바르지 않습니다.',
    errors,
  })
}

// 토큰이 없거나 유효하지 않은 요청은 도메인에 닿기 전에 security-core 가 막는다 —
// `SecurityErrorCode.UNAUTHORIZED`. **`AUTH_011` 이 아니다**: 그것은
// `OAUTH_PROFILE_REQUIRED` 이고 400 이라, 401 과 짝지으면 서버가 내지 않는 조합이 된다 (#83)
const UNAUTHORIZED = () => fail(401, 'SECURITY_001', '인증이 필요합니다.')

/** 백엔드 `PlanStatus` 의 displayName/description 복제본 */
const STATUS: Record<string, CodeNameMetadata> = {
  DRAFT: { code: 'DRAFT', name: '초안', description: 'AI 또는 사용자가 작성 중인 일정입니다.' },
  CONFIRMED: { code: 'CONFIRMED', name: '확정', description: '여행이 확정된 일정입니다.' },
  COMPLETED: { code: 'COMPLETED', name: '완료', description: '여행을 마친 일정입니다.' },
}

/** 백엔드 size 허용 범위 (1~50). 벗어나면 `PLAN_113` 400 이다 */
const MIN_SIZE = 1
const MAX_SIZE = 50
const DEFAULT_SIZE = 10

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

const ITEM_TITLE_MAX = 100
const ITEM_MEMO_MAX = 500

function toSummary(plan: MockPlan): PlanSummaryItem {
  return {
    planId: plan.planId,
    petId: plan.petId,
    areaCode: plan.areaCode,
    title: plan.title,
    startDate: plan.startDate,
    endDate: plan.endDate,
    status: STATUS[plan.status] ?? { code: plan.status, name: plan.status, description: null },
  }
}

/** 백엔드 `PlanItemType` 의 displayName/description 복제본 */
const ITEM_TYPE: Record<string, CodeNameMetadata> = {
  PLACE: { code: 'PLACE', name: '장소', description: '관광지·카페 등 방문 장소 항목입니다.' },
  MEAL: { code: 'MEAL', name: '식사', description: '식당 방문 항목입니다.' },
  LODGING: { code: 'LODGING', name: '숙박', description: '숙소 체크인/숙박 항목입니다.' },
  WALK: { code: 'WALK', name: '산책', description: '산책 코스 항목입니다.' },
  MOVE: { code: 'MOVE', name: '이동', description: '이동 구간 항목입니다.' },
}

function totalDaysOf(plan: MockPlan): number {
  const start = Date.parse(`${plan.startDate}T00:00:00Z`)
  const end = Date.parse(`${plan.endDate}T00:00:00Z`)
  return Math.round((end - start) / 86_400_000) + 1
}

function toItem(item: MockPlanItem): PlanItemDetail {
  return {
    planItemId: item.planItemId,
    day: item.day,
    sequence: item.sequence,
    itemType: ITEM_TYPE[item.itemType] ?? {
      code: item.itemType,
      name: item.itemType,
      description: null,
    },
    targetId: item.targetId,
    title: item.title,
    memo: item.memo,
    startTime: item.startTime,
  }
}

function toDetail(plan: MockPlan): PlanDetail {
  return {
    ...toSummary(plan),
    sigunguCode: plan.sigunguCode,
    budget: plan.budget,
    totalDays: totalDaysOf(plan),
    /*
      저장 순서를 그대로 주지 않는다 — 백엔드가 day·sequence 로 정렬해 내려준다.

      **직접 만들기는 빈 배열이지만 AI 초안 담기는 항목을 함께 보낸다**
      (`PlanCreateRequest.items`, ai-plan 명세 S5). 보낸 것을 그대로 되돌려 주지 않으면
      담은 직후 화면이 빈 일정을 보여 준다.
    */
    items: [...plan.items]
      .sort((a, b) => (a.day === b.day ? a.sequence - b.sequence : a.day - b.day))
      .map(toItem),
  }
}

/**
 * 요청 항목 검증 + 저장 형태로 변환.
 *
 * **백엔드와 같은 경계여야 한다.** `itemType` 은 `PlanItemType` enum 으로 역직렬화되고
 * `title` 에 `@NotBlank`, `day` 에 `@Min(1)` 이 걸려 있어 **항목 하나가 어긋나면 요청
 * 전체가 400** 이다. mock 이 느슨하면 FE 가 "걸러서 보낸다" 는 판단을 검증하지 못한다.
 */
function toItems(
  raw: unknown,
  store: ReturnType<typeof mockStore>,
  errors: { code: string; field: string; message: string }[],
): MockPlanItem[] {
  if (raw === undefined || raw === null) return []

  if (!Array.isArray(raw)) {
    errors.push({ code: 'PLAN_100', field: 'items', message: '요청 값이 올바르지 않습니다.' })
    return []
  }

  return raw.map((entry, index) => {
    const item = (entry ?? {}) as Record<string, unknown>
    const field = `items[${index}]`

    const day = Number(item.day)
    if (!Number.isInteger(day) || day < 1) {
      errors.push({
        code: 'PLAN_108',
        field: `${field}.day`,
        message: '일차는 1 이상이어야 합니다.',
      })
    }

    const itemType = typeof item.itemType === 'string' ? item.itemType : ''
    if (ITEM_TYPE[itemType] === undefined) {
      errors.push({
        code: 'PLAN_109',
        field: `${field}.itemType`,
        message: '항목 유형은 필수입니다.',
      })
    }

    const title = typeof item.title === 'string' ? item.title.trim() : ''
    if (title === '') {
      errors.push({
        code: 'PLAN_110',
        field: `${field}.title`,
        message: '항목 이름은 필수입니다.',
      })
    } else if (title.length > ITEM_TITLE_MAX) {
      errors.push({
        code: 'PLAN_111',
        field: `${field}.title`,
        message: '항목 이름은 100자 이하만 가능합니다.',
      })
    }

    const memo = typeof item.memo === 'string' ? item.memo : null
    if (memo !== null && memo.length > ITEM_MEMO_MAX) {
      errors.push({
        code: 'PLAN_112',
        field: `${field}.memo`,
        message: '메모는 500자 이하만 가능합니다.',
      })
    }

    // targetId 는 Long 이지만 FE 가 정밀도 때문에 문자열로 보낸다 — 양쪽을 받는다
    const rawTarget = item.targetId
    const targetId =
      typeof rawTarget === 'string' && rawTarget !== ''
        ? rawTarget
        : typeof rawTarget === 'number'
          ? String(rawTarget)
          : null

    return {
      planItemId: nextPlanItemId(store),
      day,
      sequence: Number.isInteger(Number(item.sequence)) ? Number(item.sequence) : index,
      itemType,
      targetId,
      title: title.slice(0, ITEM_TITLE_MAX),
      memo: memo === null || memo.trim() === '' ? null : memo,
      startTime: typeof item.startTime === 'string' ? item.startTime : null,
    }
  })
}

export function resolvePlanMock(
  path: string,
  method: string,
  search: string,
  body: string | null,
  accessToken: string | null,
): MockResult | null {
  if (!path.startsWith('/plans')) return null

  // 모든 일정 엔드포인트가 @PreAuthorize("isAuthenticated()") 다
  const memberId = memberIdOf(accessToken)
  if (memberId === null) return UNAUTHORIZED()

  if (path === '/plans') {
    if (method === 'GET') return list(memberId, search)
    if (method === 'POST') return create(memberId, body)
    return null
  }

  const weather = /^\/plans\/([^/]+)\/weather$/.exec(path)
  if (weather !== null && method === 'GET') {
    return withPlan(memberId, weather[1] ?? '', (plan) => ({
      status: 200,
      payload: ok(toWeather(plan)),
    }))
  }

  const detail = /^\/plans\/([^/]+)$/.exec(path)
  if (detail !== null) {
    const rawId = detail[1] ?? ''

    if (method === 'GET') {
      return withPlan(memberId, rawId, (plan) => ({ status: 200, payload: ok(toDetail(plan)) }))
    }
    if (method === 'PUT') return withPlan(memberId, rawId, (plan) => update(plan, body))
    if (method === 'DELETE') {
      return withPlan(memberId, rawId, (plan) => {
        // 백엔드는 소프트 삭제다 — 행이 남고 조회에서만 빠진다
        plan.deleted = true
        return { status: 200, payload: ok(null) }
      })
    }
  }

  return null
}

/**
 * `planId` 를 판정하고 소유한 일정을 넘긴다.
 *
 * **숫자가 아닌 id 는 404 가 아니라 400 이다** — 컨트롤러가 `@PathVariable long` 이라
 * 바인딩 단계에서 걸린다 (장소 상세의 `PLACE_113` 과 같은 상황).
 * **남의 일정도 404 다** — 컨트롤러 설명이 존재 여부를 흘리지 않겠다고 명시했다.
 */
function withPlan(
  memberId: string,
  rawId: string,
  handle: (plan: MockPlan) => MockResult,
): MockResult {
  if (!/^\d+$/.test(rawId)) {
    return fail(400, 'PLAN_114', '요청 파라미터 형식이 올바르지 않습니다.')
  }

  const plan = mockStore().plans.find(
    (candidate) =>
      candidate.planId === rawId && candidate.memberId === memberId && !candidate.deleted,
  )
  if (plan === undefined) return fail(404, 'PLAN_001', '존재하지 않는 여행 일정입니다.')

  return handle(plan)
}

/**
 * 부분 수정. **보내지 않은 필드는 유지된다** (`PlanCommandProcessor.updatePlan`).
 *
 * `budget: null` 은 "지운다" 가 아니라 "유지" 다 — 백엔드와 같아야 화면이 0 을 보내는
 * 이유(D4)가 mock 에서도 성립한다.
 */
function update(plan: MockPlan, body: string | null): MockResult {
  let parsed: Record<string, unknown>
  try {
    parsed = body === null ? {} : (JSON.parse(body) as Record<string, unknown>)
  } catch {
    return fail(400, 'PLAN_100', '요청 값이 올바르지 않습니다.')
  }

  const errors: { code: string; field: string; message: string }[] = []

  // 문자열이 아닌 title 은 Jackson 이 400 으로 거른다. mock 도 문자열만 본다
  if (parsed.title !== undefined && parsed.title !== null) {
    const title = typeof parsed.title === 'string' ? parsed.title.trim() : ''
    if (title.length === 0) {
      errors.push({ code: 'PLAN_103', field: 'title', message: '일정 제목은 필수입니다.' })
    } else if (title.length > 60) {
      errors.push({
        code: 'PLAN_104',
        field: 'title',
        message: '일정 제목은 60자 이하만 가능합니다.',
      })
    }
  }

  if (parsed.budget !== undefined && parsed.budget !== null) {
    const budget = Number(parsed.budget)
    if (!Number.isFinite(budget) || budget < 0) {
      errors.push({ code: 'PLAN_107', field: 'budget', message: '예산은 0 이상이어야 합니다.' })
    }
  }

  if (errors.length > 0) return failValidation(errors)

  if (typeof parsed.title === 'string') plan.title = parsed.title.trim()
  if (typeof parsed.budget === 'number') plan.budget = parsed.budget
  if (typeof parsed.status === 'string') plan.status = parsed.status

  return { status: 200, payload: ok(toDetail(plan)) }
}

/**
 * 커서 기반 목록. **`id DESC` 로 정렬한다** — 백엔드
 * `findByMemberIdAndDeletedFalseAndIdLessThanOrderByIdDesc` 와 같은 순서여야
 * 화면의 재정렬 로직이 실제와 같은 입력을 받는다 (공통명세 S5).
 */
function list(memberId: string, search: string): MockResult {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search)

  const rawSize = params.get('size')
  const size = rawSize === null ? DEFAULT_SIZE : Number(rawSize)
  if (!Number.isInteger(size) || size < MIN_SIZE || size > MAX_SIZE) {
    return failValidation([
      { code: 'PLAN_113', field: 'size', message: '조회 개수는 1 이상 50 이하만 가능합니다.' },
    ])
  }

  const mine = mockStore()
    .plans.filter((plan) => plan.memberId === memberId && !plan.deleted)
    .sort((a, b) => (a.planId < b.planId ? 1 : a.planId > b.planId ? -1 : 0))

  // 커서는 "직전 응답의 마지막 planId" 이고 서버는 `id < cursor` 로 자른다
  const cursor = params.get('lastPlanId')
  const remaining = cursor === null ? mine : mine.filter((plan) => plan.planId < cursor)

  const contents = remaining.slice(0, size).map(toSummary)
  const body: SliceResponse<PlanSummaryItem> = { contents, hasNext: remaining.length > size }

  return { status: 200, payload: ok(body) }
}

function create(memberId: string, body: string | null): MockResult {
  let parsed: Record<string, unknown>
  try {
    parsed = body === null ? {} : (JSON.parse(body) as Record<string, unknown>)
  } catch {
    return fail(400, 'PLAN_100', '요청 값이 올바르지 않습니다.')
  }

  const errors: { code: string; field: string; message: string }[] = []

  // petId 는 서버가 Long 으로 읽는다. FE 는 정밀도 때문에 문자열로 실어 보내므로 둘 다 받는다
  const petId =
    typeof parsed.petId === 'string'
      ? parsed.petId
      : typeof parsed.petId === 'number'
        ? String(parsed.petId)
        : ''
  if (!/^\d+$/.test(petId)) {
    errors.push({ code: 'PLAN_101', field: 'petId', message: '반려견 아이디는 필수입니다.' })
  }

  const areaCode = typeof parsed.areaCode === 'string' ? parsed.areaCode.trim() : ''
  if (areaCode === '') {
    errors.push({ code: 'PLAN_102', field: 'areaCode', message: '지역 코드는 필수입니다.' })
  }

  const title = typeof parsed.title === 'string' ? parsed.title.trim() : ''
  if (title === '') {
    errors.push({ code: 'PLAN_103', field: 'title', message: '일정 제목은 필수입니다.' })
  } else if (title.length > 60) {
    errors.push({
      code: 'PLAN_104',
      field: 'title',
      message: '일정 제목은 60자 이하만 가능합니다.',
    })
  }

  const startDate = typeof parsed.startDate === 'string' ? parsed.startDate : ''
  if (!DATE_PATTERN.test(startDate)) {
    errors.push({ code: 'PLAN_105', field: 'startDate', message: '여행 시작일은 필수입니다.' })
  }

  const endDate = typeof parsed.endDate === 'string' ? parsed.endDate : ''
  if (!DATE_PATTERN.test(endDate)) {
    errors.push({ code: 'PLAN_106', field: 'endDate', message: '여행 종료일은 필수입니다.' })
  }

  const budget =
    parsed.budget === undefined || parsed.budget === null ? null : Number(parsed.budget)
  if (budget !== null && (!Number.isInteger(budget) || budget < 0)) {
    errors.push({ code: 'PLAN_107', field: 'budget', message: '예산은 0 이상이어야 합니다.' })
  }

  if (errors.length > 0) return failValidation(errors)

  /*
    **날짜 역전은 필드 오류가 아니라 도메인 예외다** — `PLAN_003` 400 이고 Bean
    Validation 응답 형태가 아니다. 필드 오류로 흉내 내면 FE 의 폼 오류 매핑이
    실제로는 안 걸리는 경로를 통과시킨다.
  */
  if (startDate > endDate) {
    return fail(400, 'PLAN_003', '여행 시작일은 종료일보다 늦을 수 없습니다.')
  }

  const store = mockStore()

  /*
    **항목 검증을 반려견 소유권보다 먼저 한다.** 백엔드는 Bean Validation 이 도메인
    검증보다 먼저 돌기 때문이다 — 순서가 뒤바뀌면 FE 가 실제로는 못 보는 오류를 본다.
  */
  const itemErrors: { code: string; field: string; message: string }[] = []
  const items = toItems(parsed.items, store, itemErrors)
  if (itemErrors.length > 0) return failValidation(itemErrors)

  const pet = store.pets.find(
    (candidate) =>
      candidate.petId === petId && candidate.memberId === memberId && !candidate.deleted,
  )
  // 백엔드는 반려견 소유권을 auth-service 로 검증한다. 남의 반려견이면 400 이다
  if (pet === undefined) {
    return failValidation([
      { code: 'PLAN_101', field: 'petId', message: '반려견 아이디는 필수입니다.' },
    ])
  }

  const plan: MockPlan = {
    planId: nextPlanId(store),
    memberId,
    petId,
    areaCode,
    sigunguCode: typeof parsed.sigunguCode === 'string' ? parsed.sigunguCode : null,
    title,
    startDate,
    endDate,
    budget,
    // 새 일정은 항상 초안이다 — `PlanCreateRequest` 에 status 가 없다
    status: 'DRAFT',
    /*
      **`items` 를 버리지 않는다.** 직접 만들기는 빈 배열을 보내지만(공통명세 S9 — 장소는
      일자 편집에서 담는다), **AI 초안 담기는 항목을 함께 보낸다** (ai-plan 명세 S5).
      `[]` 로 고정하면 담은 직후 빈 일정이 보이고 항목 검증도 확인할 수 없다.
    */
    items,
    deleted: false,
  }
  store.plans.push(plan)

  return { status: 200, payload: ok(toDetail(plan)) }
}

// ─── 일자별 판정 (#80) ────────────────────────────────────────────────────────

/** 백엔드 `SuitabilityLevel` 복제본. `insight-data.ts` 와 같은 값이어야 한다 */
const SUITABILITY: Record<string, ScoreMetricMetadata> = {
  HIGH: {
    code: 'HIGH',
    name: '여행 적합',
    description: '반려견과 방문하기 좋은 조건입니다.',
    scoreDescription: '점수가 높을수록 날씨/동반 조건이 반려견에게 유리합니다.',
  },
  MEDIUM: {
    code: 'MEDIUM',
    name: '보통',
    description: '일부 조건을 확인하고 가면 무난합니다.',
    scoreDescription: '점수가 중간이면 주의할 조건이 한둘 있다는 뜻입니다.',
  },
}

/**
 * 예보가 닿는 일수. 백엔드가 단기+중기를 이어 붙여 **약 11일**까지 준다
 * (`PlanWebController.getPlanWeather` 설명). mock 은 fixture 안에서 두 경우를 모두
 * 드러내야 하므로 2일로 줄여 잡는다 — 3일차부터 `score: null` 이다.
 */
const MOCK_FORECAST_DAYS = 2

function addDays(date: string, days: number): string {
  const time = Date.parse(`${date}T00:00:00Z`)
  return new Date(time + days * 86_400_000).toISOString().slice(0, 10)
}

/**
 * 일자별 판정.
 *
 * **`days` 는 항상 `totalDays` 길이다.** 배열 길이로 성공/실패를 판단하지 않는다 —
 * 판정을 못 낸 날은 `score: null` + `unavailableReason` 으로 온다.
 */
function toWeather(plan: MockPlan): PlanWeatherResponse {
  const totalDays = totalDaysOf(plan)

  const days: PlanDayWeatherItem[] = Array.from({ length: totalDays }, (_, index) => {
    const day = index + 1
    const date = addDays(plan.startDate, index)

    // 그날 첫 장소 항목이 판정 기준이다 (컨트롤러 설명). 없으면 기준이 없다
    const basis = [...plan.items]
      .filter((item) => item.day === day && item.targetId !== null && item.itemType !== 'WALK')
      .sort((a, b) => a.sequence - b.sequence)[0]

    const representativePlaceId = basis?.targetId ?? null
    const representativePlaceTitle = basis?.title ?? null

    // 예보 밖 — **점수가 낮은 것이 아니라 판단 근거가 없는 것이다**
    if (day > MOCK_FORECAST_DAYS || representativePlaceId === null) {
      return {
        day,
        date,
        representativePlaceId,
        representativePlaceTitle,
        score: null,
        suitabilityLevel: null,
        reasons: [],
        weather: null,
        indoorAlternatives: [],
        unavailableReason:
          representativePlaceId === null
            ? '이 날은 담은 장소가 없어 판정할 기준이 없습니다.'
            : '기상 예보는 11일까지만 제공돼 이 날은 아직 판단할 수 없습니다.',
      }
    }

    // 2일차는 비 예보 + 중기예보 구간이다 — 실내 대안과 출처 문구를 함께 드러낸다
    const rainy = day === 2

    return {
      day,
      date,
      representativePlaceId,
      representativePlaceTitle,
      score: rainy ? 62 : 84,
      suitabilityLevel: (rainy ? SUITABILITY.MEDIUM : SUITABILITY.HIGH) as ScoreMetricMetadata,
      reasons: rainy
        ? [
            {
              code: 'RAIN_EXPECTED',
              name: '비 예보',
              description: '강수확률이 80%라 야외 활동이 어려울 수 있습니다.',
            },
            {
              code: 'TEMPERATURE_OK',
              name: '기온 적정',
              description: '최고기온 24도로 반려견에게 무리가 없습니다.',
            },
          ]
        : [
            {
              code: 'PET_ALLOWED',
              name: '반려견 동반 가능',
              description: '반려견과 함께 입장할 수 있는 장소입니다.',
            },
            {
              code: 'TEMPERATURE_OK',
              name: '기온 적정',
              description: '최고기온 26도로 반려견에게 무리가 없습니다.',
            },
            {
              code: 'CONGESTION_UNKNOWN',
              name: '혼잡도 정보 없음',
              description: '이 장소의 혼잡도 자료가 아직 없습니다.',
            },
          ],
      weather: {
        date,
        // MID_TERM 이면 대략적인 값이다 — 화면이 출처를 밝힌다
        forecastSourceCode: rainy ? 'MID_TERM' : 'SHORT_TERM',
        forecastSourceName: rainy ? '중기예보' : '단기예보',
        minTemperature: rainy ? 19.0 : 21.0,
        maxTemperature: rainy ? 24.0 : 26.0,
        maxPrecipitationProbability: rainy ? 80 : 10,
        precipitationTypeName: rainy ? '비' : '없음',
        skyStateName: rainy ? '흐림' : '맑음',
        maxWindSpeed: rainy ? 7.2 : 3.1,
        maxHumidity: rainy ? 88 : 60,
      },
      // 비 예보가 있고 그날 장소가 실내가 아닐 때만 채워진다 (컨트롤러 설명)
      indoorAlternatives: rainy ? indoorAlternatives() : [],
      unavailableReason: null,
    }
  })

  return {
    planId: plan.planId,
    planTitle: plan.title,
    startDate: plan.startDate,
    endDate: plan.endDate,
    petConditionApplied: true,
    days,
  }
}

/** 실내 대안. `{placeId, title}` 뿐이라 화면이 보강해야 상세를 말할 수 있다 */
function indoorAlternatives(): { placeId: string; title: string }[] {
  return MOCK_PLACES.filter((place) => place.indoor === true)
    .slice(0, 2)
    .map((place) => ({ placeId: place.placeId, title: place.title }))
}
