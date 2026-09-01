import type { MockResult } from '@/lib/api/mock/auth-data'
import { MOCK_PLACES } from '@/lib/api/mock/place-data'
import { memberIdOf, type MockAiPlanJob, mockStore, nextAiPlanJobId } from '@/lib/api/mock/store'
import type {
  AiPlanDayItem,
  AiPlanDraft,
  AiPlanJob,
  AiPlanScheduleItem,
  AiPlanSubmitResult,
} from '@/types/ai-plan'
import type { ApiResponse, CodeNameMetadata } from '@/types/api'

/**
 * AI 일정 생성 mock.
 *
 * **백엔드보다 느슨하거나 엄격해서는 안 된다** (`plan-data.ts` 와 같은 규칙).
 *
 * 근거: `AiPlanWebController` · `AiPlanCreateRequest` · `AiPlanSubmitResponse` ·
 * `AiPlanJobStatusResponse` · `AiPlanDraftResponse` · `AiPlanScheduleItem` ·
 * `AiPlanErrorCode` · `AiPlanValidationMessage` **소스 실측** (`origin/develop` `af86c98`).
 *
 * **워커가 없으므로 조회 횟수로 상태를 진행시킨다.** 폴링 2초 × 3회면 완료에 닿아
 * 실제 소요 시간(수십 초)보다 빠르지만, 화면이 봐야 하는 것은 전이 자체다.
 */

function ok<T>(dataBody: T, status = 200): MockResult {
  return {
    status,
    payload: {
      dataHeader: { success: true, resultCode: null, resultMessage: null },
      dataBody,
    } satisfies ApiResponse<T>,
  }
}

function fail(status: number, resultCode: string, resultMessage: unknown): MockResult {
  return {
    status,
    payload: { dataHeader: { success: false, resultCode, resultMessage }, dataBody: null },
  }
}

/** Bean Validation 실패는 `{ message, errors: [...] }` 형태로 온다 — ValidationErrorSupport */
function failValidation(errors: { code: string; field: string; message: string }[]): MockResult {
  return fail(400, 'AIPLAN_100', {
    message: errors[0]?.message ?? '요청 값이 올바르지 않습니다.',
    errors,
  })
}

// 토큰이 없거나 유효하지 않은 요청은 도메인에 닿기 전에 security-core 가 막는다 —
// `SecurityErrorCode.UNAUTHORIZED`. **`AUTH_011` 이 아니다**: 그것은
// `OAUTH_PROFILE_REQUIRED` 이고 400 이라, 401 과 짝지으면 서버가 내지 않는 조합이 된다 (#83)
const UNAUTHORIZED = () => fail(401, 'SECURITY_001', '인증이 필요합니다.')

/** 백엔드 `AiPlanJobStatus` 의 displayName/description 복제본 */
const STATUS: Record<string, CodeNameMetadata> = {
  PENDING: {
    code: 'PENDING',
    name: '대기 중',
    description: '일정 생성 작업이 대기열에 있습니다.',
  },
  RUNNING: {
    code: 'RUNNING',
    name: '생성 중',
    description: '반려견 조건에 맞는 장소를 모아 일자별로 배치하고 있습니다.',
  },
  COMPLETED: {
    code: 'COMPLETED',
    name: '완료',
    description: '여행 일정 생성이 완료되었습니다.',
  },
  FAILED: { code: 'FAILED', name: '실패', description: 'AI 일정 생성 작업이 실패했습니다.' },
}

const SUBMITTED: CodeNameMetadata = {
  code: 'ACCEPTED',
  name: '작업 접수됨',
  description: '일정 생성 작업이 접수되었습니다. 작업 상태 조회 API로 완료 여부를 확인해 주세요.',
}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

/**
 * 식별자를 문자열로 읽는다. FE 는 정밀도 때문에 문자열로 실어 보내지만 서버는 `Long`
 * 이라 숫자로 오는 경우도 유효하다 — 양쪽을 받는다 (`plan-data.ts` 와 같은 처리).
 */
function asIdString(value: unknown): string | null {
  if (typeof value === 'string') return value.trim() === '' ? null : value.trim()
  if (typeof value === 'number') return String(value)
  return null
}

/** `AiPlanCreateRequest.pinnedPlaceIds` 의 `@Size(max = 10)` 복제본 (#128) */
const PINNED_MAX = 10

/** `POST /ai-plans` 는 `@Positive` 라 0 을 거부한다 — 일정 생성(`@PositiveOrZero`)과 다르다 */
const NOTE_MAX = 500

/**
 * 시나리오 트리거.
 *
 * mock 이 무작위로 갈리면 화면 분기를 확인할 수 없다. **요청 메모에 이 낱말이 있으면
 * 그 시나리오로 간다** — 개발 중에 실패 화면과 일수 부족 화면을 의도적으로 열기 위한
 * 장치다. `local-run-guide.md` 에 적어 둔다.
 */
function scenarioOf(requestNote: string | null): MockAiPlanJob['scenario'] {
  const note = requestNote ?? ''
  if (note.includes('실패')) return 'failed'
  if (note.includes('일부')) return 'partial'
  if (note.includes('사라진')) return 'delisted'
  return 'normal'
}

/**
 * 원천에서 사라진 장소의 id. **`MOCK_PLACES` 에 없는 값**이라
 * `GET /places/{id}` 가 404 를 내고 담기가 `PLAN_004` 로 막힌다 — 이 저장소의
 * "빼고 담기" 복구 경로를 로컬에서 열기 위한 장치다 (명세 S5 함정 3).
 */
const DELISTED_PLACE_ID = '999999999999999999'

export function resolveAiPlanMock(
  path: string,
  method: string,
  body: string | null,
  accessToken: string | null,
): MockResult | null {
  const isSubmit = path === '/ai-plans' && method === 'POST'
  const jobMatch = /^\/ai-plans\/jobs\/([^/]+)$/.exec(path)

  if (!isSubmit && (jobMatch === null || method !== 'GET')) return null

  // 두 엔드포인트 모두 @PreAuthorize("isAuthenticated()") 다
  const memberId = memberIdOf(accessToken)
  if (memberId === null) return UNAUTHORIZED()

  if (isSubmit) return submit(memberId, body)

  return jobStatus(memberId, jobMatch?.[1] ?? '')
}

function submit(memberId: string, body: string | null): MockResult {
  let parsed: Record<string, unknown>
  try {
    parsed = body === null ? {} : (JSON.parse(body) as Record<string, unknown>)
  } catch {
    return fail(400, 'AIPLAN_100', '요청 값이 올바르지 않습니다.')
  }

  const errors: { code: string; field: string; message: string }[] = []

  const areaCode = typeof parsed.areaCode === 'string' ? parsed.areaCode.trim() : ''
  if (areaCode === '') {
    errors.push({ code: 'AIPLAN_101', field: 'areaCode', message: '여행 지역 코드는 필수입니다.' })
  }

  const startDate = typeof parsed.startDate === 'string' ? parsed.startDate : ''
  if (!DATE_PATTERN.test(startDate)) {
    errors.push({ code: 'AIPLAN_102', field: 'startDate', message: '여행 시작일은 필수입니다.' })
  }

  const endDate = typeof parsed.endDate === 'string' ? parsed.endDate : ''
  if (!DATE_PATTERN.test(endDate)) {
    errors.push({ code: 'AIPLAN_103', field: 'endDate', message: '여행 종료일은 필수입니다.' })
  }

  /*
    **petId 는 선택이다** — `@Positive` 만 걸려 있고 `@NotNull` 이 없다 (PR #78).
    값이 없으면 워커가 대표 반려견으로 대신한다. FE 는 정밀도 때문에 문자열로 실어
    보내므로 문자열·숫자 양쪽을 받는다.
  */
  const petId = asIdString(parsed.petId)
  if (petId !== null && !/^[1-9]\d*$/.test(petId)) {
    errors.push({ code: 'AIPLAN_105', field: 'petId', message: '반려견 식별자는 양수여야 합니다.' })
  }

  /*
    **`@Positive` 다.** 0 을 보내면 400 이다 — 일정 생성(`@PositiveOrZero`)과 다르므로
    mock 도 같은 경계를 지켜야 FE 의 "0 이면 키 생략" 판단이 검증된다.
  */
  const rawBudget = parsed.budget
  const budget = rawBudget === undefined || rawBudget === null ? null : Number(rawBudget)
  if (budget !== null && (!Number.isInteger(budget) || budget <= 0)) {
    errors.push({ code: 'AIPLAN_106', field: 'budget', message: '예산은 0보다 커야 합니다.' })
  }

  const requestNote = typeof parsed.requestNote === 'string' ? parsed.requestNote : null
  if (requestNote !== null && requestNote.length > NOTE_MAX) {
    errors.push({
      code: 'AIPLAN_107',
      field: 'requestNote',
      message: '요청 메모는 500자 이하만 가능합니다.',
    })
  }

  /*
    **`pinnedPlaceIds` 는 `@Size(max = 10)` 이고 원소는 `@Positive` 다** (#128).
    mock 이 상한을 지켜야 FE 의 "시트가 10곳에서 막는다" 판단이 검증된다 — 느슨하면
    화면 버그가 로컬에서 통과한다.

    `preferFavorites` 에는 제약이 없다(`Boolean`). 검증할 것이 없어 읽기만 한다 —
    **키가 오는지 자체는 계약에 영향이 없다**: 서버가 `Boolean.TRUE.equals()` 로 받는다.
  */
  const pinnedPlaceIds: unknown[] | null = Array.isArray(parsed.pinnedPlaceIds)
    ? (parsed.pinnedPlaceIds as unknown[])
    : null
  if (pinnedPlaceIds !== null) {
    if (pinnedPlaceIds.length > PINNED_MAX) {
      errors.push({
        code: 'AIPLAN_109',
        field: 'pinnedPlaceIds',
        message: `꼭 넣을 장소는 ${PINNED_MAX}곳 이하만 가능합니다.`,
      })
    }
    const badId = pinnedPlaceIds.find((raw) => {
      const id = asIdString(raw)
      return id === null || !/^[1-9]\d*$/.test(id)
    })
    if (badId !== undefined) {
      errors.push({
        code: 'AIPLAN_110',
        field: 'pinnedPlaceIds',
        message: '장소 식별자는 양수여야 합니다.',
      })
    }
  }

  if (errors.length > 0) return failValidation(errors)

  /*
    **날짜 역전은 필드 오류가 아니라 도메인 예외다** — `AIPLAN_001` 400 이고 Bean
    Validation 응답 형태가 아니다 (`plan-data.ts` 의 `PLAN_003` 과 같은 판단).
  */
  if (startDate > endDate) {
    return fail(400, 'AIPLAN_001', '여행 시작일은 종료일보다 늦을 수 없습니다.')
  }

  const store = mockStore()

  /*
    **멱등하다.** 같은 회원의 같은 조건이 진행 중이면 기존 jobId 를 그대로 준다
    (컨트롤러 설명). 완료된 작업은 대상이 아니다 — 다시 만들기가 막히면 안 된다.
  */
  const existing = store.aiPlanJobs.find(
    (job) =>
      job.memberId === memberId &&
      job.petId === (petId ?? '') &&
      job.startDate === startDate &&
      job.endDate === endDate &&
      job.budget === budget &&
      statusOf(job) !== 'COMPLETED' &&
      statusOf(job) !== 'FAILED',
  )
  if (existing !== undefined) {
    return ok<AiPlanSubmitResult>({ submissionStatus: SUBMITTED, jobId: existing.jobId }, 202)
  }

  const job: MockAiPlanJob = {
    jobId: nextAiPlanJobId(store),
    memberId,
    scenario: scenarioOf(requestNote),
    petId: petId ?? '',
    areaCode,
    startDate,
    endDate,
    budget,
    requestNote,
    pollCount: 0,
  }
  store.aiPlanJobs.push(job)

  // 제출은 **202** 다 (`ResponseEntity.status(HttpStatus.ACCEPTED)`)
  return ok<AiPlanSubmitResult>({ submissionStatus: SUBMITTED, jobId: job.jobId }, 202)
}

function jobStatus(memberId: string, jobId: string): MockResult {
  const job = mockStore().aiPlanJobs.find((candidate) => candidate.jobId === jobId)

  // **타인의 jobId 도 404 다** — 존재를 노출하지 않는다 (403 이 아니다)
  if (job === undefined || job.memberId !== memberId) {
    return fail(404, 'AIPLAN_002', '요청하신 AI 일정 생성 작업을 찾을 수 없습니다.')
  }

  const status = statusOf(job)
  job.pollCount += 1

  if (status === 'FAILED') {
    return ok<AiPlanJob>({
      jobId: job.jobId,
      status: STATUS.FAILED as CodeNameMetadata,
      planDraft: null,
      // AIPLAN_012 — 실패 이유가 조건 문제일 수 있다는 것을 화면이 다뤄야 한다
      errorCode: 'AIPLAN_012',
      errorMessage: '여행 일정에 넣을 반려견 동반 가능 장소를 찾지 못했습니다.',
    })
  }

  if (status !== 'COMPLETED') {
    return ok<AiPlanJob>({
      jobId: job.jobId,
      status: STATUS[status] as CodeNameMetadata,
      planDraft: null,
      errorCode: null,
      errorMessage: null,
    })
  }

  return ok<AiPlanJob>({
    jobId: job.jobId,
    status: STATUS.COMPLETED as CodeNameMetadata,
    planDraft: draftFor(job),
    errorCode: null,
    errorMessage: null,
  })
}

/**
 * 조회 횟수 → 상태.
 *
 * 0회: `PENDING` / 1회: `RUNNING` / 2회 이상: 시나리오에 따라 `COMPLETED` 또는 `FAILED`.
 * **완료·실패에 닿으면 그 상태에 머문다** — 화면이 폴링을 멈춘 뒤 새로고침해도 같은
 * 결과를 봐야 한다.
 */
function statusOf(job: MockAiPlanJob): 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' {
  if (job.pollCount === 0) return 'PENDING'
  if (job.pollCount === 1) return 'RUNNING'
  return job.scenario === 'failed' ? 'FAILED' : 'COMPLETED'
}

/** 총 일수. 기간에서 센다 — 초안에는 `totalDays` 가 없다 */
function totalDaysOf(job: MockAiPlanJob): number {
  const start = Date.parse(`${job.startDate}T00:00:00Z`)
  const end = Date.parse(`${job.endDate}T00:00:00Z`)
  if (Number.isNaN(start) || Number.isNaN(end)) return 1

  return Math.max(1, Math.round((end - start) / 86_400_000) + 1)
}

/**
 * 초안. **실제 `MOCK_PLACES` 의 placeId 를 쓴다** — 항목 보강(`GET /places/{placeId}`)이
 * 실제 경로 그대로 돌아야 화면을 확인할 수 있다.
 *
 * 한 일자에 네 종류를 섞는다:
 *  - `PLACE` — 보강 대상
 *  - `MEAL` — 보강 대상
 *  - `WALK` — **`placeId` 가 실려 있다.** FE 가 `targetId` 를 빼는지 확인해야 한다 (S5 함정 2)
 *  - `MOVE` — `placeId` 가 null 이라 보강하지 않는다
 */
function draftFor(job: MockAiPlanJob): AiPlanDraft {
  const total = totalDaysOf(job)
  // `partial` 시나리오는 마지막 하루를 비운다 — status 는 COMPLETED 다 (명세 S6)
  const made = job.scenario === 'partial' ? Math.max(1, total - 1) : total

  const days: AiPlanDayItem[] = Array.from({ length: made }, (_, index) => ({
    day: index + 1,
    items: itemsFor(index, job.scenario === 'delisted' && index === 0),
  }))

  return {
    days,
    reasons: [
      {
        code: 'PET_SIZE_FIT',
        name: '반려견 크기 적합',
        description: '소형견도 전 구역 동반이 가능한 곳을 우선했어요.',
      },
      {
        code: 'HEAT_AVOIDANCE',
        name: '더위 회피',
        description: '더위에 약한 아이라 오전은 야외, 오후는 실내로 묶었어요.',
      },
      {
        code: 'MOVE_DISTANCE',
        name: '이동 거리',
        description: '하루 이동 거리를 20km 안쪽으로 유지했어요.',
      },
    ],
  }
}

function itemsFor(dayIndex: number, delisted: boolean): AiPlanScheduleItem[] {
  const pick = (offset: number) => MOCK_PLACES[(dayIndex * 3 + offset) % MOCK_PLACES.length]

  const first = pick(0)
  const second = pick(1)
  const third = pick(2)

  return [
    {
      itemType: 'PLACE',
      // 사라진 장소 시나리오는 첫 항목만 실재하지 않는 id 로 바꾼다
      placeId: delisted ? DELISTED_PLACE_ID : (first?.placeId ?? null),
      title: first?.title ?? '장소',
      note: '오전이라 노면이 덜 뜨거워요.',
    },
    {
      itemType: 'MEAL',
      placeId: second?.placeId ?? null,
      title: second?.title ?? '식사',
      note: '테라스에 반려견 자리가 있어요.',
    },
    {
      // **placeId 가 실려 있다.** targetId 로 그대로 보내면 walk_course.id 와 어긋난다
      itemType: 'WALK',
      placeId: third?.placeId ?? null,
      title: '해안 산책로 산책',
      note: '목줄 착용 필수예요.',
    },
    {
      itemType: 'MOVE',
      placeId: null,
      title: '숙소로 이동',
      /*
        **`note` 를 null 로 둔다.** DTO 에 제약이 없고 presenter 도 방어하지 않으므로
        실제로 올 수 있는 값이다 — 화면이 `.trim()` 을 바로 부르면 여기서 죽는다.
        mock 이 항상 문자열을 채우면 그 구멍을 로컬에서 볼 수 없다.
      */
      note: null,
    },
  ]
}
