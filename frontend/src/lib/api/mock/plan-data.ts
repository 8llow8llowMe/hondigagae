import type { MockResult } from '@/lib/api/mock/auth-data'
import { mockPlanEmergency } from '@/lib/api/mock/emergency-data'
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
  PlanAlternativePlaceItem,
  PlanDayWeatherItem,
  PlanDetail,
  PlanItemDetail,
  PlanItemPlace,
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

/** `@Size(max = 5)` — 넘으면 `PLAN_115` (#152) */
const MAX_PLAN_PETS = 5

/** `@Positive` — 0 과 음수를 거른다. 앞자리 0 도 Snowflake 가 아니다 */
const POSITIVE_ID_PATTERN = /^[1-9]\d*$/

/**
 * 반려견 아이디는 서버가 `Long` 으로 읽는다. FE 는 정밀도 때문에 문자열로 실어 보내므로
 * **둘 다 받는다** — 숫자로 와도 문자열로 접어 두면 이후 비교가 한 갈래다.
 */
function toPetIdString(raw: unknown): string {
  if (typeof raw === 'string') return raw
  if (typeof raw === 'number') return String(raw)
  return ''
}

/**
 * 대표 반려견. 요청이 반려견을 지정하지 않았을 때의 기본값이다
 * (`PetConditionQueryPort.findRepresentativePetId`).
 *
 * **없으면 빈 배열이다** — 부른 쪽이 `PLAN_010` 으로 접는다. auth-service 는 회원당 대표를
 * 하나만 유지하므로 여기서도 첫 하나만 본다.
 */
function representativePetIdsOf(store: ReturnType<typeof mockStore>, memberId: string): string[] {
  const representative = store.pets.find(
    (pet) => pet.memberId === memberId && pet.representative && !pet.deleted,
  )
  return representative === undefined ? [] : [representative.petId]
}

const ITEM_TITLE_MAX = 100
const ITEM_MEMO_MAX = 500

/**
 * `verifyPlaceTargets` 의 대상. **`WALK` 은 빠진다** — 그 `targetId` 는 `walk_course.id`
 * 라 tour-service 에 물어볼 값이 아니다 (`PlanCommandProcessor.PLACE_TARGET_TYPES`).
 */
const PLACE_TARGET_TYPES = new Set(['PLACE', 'MEAL', 'LODGING'])

/** mock 이 아는 장소. 여기 없는 `targetId` 는 백엔드처럼 `PLAN_004` 로 막는다 */
const KNOWN_PLACE_IDS = new Set(MOCK_PLACES.map((place) => place.placeId))

/** placeId → 장소. 항목의 `place` 요약을 채울 때 쓴다 (#86) */
const PLACE_BY_ID = new Map(MOCK_PLACES.map((place) => [place.placeId, place]))

/** 총 일수(양끝 포함). `Plan.containsDay()` 와 같은 셈이어야 한다 */
function daysBetween(startDate: string, endDate: string): number {
  const start = Date.parse(`${startDate}T00:00:00Z`)
  const end = Date.parse(`${endDate}T00:00:00Z`)
  if (Number.isNaN(start) || Number.isNaN(end)) return 1

  return Math.max(1, Math.round((end - start) / 86_400_000) + 1)
}

/**
 * 동행 반려견 (#152).
 *
 * **`plan_pet` 행이 없는 옛 일정을 `[petId]` 로 읽는 서버 규칙을 그대로 둔다**
 * (`Plan.resolvePetIds()`). fixture 에 `petIds` 를 심어 뒀지만 이 폴백이 없으면
 * 계약이 "가끔 빈 배열" 로 읽히고, 화면이 `petIds[0]` 을 못 믿게 된다.
 */
function petIdsOf(plan: MockPlan): string[] {
  return plan.petIds.length > 0 ? plan.petIds : [plan.petId]
}

function toSummary(plan: MockPlan): PlanSummaryItem {
  return {
    planId: plan.planId,
    petId: plan.petId,
    petIds: petIdsOf(plan),
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

/**
 * 항목의 장소 요약 (#86). **백엔드가 tour-service 에 물어본 결과를 재현한다.**
 *
 * `null` 이 세 갈래다 — 화면이 셋을 구분하지 못한다는 사실 자체가 계약이라 mock 도
 * 세 갈래를 다 낸다:
 *  - 장소를 가리키지 않는 항목 (`WALK`·`MOVE`) → 물어볼 대상이 없다
 *  - 원천에서 사라진(delisted) 장소 → `MOCK_PLACES` 에 없는 `targetId`
 *  - tour-service 장애 → mock 에는 없지만 같은 모양(`place: null`)으로 온다
 */
function toItemPlace(item: MockPlanItem): PlanItemPlace | null {
  if (item.targetId === null || !PLACE_TARGET_TYPES.has(item.itemType)) return null

  const place = PLACE_BY_ID.get(item.targetId)
  if (place === undefined) return null

  return {
    addr1: place.addr1,
    indoor: place.indoor,
    firstImage: place.firstImage,
    lat: place.lat,
    lng: place.lng,
  }
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
    visited: item.visited,
    place: toItemPlace(item),
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
      // 새 항목은 방문 체크가 꺼진 상태로 태어난다 (`PlanItemEntity.visited` 기본값, #124)
      visited: false,
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

  const dayItems = /^\/plans\/([^/]+)\/days\/([^/]+)\/items$/.exec(path)
  if (dayItems !== null && method === 'PUT') {
    return withPlan(memberId, dayItems[1] ?? '', (plan) =>
      replaceDayItems(plan, dayItems[2] ?? '', body),
    )
  }

  /*
    항목 방문 체크 (#124). **`/days/{day}/items` 보다 뒤, 상세(`/plans/{id}`) 보다 앞이다** —
    상세 정규식 `^/plans/([^/]+)$` 는 하위 경로를 잡지 않지만, 순서를 명시해 두면 그
    규칙을 넓힐 때 실수하지 않는다 (index.ts 의 인사이트 주석과 같은 판단).
  */
  const itemVisited = /^\/plans\/([^/]+)\/items\/([^/]+)\/visited$/.exec(path)
  if (itemVisited !== null && method === 'PUT') {
    return withPlan(memberId, itemVisited[1] ?? '', (plan) =>
      markVisited(plan, itemVisited[2] ?? '', body),
    )
  }

  const weather = /^\/plans\/([^/]+)\/weather$/.exec(path)
  if (weather !== null && method === 'GET') {
    return withPlan(memberId, weather[1] ?? '', (plan) => ({
      status: 200,
      payload: ok(toWeather(plan)),
    }))
  }

  /*
    응급 브리핑 (#125). **`withPlan` 을 거친다** — 남의 일정·없는 일정은 404 여야 하고,
    그 판정을 여기서 다시 쓰면 상세와 어긋날 수 있다.
  */
  const emergency = /^\/plans\/([^/]+)\/emergency$/.exec(path)
  if (emergency !== null && method === 'GET') {
    return withPlan(memberId, emergency[1] ?? '', (plan) => ({
      status: 200,
      payload: ok(mockPlanEmergency(plan.planId)),
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
 * 항목 방문 체크 — `PUT /plans/{planId}/items/{planItemId}/visited` (#124).
 *
 * 근거: `PlanWebController.markItemVisited` · `PlanItemVisitedRequest` ·
 * `PlanCommandProcessor.markItemVisited` **소스 실측**.
 *
 * **소유권은 일정 기준으로 보고, 항목이 그 일정의 것인지 다시 확인한다** — 백엔드가
 * `findById(planItemId).filter(found -> found.planId() == plan.id())` 로 그렇게 한다.
 * `planItemId` 만 믿으면 남의 일정 항목을 내 `planId` 로 체크할 수 있다.
 *
 * **응답이 `Response<Void>` 다** — `dataBody` 가 `null` 이라, 호출부가 `clientFetch` 로
 * 부르면 "서버는 저장했는데 화면만 실패" 가 된다. mock 도 같은 모양을 내야 그 함정이
 * 로컬에서 드러난다.
 */
function markVisited(plan: MockPlan, rawItemId: string, body: string | null): MockResult {
  // 컨트롤러가 `@PathVariable long` 이라 숫자가 아닌 id 는 404 가 아니라 400 이다
  if (!/^\d+$/.test(rawItemId)) {
    return fail(400, 'PLAN_114', '요청 파라미터 형식이 올바르지 않습니다.')
  }

  let parsed: Record<string, unknown>
  try {
    parsed = body === null ? {} : (JSON.parse(body) as Record<string, unknown>)
  } catch {
    return fail(400, 'PLAN_100', '요청 값이 올바르지 않습니다.')
  }

  // `@NotNull Boolean visited` — 빠지면 Bean Validation 이 잡는다
  if (typeof parsed.visited !== 'boolean') {
    return failValidation([
      { code: 'PLAN_100', field: 'visited', message: '방문 여부는 필수입니다.' },
    ])
  }

  const item = plan.items.find((candidate) => candidate.planItemId === rawItemId)
  // 없는 항목, 또는 **다른 일정의** 항목이면 404 다 (`PLAN_005`)
  if (item === undefined) return fail(404, 'PLAN_005', '존재하지 않는 일정 항목입니다.')

  item.visited = parsed.visited
  return { status: 200, payload: ok(null) }
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

  /*
    **`petId` 는 더 이상 필수가 아니다** (#152). `@NotNull` 이 빠지고 `@Positive` 만 남아
    `PLAN_101` 의 뜻이 "필수" 에서 "양수여야 한다" 로 바뀌었다 — 필드는 같고 위반 종류만
    바뀐 자리다 (`PlanValidationMessage.PET_ID_POSITIVE`).
  */
  const petId = toPetIdString(parsed.petId)
  if (parsed.petId !== undefined && parsed.petId !== null && !POSITIVE_ID_PATTERN.test(petId)) {
    errors.push({ code: 'PLAN_101', field: 'petId', message: '반려견 아이디는 양수여야 합니다.' })
  }

  /*
    동행 반려견 (#152). 배열이 아니면 Jackson 역직렬화가 먼저 깨지므로 필드 오류가 아니라
    `PLAN_100` 이다 — 본문 파싱 실패와 같은 자리다.
  */
  if (parsed.petIds !== undefined && parsed.petIds !== null && !Array.isArray(parsed.petIds)) {
    return fail(400, 'PLAN_100', '요청 값이 올바르지 않습니다.')
  }
  const petIds = Array.isArray(parsed.petIds) ? parsed.petIds.map(toPetIdString) : []
  if (petIds.length > MAX_PLAN_PETS) {
    errors.push({
      code: 'PLAN_115',
      field: 'petIds',
      message: '동행 반려견은 최대 5마리까지 지정할 수 있습니다.',
    })
  }
  // 원소마다 `@Positive` 가 걸려 있다 — 필드 코드는 petId 와 같은 PLAN_101 이다
  if (petIds.some((candidate) => !POSITIVE_ID_PATTERN.test(candidate))) {
    errors.push({ code: 'PLAN_101', field: 'petIds', message: '반려견 아이디는 양수여야 합니다.' })
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
    **반려견 확정이 항목 검증보다 먼저다** (#152). 서버는 저장 *전에* `resolvePetIds` 를
    부르고 항목 검증(`PLAN_002`·`PLAN_004`)은 저장 *뒤에* 돈다
    (`PlanCommandProcessor.createPlan`). 순서를 뒤집으면 FE 가 실제로는 못 보는 오류를 본다.

    **`petIds` 가 `petId` 를 이긴다.** 중복은 순서를 지켜 한 마리로 접는다 —
    첫 번째가 대표 반려견이 된다 (`PlanCreateRequest.effectivePetIds`).
  */
  const requestedPetIds = petIds.length > 0 ? [...new Set(petIds)] : petId === '' ? [] : [petId]

  /*
    지정이 없으면 **대표 반려견**으로 대신한다 — 한 마리만 키우는 사용자가 담기마다
    반려견을 고르게 하지 않기 위한 기본값이다. 대표도 없으면 일정을 만들 수 없다
    (`PLAN_010`) — `plan.pet_id` 가 NOT NULL 이고 날씨 판정의 기준이기 때문이다.

    **필드 오류가 아니라 도메인 예외다** — Bean Validation 응답 형태로 흉내 내면
    FE 의 폼 오류 매핑이 실제로는 안 걸리는 경로를 통과시킨다.
  */
  const effectivePetIds =
    requestedPetIds.length > 0 ? requestedPetIds : representativePetIdsOf(store, memberId)
  if (effectivePetIds.length === 0) {
    return fail(400, 'PLAN_010', '동행할 반려견을 지정하거나 대표 반려견을 등록해 주세요.')
  }

  const itemErrors: { code: string; field: string; message: string }[] = []
  const items = toItems(parsed.items, store, itemErrors)
  if (itemErrors.length > 0) return failValidation(itemErrors)

  /*
    **일차 범위와 장소 존재를 함께 본다** — `PlanCommandProcessor.createPlan` 이
    `validateItemDays` → `verifyPlaceTargets` 를 순서대로 부른다. 둘 다 도메인 예외라
    Bean Validation 응답 형태가 아니다.

    이 둘이 없으면 이 저장소의 `PLAN_004` 복구 UI("빼고 담기")가 로컬에서 한 번도
    열리지 않는다.
  */
  const totalDays = daysBetween(startDate, endDate)
  if (items.some((item) => item.day > totalDays)) {
    return fail(400, 'PLAN_002', '여행 일차가 여행 기간을 벗어났습니다.')
  }

  const missing = items.find(
    (item) =>
      PLACE_TARGET_TYPES.has(item.itemType) &&
      item.targetId !== null &&
      !KNOWN_PLACE_IDS.has(item.targetId),
  )
  if (missing !== undefined) {
    return fail(400, 'PLAN_004', '일정에 포함된 장소를 찾을 수 없습니다.')
  }

  /*
    **남의 반려견을 거절하지 않는다.** 예전 mock 은 여기서 `PLAN_101` 400 을 냈지만
    plan-service 는 `petId` 소유권을 검사하지 않는다 — `createPlan` 이 값을 그대로 저장하고,
    auth-service 는 **나중에 날씨 판정의 특성 조회에서만** 소유권을 본다(소유가 아니면 특성이
    빠질 뿐 일정은 만들어진다). mock 이 더 엄격하면 FE 가 프로덕션에 없는 오류 분기를 만든다.
  */
  const plan: MockPlan = {
    planId: nextPlanId(store),
    memberId,
    // 대표 = 첫 번째. 목록 전체는 petIds 에 둔다 (#152 설계 판단 1)
    petId: effectivePetIds[0] as string,
    petIds: effectivePetIds,
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
  LOW: {
    code: 'LOW',
    name: '주의 필요',
    description: '반려견과 방문하기에 불리한 조건이 있습니다.',
    scoreDescription: '점수가 낮을수록 피하거나 시간대를 옮기는 편이 좋습니다.',
  },
}

/**
 * 점수 → 등급. 백엔드 `SuitabilityLevel.from` 의 경계와 같아야 한다 — **80 / 60** 이다.
 * `null` 은 `INSUFFICIENT` 지만 이 mock 은 점수를 못 낸 날에 등급도 `null` 로 두므로
 * (`PlanDayWeatherItem.suitabilityLevel` 이 nullable 이다) 여기서는 다루지 않는다.
 */
function levelOf(score: number): ScoreMetricMetadata {
  if (score >= 80) return SUITABILITY.HIGH as ScoreMetricMetadata
  if (score >= 60) return SUITABILITY.MEDIUM as ScoreMetricMetadata
  return SUITABILITY.LOW as ScoreMetricMetadata
}

/**
 * 두 번째 이후 반려견의 점수 낙폭 (#152).
 *
 * mock 에는 아이별 특성 차이가 없어 그대로 두면 모든 아이가 같은 점수를 받고,
 * **기준 반려견(`basisPetId`)이 언제나 대표와 같아진다** — 화면이 "대표 이름을 붙이면
 * 거짓말이 되는" 경로를 로컬에서 한 번도 못 본다. 11 은 84 → 73(보통), 62 → 51(주의 필요)로
 * **등급까지 갈리게** 고른 값이다.
 */
const PET_SCORE_STEP = 11

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
  const petIds = petIdsOf(plan)

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
        // 판정을 못 냈으면 기준 반려견도 없고 아이별 목록도 빈 배열이다 (`briefDay`)
        basisPetId: null,
        score: null,
        suitabilityLevel: null,
        reasons: [],
        weather: null,
        indoorAlternatives: [],
        petSuitabilities: [],
        unavailableReason:
          representativePlaceId === null
            ? '이 날은 담은 장소가 없어 판정할 기준이 없습니다.'
            : '기상 예보는 11일까지만 제공돼 이 날은 아직 판단할 수 없습니다.',
      }
    }

    // 2일차는 비 예보 + 중기예보 구간이다 — 실내 대안과 출처 문구를 함께 드러낸다
    const rainy = day === 2

    /*
      **아이별로 따로 판정한다** (#152). 서버는 아이마다 조건이 달라 tour-service 를 따로
      부르지만, mock 에는 그 차이가 없으므로 순서대로 낙폭을 준다 — 값이 아니라 **모양**이
      계약이다. 순서는 `petIds` 순서를 지킨다 (서버가 `LinkedHashMap` 으로 보존한다).
    */
    const petSuitabilities = petIds.map((petId, order) => {
      const petScore = (rainy ? 62 : 84) - order * PET_SCORE_STEP
      return { petId, score: petScore, suitabilityLevel: levelOf(petScore) }
    })

    /*
      **그날의 기준은 점수가 가장 낮은 아이다** — 한 마리라도 힘든 날이면 그날은 힘든
      날이라는 규칙이다 (`PlanWeatherProcessor.pickBasisPet`). 동점이면 순서상 앞선 아이가
      이기므로 `reduce` 의 비교를 `<` 로 둔다 (`Comparator.min` 과 같은 결과다).

      아래 `score`·`suitabilityLevel`·`reasons`·`indoorAlternatives` 가 전부 이 아이 기준이라,
      **여러 마리면 대표(petIds[0]) 점수와 다르다.**
    */
    const basisPet = petSuitabilities.reduce((lowest, candidate) =>
      candidate.score < lowest.score ? candidate : lowest,
    )

    return {
      day,
      date,
      representativePlaceId,
      representativePlaceTitle,
      basisPetId: basisPet.petId,
      score: basisPet.score,
      suitabilityLevel: basisPet.suitabilityLevel,
      reasons: rainy
        ? [
            {
              code: 'RAIN_EXPECTED',
              name: '비 예보',
              description: '강수확률이 80%라 야외 활동이 어려울 수 있습니다.',
              scoreDelta: -25,
            },
            {
              code: 'TEMPERATURE_OK',
              name: '기온 적정',
              description: '최고기온 24도로 반려견에게 무리가 없습니다.',
              scoreDelta: 0,
            },
          ]
        : [
            {
              code: 'PET_ALLOWED',
              name: '반려견 동반 가능',
              description: '반려견과 함께 입장할 수 있는 장소입니다.',
              scoreDelta: 0,
            },
            {
              code: 'TEMPERATURE_OK',
              name: '기온 적정',
              description: '최고기온 26도로 반려견에게 무리가 없습니다.',
              scoreDelta: 0,
            },
            {
              code: 'CONGESTION_UNKNOWN',
              name: '혼잡도 정보 없음',
              description: '이 장소의 혼잡도 자료가 아직 없습니다.',
              // 정보성 — 감점이 아니다. 화면이 한 단계 흐리게 내리는 분기를 로컬에서 볼 수 있게 둔다
              scoreDelta: 0,
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
      indoorAlternatives: rainy ? indoorAlternatives(representativePlaceId) : [],
      petSuitabilities,
      unavailableReason: null,
    }
  })

  return {
    planId: plan.planId,
    planTitle: plan.title,
    startDate: plan.startDate,
    endDate: plan.endDate,
    petIds,
    // 여러 마리면 "한 마리라도 특성이 반영됐는가" 다 — 마리별 플래그가 아니다 (#152)
    petConditionApplied: true,
    days,
  }
}

/**
 * 실내 대안.
 *
 * **좌표와 거리를 서버가 준다** (`PlanAlternativePlaceItem` 5필드). 거리는 그날 기준
 * 장소로부터의 하버사인 직선거리라 mock 도 같은 방식으로 잰다 — 주소·실내 여부는
 * 계약에 없어 화면이 `GET /places/{id}` 로 보강한다.
 */
function indoorAlternatives(representativePlaceId: string | null): PlanAlternativePlaceItem[] {
  const basis = MOCK_PLACES.find((place) => place.placeId === representativePlaceId) ?? null
  const basisLat = basis?.lat ?? null
  const basisLng = basis?.lng ?? null

  return (
    MOCK_PLACES
      // 좌표 없는 장소는 애초에 반경 검색에 걸리지 않는다 — 서버가 lat/lng 로 조회한다
      .filter((place) => place.indoor === true && place.lat !== null && place.lng !== null)
      .slice(0, 2)
      .map((place) => ({
        placeId: place.placeId,
        title: place.title,
        lat: place.lat as number,
        lng: place.lng as number,
        distanceMeters:
          basisLat === null || basisLng === null
            ? 0
            : Math.round(geoMeters(basisLat, basisLng, place.lat as number, place.lng as number)),
      }))
  )
}

/**
 * 백엔드 `GeoDistance.meters()` 의 복제본 — 하버사인.
 *
 * **FE 의 `haversineMeters`(`src/lib/geo/distance.ts`)를 부르지 않는다.** mock 은 서버
 * 역할이라 화면 코드에 기대면 안 되고, 지구 반지름도 서버 값(6_371_000)을 따른다
 * (FE 는 WGS84 평균 6_371_008.8 이라 미세하게 다르다).
 */
function geoMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const EARTH_RADIUS_M = 6_371_000
  const rad = (degrees: number) => (degrees * Math.PI) / 180

  const dLat = rad(lat2 - lat1)
  const dLng = rad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLng / 2) ** 2

  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(a)))
}

// ─── 일자별 항목 일괄 교체 (#81) ──────────────────────────────────────────────

// `ITEM_TITLE_MAX` · `ITEM_MEMO_MAX` · `PLACE_TARGET_TYPES` · `KNOWN_PLACE_IDS` 는
// `POST /plans`(항목 동반 생성)가 이미 쓰고 있다. 같은 계약이므로 재사용한다

/** 백엔드 `PlanItemType` 에 있는 코드만 받는다 */
const ITEM_TYPE_CODES = new Set(Object.keys(ITEM_TYPE))

/**
 * 해당 일차의 항목을 통째로 교체한다. **부분 수정이 아니다** —
 * 빈 목록을 보내면 그 일차 항목이 모두 삭제된다.
 *
 * 백엔드 `PlanCommandProcessor.replaceDayItems` 의 순서를 그대로 따른다:
 * `containsDay` → `verifyPlaceTargets` → 삭제 → 재삽입. **순서가 중요하다** —
 * 장소 검증이 삭제보다 먼저라 `PLAN_004` 로 막히면 기존 항목이 그대로 남는다.
 */
function replaceDayItems(plan: MockPlan, rawDay: string, body: string | null): MockResult {
  // 경로의 day 도 @PathVariable int 다. 숫자가 아니면 400 이다
  if (!/^\d+$/.test(rawDay)) {
    return fail(400, 'PLAN_114', '요청 파라미터 형식이 올바르지 않습니다.')
  }
  const day = Number(rawDay)

  let parsed: { items?: unknown }
  try {
    parsed = body === null ? {} : (JSON.parse(body) as { items?: unknown })
  } catch {
    return fail(400, 'PLAN_100', '요청 값이 올바르지 않습니다.')
  }

  // `items` 가 없으면 서버는 List.of() 로 읽는다 (toCommands 의 null 처리)
  const raw = Array.isArray(parsed.items) ? (parsed.items as Record<string, unknown>[]) : []

  // Bean Validation 이 먼저 돈다 — 본문 각 항목의 @Min(1)/@NotBlank/@Size
  const errors = validateItems(raw)
  if (errors.length > 0) return failValidation(errors)

  // containsDay — 여행 기간 밖이면 PLAN_002
  if (day < 1 || day > totalDaysOf(plan)) {
    return fail(400, 'PLAN_002', '여행 기간을 벗어난 일자입니다.')
  }

  // verifyPlaceTargets — delisting 된 장소도 걸러낸다. **삭제보다 먼저다**
  const unknown = raw.some((item) => {
    const targetId = item.targetId
    if (typeof targetId !== 'string' || !PLACE_TARGET_TYPES.has(String(item.itemType))) return false
    return !KNOWN_PLACE_IDS.has(targetId)
  })
  if (unknown) {
    return fail(400, 'PLAN_004', '존재하지 않는 장소가 포함되어 있습니다.')
  }

  // 삭제 후 재삽입 — **planItemId 가 전부 새로 발급된다.** 서버와 같아야
  // "저장 성공 시 편집 상태를 통째로 버린다" 규칙을 화면이 실제로 검증할 수 있다
  const store = mockStore()
  plan.items = [
    ...plan.items.filter((item) => item.day !== day),
    ...raw.map((item, index) => toStoredItem(item, day, index, store)),
  ]

  return { status: 200, payload: ok(toDetail(plan)) }
}

function validateItems(raw: Record<string, unknown>[]): {
  code: string
  field: string
  message: string
}[] {
  const errors: { code: string; field: string; message: string }[] = []

  raw.forEach((item, index) => {
    const field = `items[${index}]`

    // @Min(1) — 서버가 경로값으로 덮어쓰지만 검증이 먼저 돈다
    if (typeof item.day !== 'number' || item.day < 1) {
      errors.push({
        code: 'PLAN_110',
        field: `${field}.day`,
        message: '일차는 1 이상이어야 합니다.',
      })
    }
    // @NotNull + enum 바인딩
    if (typeof item.itemType !== 'string' || !ITEM_TYPE_CODES.has(item.itemType)) {
      errors.push({
        code: 'PLAN_111',
        field: `${field}.itemType`,
        message: '항목 유형은 필수입니다.',
      })
    }
    // @NotBlank + @Size(max = 100)
    const title = typeof item.title === 'string' ? item.title.trim() : ''
    if (title.length === 0) {
      errors.push({ code: 'PLAN_105', field: `${field}.title`, message: '항목 이름은 필수입니다.' })
    } else if (title.length > ITEM_TITLE_MAX) {
      errors.push({
        code: 'PLAN_106',
        field: `${field}.title`,
        message: '항목 이름은 100자 이하만 가능합니다.',
      })
    }
    // @Size(max = 500)
    if (typeof item.memo === 'string' && item.memo.length > ITEM_MEMO_MAX) {
      errors.push({
        code: 'PLAN_108',
        field: `${field}.memo`,
        message: '메모는 500자 이하만 가능합니다.',
      })
    }
  })

  return errors
}

function toStoredItem(
  item: Record<string, unknown>,
  day: number,
  sequence: number,
  store: ReturnType<typeof mockStore>,
): MockPlanItem {
  return {
    // 새로 발급한다 — 서버가 삭제 후 재삽입하기 때문이다
    planItemId: nextPlanItemId(store),
    day,
    // 서버는 본문의 sequence 를 그대로 쓴다. 화면이 0부터 다시 매겨 보낸다
    sequence: typeof item.sequence === 'number' ? item.sequence : sequence,
    itemType: String(item.itemType),
    targetId: typeof item.targetId === 'string' ? item.targetId : null,
    title: String(item.title),
    memo: typeof item.memo === 'string' ? item.memo : null,
    startTime: typeof item.startTime === 'string' ? item.startTime : null,
    /*
      **항상 `false` 다 — 이것이 계약의 핵심이다** (#124). 백엔드는 일괄 교체 때 항목을
      삭제 후 재삽입하므로 그 날의 방문 체크가 통째로 초기화된다. mock 이 체크를
      이어받으면 화면이 경고 문구로 말하는 사실을 로컬에서 검증할 수 없다.
    */
    visited: false,
  }
}
