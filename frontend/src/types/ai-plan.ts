import type { CodeNameMetadata } from '@/types/api'

/**
 * AI 일정 생성 — 요청·응답 타입.
 *
 * 근거: backend ai-service **소스 실측** — `AiPlanWebController` · `AiPlanCreateRequest` ·
 * `AiPlanSubmitResponse` · `AiPlanJobStatusResponse` · `AiPlanDraftResponse` ·
 * `AiPlanDayItem` · `AiPlanScheduleItem` · `AiPlanErrorCode` · `AiPlanValidationMessage`
 * (`origin/develop` `af86c98`, 2026-08-31). 계약 상세는 docs/features/ai-plan/공통명세.md.
 *
 * **명세 S1 표보다 최신이다.** 명세는 `8e44ddc` 기준이고 그 뒤 PR #78 이
 * `AiPlanCreateRequest` 에 `petIds` · `pinnedPlaceIds` · `planId` · `regenerateDay` 를
 * 추가하면서 `petId` 를 선택으로 내렸다. 이 화면은 **단일 `petId` 만 보낸다** — 새 필드는
 * 전부 선택이라 이 본문이 지금도 유효하고, 다중 반려견·필수 포함 장소는 아트보드 정본이
 * 없어 별도 이슈로 뗀다.
 */

/**
 * `POST /ai-plans` 요청 본문.
 *
 * - **`petId` 를 숫자로 바꾸지 않는다.** 서버는 `Long` 으로 읽지만 Snowflake 라
 *   `Number()` 를 거치면 정밀도를 잃는다. 문자열 그대로 실어 보내면 Jackson 이 읽는다
 *   (plan 공통명세 S1)
 * - **`budget` 은 `@Positive` 다.** 일정 생성(`@PositiveOrZero`)과 다르다 — `0` 을 보내면
 *   `AIPLAN_106` 400 이다. "상관없음" 은 `0` 이 아니라 **키 생략**으로 표현한다
 * - **`sigunguCode` 가 없다.** 지역을 제주시/서귀포시로 좁힐 수 없어 화면에 지역 컨트롤을
 *   두지 않는다 (명세 S2)
 */
export type AiPlanSubmitPayload = {
  areaCode: string
  /** `YYYY-MM-DD` */
  startDate: string
  /** `YYYY-MM-DD` */
  endDate: string
  petId: string
  /** 원 단위. 생략 가능하고 **0 은 보낼 수 없다** */
  budget?: number
  /** 500자 이하. 빈 값이면 생략한다 */
  requestNote?: string
}

/** `POST /ai-plans` → **HTTP 202**. 같은 요청이 진행 중이면 기존 `jobId` 를 그대로 준다(멱등) */
export type AiPlanSubmitResult = {
  submissionStatus: CodeNameMetadata
  jobId: string
}

/** 백엔드 `AiPlanJobStatus` — 넷뿐이다. **세부 단계가 계약에 없다** (명세 S2) */
export const AI_PLAN_JOB_STATUSES = ['PENDING', 'RUNNING', 'COMPLETED', 'FAILED'] as const
export type AiPlanJobStatusCode = (typeof AI_PLAN_JOB_STATUSES)[number]

/**
 * 초안의 개별 항목.
 *
 * **`itemType` 은 문자열이지 metadata 객체가 아니다** (`AiPlanScheduleItem.itemType`).
 * 다른 도메인의 enum 과 달리 `name`/`description` 이 없어 화면이 표시명을 만들어야 한다.
 */
export type AiPlanScheduleItem = {
  /** `PLACE` | `MEAL` | `LODGING` | `WALK` | `MOVE` */
  itemType: string
  /** 이동 항목이거나 검증된 장소가 아니면 null */
  placeId: string | null
  title: string
  note: string
}

export type AiPlanDayItem = {
  /** 1부터 */
  day: number
  items: AiPlanScheduleItem[]
}

export type AiPlanReasonItem = {
  code: string
  name: string
  description: string
}

/** 초안. **일정 전체에 대한 XAI(`reasons`)라 일자별이 아니다** (명세 S6) */
export type AiPlanDraft = {
  days: AiPlanDayItem[]
  reasons: AiPlanReasonItem[]
}

/**
 * `GET /ai-plans/jobs/{jobId}`.
 *
 * **작업 실패는 HTTP 5xx 가 아니라 200 + `status.code === 'FAILED'`** 다
 * (api-integration-guide.md §5). `dataHeader.success` 만 보면 실패를 놓친다.
 */
export type AiPlanJob = {
  jobId: string
  status: CodeNameMetadata
  /** `COMPLETED` 일 때만 채워진다 */
  planDraft: AiPlanDraft | null
  /** `FAILED` 일 때만 채워진다 */
  errorCode: string | null
  errorMessage: string | null
}

/**
 * 조건 입력 폼 값. **요청 본문이 아니다** — `budget` 이 폼에서는 **만원 단위 문자열**이고
 * 전송 직전에 원 단위 숫자 또는 생략으로 바뀐다 (`src/lib/ai-plan/submit.ts`).
 *
 * **`areaCode` 필드가 없다.** 계약에 `sigunguCode` 가 없어 제주 전체 고정이고, 선택지가
 * 하나인 컨트롤을 폼에 두지 않는다 (plan 공통명세 S9 과 같은 규칙).
 */
export type AiPlanFormValues = {
  requestNote: string
  startDate: string
  endDate: string
  petId: string
  /** **만원 단위**다. 빈 값 = "상관없음" (아트보드 01 — 칩 + 직접 입력) */
  budgetManwon: string
}

export const EMPTY_AI_PLAN_FORM_VALUES: AiPlanFormValues = {
  requestNote: '',
  startDate: '',
  endDate: '',
  petId: '',
  budgetManwon: '',
}

/**
 * 제출한 조건. **`jobId` 를 키로 `sessionStorage` 에 보관한다** (명세 S5 함정 1 · S8 미결 2).
 *
 * 초안에는 `petId`·`areaCode`·기간·예산이 없는데 담기(`POST /plans`)에는 필요하고,
 * 작업 조회 응답에도 요청 조건이 없어 **`jobId` 로 되살릴 수 없다.** 없으면 담기를 막는다
 * — 다른 기기에서 같은 URL 을 열면 실제로 없다.
 */
export type AiPlanRequestSnapshot = {
  areaCode: string
  startDate: string
  endDate: string
  petId: string
  petName: string
  budget: number | null
  requestNote: string
}
