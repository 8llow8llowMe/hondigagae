import { JOB_STREAM_EVENT } from '@/lib/ai-plan/job-stream'
import type { MockResult } from '@/lib/api/mock/auth-data'
import { MOCK_PLACES } from '@/lib/api/mock/place-data'
import { memberIdOf, type MockAiPlanJob, mockStore, nextAiPlanJobId } from '@/lib/api/mock/store'
import type { MockStreamFrame } from '@/lib/api/mock/stream'
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

type JobStatusCode = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELED'

/**
 * 백엔드 `AiPlanJobStatus` 의 displayName/description **복제본**.
 *
 * **문구가 어긋나면 안 된다.** 화면이 `status.description` 을 그대로 그리므로(명세 S7)
 * mock 이 다른 말을 하면 로컬에서 본 문장이 배포에서 달라진다 — `CANCELED` 를 더하면서
 * 넷 다 실측으로 다시 맞췄다 (#250).
 */
const STATUS: Record<string, CodeNameMetadata> = {
  PENDING: {
    code: 'PENDING',
    name: '대기 중',
    description: '작업이 큐에서 실행을 기다리고 있습니다.',
  },
  RUNNING: {
    code: 'RUNNING',
    name: '생성 중',
    description: 'AI가 반려견 맞춤 여행 일정을 생성하고 있습니다.',
  },
  COMPLETED: {
    code: 'COMPLETED',
    name: '완료',
    description: '여행 일정 생성이 완료되었습니다.',
  },
  FAILED: {
    code: 'FAILED',
    name: '실패',
    description: '여행 일정 생성에 실패했습니다. 잠시 후 다시 시도해 주세요.',
  },
  CANCELED: { code: 'CANCELED', name: '취소됨', description: '사용자가 작업을 취소했습니다.' },
}

/**
 * 백엔드 `AiPlanJobStep` 의 displayName/description 복제본 (#250).
 *
 * **선언 순서가 곧 단계 순서다** — 백엔드도 `ordinal` 에서 `order` 를 뽑는다.
 */
const STEPS: CodeNameMetadata[] = [
  {
    code: 'CONDITIONS',
    name: '조건 확인',
    description: '반려견 특성과, 하루 재생성이면 기존 일정을 확인합니다.',
  },
  {
    code: 'CANDIDATES',
    name: '후보 장소 수집',
    description: '여행 지역에서 반려견 동반이 확인된 장소를 모읍니다.',
  },
  {
    code: 'WEATHER',
    name: '날씨 전망 반영',
    description: '여행 기간의 일자별 날씨 전망을 붙입니다.',
  },
  { code: 'DRAFTING', name: '일정 구성', description: 'AI 가 후보 장소로 일자별 일정을 짭니다.' },
]

/**
 * **값의 개수에서 뽑는다. 손으로 적지 않는다** — 백엔드가 `values().length` 로 내리는
 * 것과 같은 이유다. 적어 두면 단계를 더할 때 한쪽만 고쳐져 `5 / 4 단계` 가 나간다.
 */
const TOTAL_STEPS = STEPS.length

/** 단계 코드 → metadata. 모르는 코드면 null (계약상 오지 않지만 mock 이 죽지 않게) */
function stepOf(code: string | null): CodeNameMetadata | null {
  return STEPS.find((step) => step.code === code) ?? null
}

/**
 * 상태에 해당하는 단계 코드.
 *
 * **`PENDING` 은 null 이다** — 아직 시작하지 않았다. 종결 상태에는 마지막으로 밟은 단계가
 * 남는다(`DRAFTING`). 취소는 선 지점이 그대로 남으므로 저장해 둔 값을 쓴다.
 */
function stepCodeOf(job: MockAiPlanJob, status: JobStatusCode): string | null {
  if (status === 'PENDING') return null
  if (status === 'RUNNING') return 'CONDITIONS'
  if (status === 'CANCELED') return job.canceledAtStep
  return 'DRAFTING'
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

/** `AiPlanCreateRequest.petIds` 의 `@Size(max = 5)` 복제본 (#128) */
const PET_MAX = 5

/** `POST /ai-plans` 는 `@Positive` 라 0 을 거부한다 — 일정 생성(`@PositiveOrZero`)과 다르다 */
const NOTE_MAX = 500

/**
 * `AiPlanJobProcessor.MAX_TRIP_DAYS` 의 **독립 사본이다** (#128).
 *
 * 화면 쪽 상수(`lib/ai-plan/regenerate.ts` 의 `AI_PLAN_MAX_TRIP_DAYS`)를 가져다 쓰지
 * 않는다 — mock 은 가짜 서버이고, 같은 상수를 공유하면 화면이 상한을 잘못 고쳐도 mock 이
 * 함께 틀려 로컬에서 통과한다. plan-service 상한(30일)과 다른 값이라는 점이 요점이다.
 */
const MAX_TRIP_DAYS = 10

/** 양끝 포함 여행 일수. 형식은 앞의 Bean Validation 이 이미 걸러서 못 읽으면 0 이다 */
function tripDays(startDate: string, endDate: string): number {
  const start = Date.parse(`${startDate}T00:00:00Z`)
  const end = Date.parse(`${endDate}T00:00:00Z`)
  return Number.isNaN(start) || Number.isNaN(end) ? 0 : Math.floor((end - start) / 86_400_000) + 1
}

/**
 * 서버의 `command.startDate().isBefore(LocalDate.now())`.
 *
 * `YYYY-MM-DD` 는 사전순 = 시간순이라 문자열 비교로 충분하다. **`lib/date/day.ts` 를
 * 가져다 쓰지 않는다** — 위 상수와 같은 이유로 판정을 화면과 공유하지 않는다.
 */
function isStartDateInPast(startDate: string): boolean {
  const now = new Date()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')

  return startDate < `${now.getFullYear()}-${month}-${day}`
}

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
  const cancelMatch = /^\/ai-plans\/jobs\/([^/]+)\/cancel$/.exec(path)
  const isCancel = cancelMatch !== null && method === 'POST'
  const packingMatch = /^\/ai-plans\/packing-list\/([^/]+)$/.exec(path)
  const isPacking = packingMatch !== null && method === 'POST'

  if (!isSubmit && !isPacking && !isCancel && (jobMatch === null || method !== 'GET')) return null

  // 네 엔드포인트 모두 @PreAuthorize("isAuthenticated()") 다
  const memberId = memberIdOf(accessToken)
  if (memberId === null) return UNAUTHORIZED()

  if (isSubmit) return submit(memberId, body)

  if (isPacking) return packingList(memberId, packingMatch?.[1] ?? '')

  if (isCancel) return cancelJob(memberId, cancelMatch?.[1] ?? '')

  return jobStatus(memberId, jobMatch?.[1] ?? '')
}

/**
 * `POST /ai-plans/jobs/{jobId}/cancel` mock (#250).
 *
 * **워커가 없어 "협조적" 이라는 성질은 흉내 낼 수 없다.** 실제 서버는 상태만 못 박고 워커가
 * 단계 경계에서 스스로 서지만, mock 에는 돌고 있는 것이 없어 즉시 종결된다. 화면이 확인할
 * 수 있는 것은 **상태 전이와 갈래**이고 그것은 같다.
 *
 * 계약에서 지켜야 하는 세 가지:
 *  - 이미 취소된 작업은 **200 멱등** — 두 번 눌러도 오류가 아니다
 *  - 완료·실패한 작업은 **409 `AIPLAN_019`** (400 이 아니다 — 요청이 아니라 대상의 문제다)
 *  - 취소는 실패가 아니므로 **`errorCode` 를 채우지 않는다**
 */
function cancelJob(memberId: string, jobId: string): MockResult {
  const job = mockStore().aiPlanJobs.find((candidate) => candidate.jobId === jobId)

  // **타인의 jobId 도 404 다** — 조회와 같은 규칙이다
  if (job === undefined || job.memberId !== memberId) {
    return fail(404, 'AIPLAN_002', '요청하신 AI 일정 생성 작업을 찾을 수 없습니다.')
  }

  const status = statusOf(job)

  if (status === 'CANCELED') return ok<AiPlanJob>(jobBody(job, 'CANCELED'))

  if (status === 'COMPLETED' || status === 'FAILED') {
    return fail(409, 'AIPLAN_019', '이미 끝난 작업은 취소할 수 없습니다.')
  }

  job.canceledAtStep = stepCodeOf(job, status)
  job.canceled = true

  return ok<AiPlanJob>(jobBody(job, 'CANCELED'))
}

/**
 * SSE 프레임 간격.
 *
 * **실제 소요 시간을 흉내 내지 않는다** — 로컬 LLM 기준 수십 초다. 여기서 재현하려는
 * 것은 길이가 아니라 **전이가 따로따로 도착한다는 사실**이다. 통째로 버퍼링되면
 * 한꺼번에 오므로, 간격이 있어야 통과 여부를 눈으로 가를 수 있다.
 */
const STREAM_SNAPSHOT_MS = 0
/**
 * 단계 하나가 지나는 간격 (#250).
 *
 * **잡당 이벤트가 2회에서 6회로 늘었다** — 백엔드가 단계마다 하나씩 내보낸다. mock 도 그
 * 모양이어야 `n / m 단계` 가 실제로 움직이는 것을 로컬에서 볼 수 있다.
 */
const STREAM_STEP_MS = 600
const STREAM_TERMINAL_MS = STREAM_STEP_MS * (TOTAL_STEPS + 1)

/**
 * mock 스트림 해석 결과.
 *
 * `error` 는 **스트림이 시작되기 전** 실패다 — 백엔드도 소유권 검증 실패(`AIPLAN_002`)를
 * SSE 가 아니라 일반 JSON 오류로 응답한다(`AiPlanJobSseStreamer.stream` 주석).
 * 그래서 BFF 가 이 경우를 기존 버퍼링 경로로 되돌릴 수 있어야 한다.
 */
export type MockStreamResult =
  { kind: 'error'; result: MockResult } | { kind: 'stream'; frames: MockStreamFrame[] }

/**
 * `GET /ai-plans/jobs/{jobId}/stream` mock (#91).
 *
 * **진행을 조회 횟수가 아니라 시간이 끌고 간다.** 폴링 mock 은 워커가 없어 조회할 때마다
 * 상태를 한 칸 옮기지만, 스트림에서는 시간 경과 자체가 워커 역할을 한다.
 *
 * 그래서 스트림을 열 때 `pollCount` 를 종결까지 밀어 둔다 — 사용자가 RUNNING 에서 화면을
 * 떠났다가 새로고침하면 완료를 보게 된다. **그게 맞다**: 실제 작업은 보는 사람이 없어도
 * 백그라운드에서 끝난다.
 */
export function resolveAiPlanStreamMock(
  path: string,
  method: string,
  accessToken: string | null,
): MockStreamResult | null {
  const match = /^\/ai-plans\/jobs\/([^/]+)\/stream$/.exec(path)
  if (match === null || method !== 'GET') return null

  // `@PreAuthorize("isAuthenticated()")` — 스트림도 인증이 필요하다
  const memberId = memberIdOf(accessToken)
  if (memberId === null) return { kind: 'error', result: UNAUTHORIZED() }

  const jobId = match[1] ?? ''
  const job = mockStore().aiPlanJobs.find((candidate) => candidate.jobId === jobId)

  // **타인의 jobId 도 404 다** — 폴링과 같은 규칙이고, 스트림 시작 전이라 JSON 으로 온다
  if (job === undefined || job.memberId !== memberId) {
    return {
      kind: 'error',
      result: fail(404, 'AIPLAN_002', '요청하신 AI 일정 생성 작업을 찾을 수 없습니다.'),
    }
  }

  /** **취소가 시나리오를 이긴다** — 종결은 되돌아가지 않는다 (#250) */
  const terminal: JobStatusCode = job.canceled
    ? 'CANCELED'
    : job.scenario === 'failed'
      ? 'FAILED'
      : 'COMPLETED'

  /*
    이미 종결된 작업이면 스냅샷 하나만 보내고 닫는다 — 백엔드도 `initial.status().isTerminal()`
    이면 한 번 보내고 `complete()` 한다. 새로고침으로 다시 구독하는 경우가 이 경로다.
  */
  if (statusOf(job) === terminal) {
    return {
      kind: 'stream',
      frames: [
        { delayMs: STREAM_SNAPSHOT_MS, event: JOB_STREAM_EVENT, data: jobBody(job, terminal) },
      ],
    }
  }

  const snapshot = statusOf(job)
  job.pollCount = 2

  /*
    **단계마다 프레임을 하나씩 낸다** (#250). 백엔드가 단계 경계에서 pub/sub 이벤트를
    올리므로 잡당 2회였던 것이 6회가 됐다 — 여기서 그 모양을 재현하지 않으면 `n / m 단계`
    표시가 로컬에서 한 번도 움직이지 않아 확인할 수가 없다.

    **스냅샷이 이미 `RUNNING` 이면 첫 단계를 다시 보내지 않는다** — 구독 전에 지나간
    단계다.
  */
  const stepFrames = STEPS.map((step, index) => ({
    delayMs: STREAM_STEP_MS * (index + 1),
    event: JOB_STREAM_EVENT,
    data: jobBody(job, 'RUNNING', step.code),
  })).slice(snapshot === 'PENDING' ? 0 : 1)

  return {
    kind: 'stream',
    frames: [
      { delayMs: STREAM_SNAPSHOT_MS, event: JOB_STREAM_EVENT, data: jobBody(job, snapshot) },
      ...stepFrames,
      { delayMs: STREAM_TERMINAL_MS, event: JOB_STREAM_EVENT, data: jobBody(job, terminal) },
    ],
  }
}

/**
 * 반려견 여행 준비물 (#155).
 *
 * **실패 코드가 하나다.** 일정이 없거나 본인 소유가 아니면 둘 다 `AIPLAN_016` 이다 —
 * 남의 일정을 가리켜도 "없다" 고 답하는 쪽이라 mock 도 두 경우를 구분하지 않는다.
 *
 * **수십 초 지연은 흉내 내지 않는다.** mock 에 인위적 지연을 넣으면 로컬에서 모든 작업이
 * 느려지고, 대기 화면은 `isPending` 으로 이미 확인할 수 있다. 그 사실을 여기 적어 둔다 —
 * 로컬이 빠르다고 실제도 빠르다고 오해하면 안 된다.
 */
function packingList(memberId: string, rawPlanId: string): MockResult {
  const store = mockStore()
  const plan = store.plans.find(
    (candidate) =>
      candidate.planId === rawPlanId && candidate.memberId === memberId && !candidate.deleted,
  )
  if (plan === undefined) {
    return fail(400, 'AIPLAN_016', '일정 개요를 가져오지 못해 준비물을 만들 수 없습니다.')
  }

  /*
    분류는 enum 이 아니라 서버가 주는 문자열이다. 문구는 백엔드 `PackingListResponse` 의
    example 과 프롬프트 분류를 따른다 — 창작하지 않는다.

    **이유(reason)가 이 기능의 핵심이다.** 일반적인 준비물 목록이 아니라 이 여행의 예보·
    일정·반려견에 근거해야 하므로, mock 도 일정 제목과 날짜를 문장에 넣어 그 성격을 지킨다.
  */
  const items = [
    {
      category: '필수',
      name: '반려동물 등록증',
      reason: '동반 입장 시 확인을 요구하는 시설이 있어 챙기는 편이 안전합니다.',
    },
    {
      category: '필수',
      name: '리드줄과 배변봉투',
      reason: `${plan.title} 일정에 야외 장소가 포함돼 이동 중 계속 필요합니다.`,
    },
    {
      category: '날씨 대비',
      name: '휴대용 우비',
      reason: '2일차 강수확률 80% 예보라 야외 일정 중 비를 만날 수 있습니다.',
    },
    {
      category: '날씨 대비',
      name: '아이스팩과 쿨매트',
      reason: '여행 기간 최고기온이 31도까지 올라 이동 중 체온 관리가 필요합니다.',
    },
    {
      category: '반려견 케어',
      name: '평소 먹던 사료',
      reason: '여행 중 사료를 바꾸면 배탈이 나기 쉬워 쓰던 것을 그대로 챙깁니다.',
    },
    {
      category: '반려견 케어',
      name: '발 세정용 물티슈',
      reason: '해안 산책로가 일정에 있어 모래와 염분을 닦아 낼 것이 필요합니다.',
    },
    {
      category: '이동',
      name: '이동장 또는 카시트',
      reason: `${plan.startDate} 출발부터 장소 간 이동이 이어져 차 안에서 고정이 필요합니다.`,
    },
    {
      category: '이동',
      name: '접이식 물그릇',
      reason: '이동 사이 급수 지점이 일정한 간격으로 없어 직접 챙기는 편이 낫습니다.',
    },
  ]

  // 이 파일의 `ok()` 는 MockResult 를 통째로 만든다 — plan-data.ts 의 것과 시그니처가 다르다
  return ok({ planId: plan.planId, items, totalCount: items.length })
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
    **반려견은 선택이다** — `@Positive` 만 걸려 있고 `@NotNull` 이 없다 (PR #78).
    값이 없으면 워커가 대표 반려견으로 대신한다. FE 는 정밀도 때문에 문자열로 실어
    보내므로 문자열·숫자 양쪽을 받는다.

    **`petIds` 가 `petId` 를 이긴다** — 서버 `effectivePetIds()` 의 우선순위다 (#128).
    mock 이 이 순서를 지켜야 FE 의 "한 마리여도 배열로 보낸다" 판단이 검증된다.
  */
  const petId = asIdString(parsed.petId)
  if (petId !== null && !/^[1-9]\d*$/.test(petId)) {
    errors.push({ code: 'AIPLAN_105', field: 'petId', message: '반려견 식별자는 양수여야 합니다.' })
  }

  const rawPetIds: unknown[] | null = Array.isArray(parsed.petIds)
    ? (parsed.petIds as unknown[])
    : null
  if (rawPetIds !== null) {
    if (rawPetIds.length > PET_MAX) {
      errors.push({
        code: 'AIPLAN_105',
        field: 'petIds',
        message: `반려견은 ${PET_MAX}마리 이하만 가능합니다.`,
      })
    }
    const badPetId = rawPetIds.find((raw) => {
      const id = asIdString(raw)
      return id === null || !/^[1-9]\d*$/.test(id)
    })
    if (badPetId !== undefined) {
      errors.push({
        code: 'AIPLAN_105',
        field: 'petIds',
        message: '반려견 식별자는 양수여야 합니다.',
      })
    }
  }

  const petIds =
    rawPetIds !== null && rawPetIds.length > 0
      ? rawPetIds.map((raw) => asIdString(raw) ?? '')
      : petId === null
        ? []
        : [petId]

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

  /*
    하루 재생성 (#128). `regenerateDay` 자체의 `@Positive` 는 다른 필드들과 같은 Bean
    Validation 배치다 — `AiPlanValidationMessage.REGENERATE_DAY_POSITIVE` =
    `AIPLAN_112:재생성할 일차는 양수여야 합니다.` (`AiPlanCreateRequest.regenerateDay:65-67`).
    **짝 규칙과 범위 검사는 다르다** — `AiPlanJobProcessor:187-197` 가 이 배치를 통과한
    요청에만 수행하는 서비스 계층 교차 검증이라, 아래 `errors.length` 판정 뒤에 따로 둔다.
  */
  const regeneratePlanId = asIdString(parsed.planId)
  const regenerateDay = typeof parsed.regenerateDay === 'number' ? parsed.regenerateDay : null

  if (regenerateDay !== null && regenerateDay < 1) {
    errors.push({
      code: 'AIPLAN_112',
      field: 'regenerateDay',
      message: '재생성할 일차는 양수여야 합니다.',
    })
  }

  if (errors.length > 0) return failValidation(errors)

  /*
    **날짜 역전은 필드 오류가 아니라 도메인 예외다** — `AIPLAN_001` 400 이고 Bean
    Validation 응답 형태가 아니다 (`plan-data.ts` 의 `PLAN_003` 과 같은 판단).
  */
  if (startDate > endDate) {
    return fail(400, 'AIPLAN_001', '여행 시작일은 종료일보다 늦을 수 없습니다.')
  }

  /*
    **재생성이 조용히 물려받는 두 전제다** (#128). `AiPlanJobProcessor:55-62` 가
    `validateRegenerateRequest` **앞에서** 본다 — 재생성 요청도 예외가 아니고, 제출 본문이
    저장된 일정의 기간을 그대로 싣기 때문에 **이미 시작한 여행과 11일 이상 일정은 재생성이
    영원히 막힌다.** mock 이 이 둘을 모르면 화면이 진입점을 감추지 않는 회귀가 로컬에서
    통과한다 (`dayRegenerateBlock` 이 화면 쪽 짝이다).

    `LocalDate.now()` 를 흉내 낸다 — mock 에 시계를 두는 유일한 지점이고, 서버가 제출에서
    시계를 보는 지점도 여기 하나다.
  */
  if (isStartDateInPast(startDate)) {
    return fail(400, 'AIPLAN_017', '여행 시작일은 오늘 이후여야 합니다.')
  }

  /*
    **일수는 이 요청 자체의 기간으로 센다** — 서버가 제출 시점에 plan 을 조회하지 않고
    `ChronoUnit.DAYS.between(startDate, endDate) + 1` 로 계산한다. `AIPLAN_015` 도 같은
    값을 쓴다. **plan-service 상한은 30일이라**(`PlanCommandProcessor:32`) 11~30일 일정은
    저장은 되지만 AI 로 다시 만들 수 없다.
  */
  const dayCount = tripDays(startDate, endDate)

  if (dayCount > MAX_TRIP_DAYS) {
    return fail(400, 'AIPLAN_018', 'AI 일정 생성은 최대 10일까지 지원합니다.')
  }

  /*
    **둘은 짝이다.** 실제 서비스는 `AiPlanException` 을 던지고
    `AiPlanExceptionHandler.handleAiPlanException` 이 평평한 바디
    (`resultCode: 'AIPLAN_014'`, 문자열 message)로 응답한다 — Bean Validation 배치
    (`AIPLAN_100`/`errors[]`)가 아니다. 날짜 역전(`AIPLAN_001`)과 같은 형태를 쓴다.
  */
  if ((regeneratePlanId === null) !== (regenerateDay === null)) {
    return fail(400, 'AIPLAN_014', '하루 재생성에는 일정 식별자와 재생성할 일차가 함께 필요합니다.')
  }

  /*
    `REGENERATE_DAY_OUT_OF_RANGE`(`AIPLAN_015`, `AiPlanJobProcessor:193-196`). 존재하지
    않거나 남의 plan 인 경우(`PLAN_OUTLINE_UNAVAILABLE` = `AIPLAN_016`)는 `AiPlanWorker` 가
    비동기로 던지는 예외라 이 계약에서는 HTTP 200 + `status=FAILED` 로 오고, 화면은 항상
    본인 plan 으로만 접근하므로 여기서 모델링하지 않는다.

    **문구는 백엔드를 그대로 인용한다** — 화면이 서버 문자열을 그대로 그리므로
    (`RegenerateSubmit`) mock 이 다른 말을 하면 로컬에서 본 문장이 배포에서 달라진다.
  */
  if (regeneratePlanId !== null && regenerateDay !== null && regenerateDay > dayCount) {
    return fail(400, 'AIPLAN_015', '재생성할 일차가 여행 기간을 벗어났습니다.')
  }

  const store = mockStore()

  /*
    **멱등하다.** 같은 회원의 같은 조건이 진행 중이면 기존 jobId 를 그대로 준다
    (컨트롤러 설명). 완료된 작업은 대상이 아니다 — 다시 만들기가 막히면 안 된다.

    **`planId`·`regenerateDay` 도 조건이다** (#128). 실제 멱등 키는 `toParams` 를 해시한
    것이고 그 map 에 두 값이 들어 있다 (`AiPlanJobProcessor:167-179`). 빠뜨리면 1일차
    재생성(또는 같은 기간의 새 일정 생성)이 진행 중일 때 2일차 제출이 **그 작업의 jobId**
    를 받아, 비교 화면이 2일차가 그대로인 초안을 보여 준다.
  */
  const existing = store.aiPlanJobs.find(
    (job) =>
      job.memberId === memberId &&
      job.petIds.join(',') === petIds.join(',') &&
      job.startDate === startDate &&
      job.endDate === endDate &&
      job.budget === budget &&
      job.regeneratePlanId === regeneratePlanId &&
      job.regenerateDay === regenerateDay &&
      /*
        **돌고 있는 작업만 되돌려준다.** 완료·실패는 물론이고 **취소도 대상이 아니다**
        (#250) — 백엔드가 취소하면서 멱등 키를 함께 풀어 주기 때문이고, 그러지 않으면
        "같은 조건으로 다시 만들기" 가 방금 취소한 잡을 그대로 되받는다.
      */
      isInFlight(statusOf(job)),
  )
  if (existing !== undefined) {
    return ok<AiPlanSubmitResult>({ submissionStatus: SUBMITTED, jobId: existing.jobId }, 202)
  }

  const job: MockAiPlanJob = {
    jobId: nextAiPlanJobId(store),
    memberId,
    scenario: scenarioOf(requestNote),
    petIds,
    areaCode,
    startDate,
    endDate,
    budget,
    requestNote,
    pollCount: 0,
    canceled: false,
    canceledAtStep: null,
    regeneratePlanId,
    regenerateDay,
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

  return ok<AiPlanJob>(jobBody(job, status))
}

/**
 * 상태 하나에 해당하는 작업 조회 본문.
 *
 * **폴링과 SSE 가 같은 본문을 쓴다.** 백엔드도 같은 `AiPlanPresenter.toJobStatusResponse`
 * 를 두 경로에 쓰고, SSE 이벤트 `data` 는 조회 응답의 `dataBody` 와 동일한 JSON 이다
 * (컨트롤러 설명). mock 이 두 경로를 다르게 만들면 그 사실이 깨진다.
 */
function jobBody(
  job: MockAiPlanJob,
  status: JobStatusCode,
  /** 단계를 직접 지정한다 — 스트림이 `RUNNING` 안에서 단계를 옮길 때 쓴다 (#250) */
  stepCode: string | null = stepCodeOf(job, status),
): AiPlanJob {
  /*
    **단계는 상태와 함께 움직인다** (#250). `PENDING` 이면 `step`·`stepOrder` 가 **null** 이고,
    종결 상태에는 마지막으로 밟은 단계가 남는다. `totalSteps` 는 언제나 실린다 —
    `int` 라 nullable 이 아니다.
  */
  const step = stepOf(stepCode)
  const stepIndex = step === null ? -1 : STEPS.indexOf(step)
  const steps = {
    step,
    stepOrder: stepIndex < 0 ? null : stepIndex + 1,
    totalSteps: TOTAL_STEPS,
  }

  if (status === 'FAILED') {
    return {
      jobId: job.jobId,
      status: STATUS.FAILED as CodeNameMetadata,
      ...steps,
      planDraft: null,
      // AIPLAN_012 — 실패 이유가 조건 문제일 수 있다는 것을 화면이 다뤄야 한다
      errorCode: 'AIPLAN_012',
      errorMessage: '여행 일정에 넣을 반려견 동반 가능 장소를 찾지 못했습니다.',
    }
  }

  if (status !== 'COMPLETED') {
    return {
      jobId: job.jobId,
      status: STATUS[status] as CodeNameMetadata,
      ...steps,
      planDraft: null,
      /*
        **취소도 여기로 온다 — `errorCode` 를 채우지 않는다.** 채우면 화면이
        "실패했습니다" 를 띄우고, 실패와 취소를 가른 이 계약의 요점이 무너진다.
      */
      errorCode: null,
      errorMessage: null,
    }
  }

  return {
    jobId: job.jobId,
    status: STATUS.COMPLETED as CodeNameMetadata,
    ...steps,
    planDraft: draftFor(job),
    errorCode: null,
    errorMessage: null,
  }
}

/**
 * 조회 횟수 → 상태.
 *
 * 0회: `PENDING` / 1회: `RUNNING` / 2회 이상: 시나리오에 따라 `COMPLETED` 또는 `FAILED`.
 * **완료·실패에 닿으면 그 상태에 머문다** — 화면이 폴링을 멈춘 뒤 새로고침해도 같은
 * 결과를 봐야 한다.
 *
 * **취소가 조회 횟수를 이긴다** (#250). 취소는 종결이고 종결은 되돌아가지 않는다 —
 * `pollCount` 를 보고 판정하면 취소한 작업이 다음 조회에서 완료로 살아난다.
 */
function statusOf(job: MockAiPlanJob): JobStatusCode {
  if (job.canceled) return 'CANCELED'
  if (job.pollCount === 0) return 'PENDING'
  if (job.pollCount === 1) return 'RUNNING'
  return job.scenario === 'failed' ? 'FAILED' : 'COMPLETED'
}

/** 아직 돌고 있는가 — 백엔드 `AiPlanJobStatus.isInFlight()` 복제본. 멱등 술어가 쓴다 */
function isInFlight(status: JobStatusCode): boolean {
  return status === 'PENDING' || status === 'RUNNING'
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

  const days: AiPlanDayItem[] = Array.from({ length: made }, (_, index) => {
    const day = index + 1
    const items = itemsFor(index, job.scenario === 'delisted' && index === 0)
    return {
      day,
      items: job.regenerateDay === day ? regeneratedDayItems() : items,
    }
  })

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

/**
 * 재생성 대상 일자의 항목. **다른 날과 눈에 띄게 달라야 한다** — 비교 화면
 * (하루재생성-세부명세 R5)이 "무엇이 바뀌는지" 를 보여 주는 것이 요점이라, mock 이
 * 같은 항목을 주면 그 화면을 로컬에서 확인할 수 없다.
 */
function regeneratedDayItems(): AiPlanScheduleItem[] {
  return [
    {
      itemType: 'PLACE',
      placeId: MOCK_PLACES[2]?.placeId ?? null,
      title: '오설록 티뮤지엄 카페',
      note: '실내라 비가 와도 괜찮아요',
    },
    {
      itemType: 'WALK',
      placeId: MOCK_PLACES[1]?.placeId ?? null,
      title: '사려니숲길 산책',
      note: '그늘이 많아요',
    },
  ]
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
