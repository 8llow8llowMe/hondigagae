import type { MockResult } from '@/lib/api/mock/auth-data'
import { memberIdOf, type MockPlan, mockStore, nextPlanId } from '@/lib/api/mock/store'
import type { ApiResponse, CodeNameMetadata, SliceResponse } from '@/types/api'
import type { PlanDetail, PlanSummaryItem } from '@/types/plan'

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

function toDetail(plan: MockPlan): PlanDetail {
  const start = Date.parse(`${plan.startDate}T00:00:00Z`)
  const end = Date.parse(`${plan.endDate}T00:00:00Z`)

  return {
    ...toSummary(plan),
    sigunguCode: plan.sigunguCode,
    budget: plan.budget,
    totalDays: Math.round((end - start) / 86_400_000) + 1,
    // 생성 요청에서 items 를 보내지 않으므로 항상 빈 배열이다 (공통명세 S9)
    items: [],
  }
}

export function resolvePlanMock(
  path: string,
  method: string,
  search: string,
  body: string | null,
  accessToken: string | null,
): MockResult | null {
  if (path !== '/plans') return null

  // 모든 일정 엔드포인트가 @PreAuthorize("isAuthenticated()") 다
  const memberId = memberIdOf(accessToken)
  if (memberId === null) return UNAUTHORIZED()

  if (method === 'GET') return list(memberId, search)
  if (method === 'POST') return create(memberId, body)

  return null
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
    deleted: false,
  }
  store.plans.push(plan)

  return { status: 200, payload: ok(toDetail(plan)) }
}
