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
 * `AiPlanCreateRequest` 에 `petIds` · `pinnedPlaceIds` · `preferFavorites` · `planId` ·
 * `regenerateDay` 를 추가하면서 `petId` 를 선택으로 내렸다.
 *
 * #128 로 **`preferFavorites`·`pinnedPlaceIds`·`petIds`** 를 붙였다.
 *
 * **`petIds` 로 만든 초안도 담기는 한 마리에 붙는다.** `plan-service` 의 `Plan` 은
 * `petId` **단일**이라 저장 직전에 판정 기준이 될 한 마리를 사람이 고른다
 * (다견선택-세부명세 D4). `PlanCreateRequest` 의 다견화는 BE 선행이라 범위 밖이다.
 *
 * 아직 보내지 않는 것:
 *  - **`planId`·`regenerateDay`** — 아트보드 03 은 **저장 전 미리보기**에서 하루 재생성을
 *    하는데 계약은 `planId`(이미 저장된 일정)를 요구한다. 계약과 정본이 어긋나 있다 (#90)
 */

/**
 * `POST /ai-plans` 요청 본문.
 *
 * - **`petIds` 를 숫자로 바꾸지 않는다.** 서버는 `Long` 으로 읽지만 Snowflake 라
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
  /**
   * 동반 반려견. **한 마리여도 배열이다** (#128 · 명세 D2-2).
   *
   * 서버가 `petIds` 를 `petId` 보다 우선하므로(`effectivePetIds()`) 결과가 같고,
   * 두 경로를 남기면 제출·스냅샷·복원 세 곳에 각각 분기가 생긴다.
   */
  petIds: string[]
  /** 원 단위. 생략 가능하고 **0 은 보낼 수 없다** */
  budget?: number
  /** 500자 이하. 빈 값이면 생략한다 */
  requestNote?: string
  /**
   * 저장한 장소를 후보에 합치고 조건이 맞으면 먼저 배치한다 (#128, 아트보드 05).
   *
   * **`false` 는 보내지 않는다.** 서버 기본이 `false` 이고
   * (`Boolean.TRUE.equals(preferFavorites)`), 끄기를 명시적으로 실어 보낼 이유가 없다.
   */
  preferFavorites?: boolean
  /**
   * 꼭 넣을 장소. **최대 10곳**이고 서버가 반드시 배치한다.
   *
   * **`preferFavorites` 와 다른 약속이다** — 저쪽은 우선순위(조건이 맞을 때만),
   * 이쪽은 배치 보장이다. 아트보드 05 가 "먼저 / 꼭" 으로 문구를 갈라 쓰라고 못박았다.
   *
   * `placeId` 는 문자열 그대로 보낸다 — Snowflake 라 `Number()` 를 거치면 정밀도를 잃는다.
   */
  pinnedPlaceIds?: string[]
  /**
   * 하루 재생성 대상 일정 (#128 · 하루재생성-세부명세 R3).
   *
   * **`regenerateDay` 와 반드시 짝이다** — 하나만 오면 서버가 막는다
   * (`AiPlanJobProcessor:191`). 새 일정을 만드는 경로(`/ai-plans/new`)는 둘 다
   * 보내지 않는다.
   *
   * Snowflake 라 **문자열 그대로 보낸다** — `Number()` 를 거치면 정밀도를 잃는다.
   */
  planId?: string
  /** 다시 구성할 일차, **1부터**. `planId` 와 반드시 짝이다 (`@Positive`) */
  regenerateDay?: number
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
  /**
   * **nullable 이다.** DTO 에 제약이 없고 `AiPlanPresenter.toScheduleItems` 가 리스트만
   * `List.of()` 로 방어한 뒤 `title`/`note` 는 그대로 통과시킨다. `ai-llm.enabled=true`
   * 면 `OllamaLlmAdapter.toDomain` 이 모델 산출물을 그대로 싣는다 — **`.trim()` 을
   * 바로 부르면 결과 화면 전체가 죽는다.**
   */
  title: string | null
  note: string | null
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
 * `GET /ai-plans/jobs/{jobId}` · `POST /ai-plans/jobs/{jobId}/cancel`.
 *
 * **작업 실패는 HTTP 5xx 가 아니라 200 + `status.code === 'FAILED'`** 다
 * (api-integration-guide.md §5). `dataHeader.success` 만 보면 실패를 놓친다.
 *
 * **취소 응답도 같은 모양이다** — 컨트롤러가 `AiPlanJobStatusResponse` 를 그대로 돌려주므로
 * 화면은 그것을 작업 캐시에 바로 쓴다.
 */
export type AiPlanJob = {
  jobId: string
  /** `PENDING` | `RUNNING` | `COMPLETED` | `FAILED` | **`CANCELED`** (#250) */
  status: CodeNameMetadata
  /**
   * 지금 밟고 있는 세부 단계 (#250 · 백엔드 `AiPlanJobStep`).
   * `CONDITIONS` 조건 확인 · `CANDIDATES` 후보 장소 수집 · `WEATHER` 날씨 전망 반영 ·
   * `DRAFTING` 일정 구성.
   *
   * **`PENDING` 이면 null 이다** — 아직 시작하지 않았다는 뜻이라 0 이나 1 로 그리면
   * 화면이 시작한 것으로 거짓말을 한다. 종결 상태에서는 **마지막으로 밟은 단계**가
   * 남는다 (실패 지점이 곧 진단이다).
   */
  step: CodeNameMetadata | null
  /** 몇 번째 단계인지, **1부터**. `PENDING` 이면 null */
  stepOrder: number | null
  /**
   * 전체 단계 수. 화면의 `n / m 단계` 에서 m 이다.
   *
   * **화면이 상수로 적지 않는다.** 백엔드가 값의 개수에서 파생시키므로 단계가 늘면 이
   * 값도 함께 는다 — 복제해 두면 `5 / 4 단계` 가 나간다.
   */
  totalSteps: number
  /** `COMPLETED` 일 때만 채워진다 */
  planDraft: AiPlanDraft | null
  /**
   * `FAILED` 일 때만 채워진다.
   *
   * **취소는 실패가 아니라 비어 있다** — 채우면 화면이 "실패했습니다" 를 띄우고 지표에서도
   * 장애와 섞인다(백엔드 판단). `CANCELED` 를 실패로 다루면 안 되는 이유다.
   */
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
  petIds: string[]
  /** **만원 단위**다. 빈 값 = "상관없음" (아트보드 01 — 칩 + 직접 입력) */
  budgetManwon: string
  /** 저장한 곳 먼저 넣기 (#128, 아트보드 05) */
  preferFavorites: boolean
  /**
   * 꼭 넣을 장소. **`placeId` 만 두지 않고 이름을 함께 든다** — 칩에 이름을 그려야 하고,
   * 시트를 닫은 뒤 이름을 다시 조회하면 폼이 네트워크에 의존하게 된다.
   */
  pinnedPlaces: PinnedPlace[]
}

/** 폼이 들고 있는 "꼭 넣을 장소" 한 곳. 계약으로 나갈 때는 `placeId` 만 실린다 */
export type PinnedPlace = {
  placeId: string
  title: string
}

export const EMPTY_AI_PLAN_FORM_VALUES: AiPlanFormValues = {
  requestNote: '',
  startDate: '',
  endDate: '',
  petIds: [],
  budgetManwon: '',
  preferFavorites: false,
  pinnedPlaces: [],
}

/**
 * 제출한 조건. **`jobId` 를 키로 `sessionStorage` 에 보관한다** (명세 S5 함정 1 · S8 미결 2).
 *
 * 초안에는 반려견·`areaCode`·기간·예산이 없는데 담기(`POST /plans`)에는 필요하고,
 * 작업 조회 응답에도 요청 조건이 없어 **`jobId` 로 되살릴 수 없다.** 없으면 담기를 막는다
 * — 다른 기기에서 같은 URL 을 열면 실제로 없다.
 */
export type AiPlanRequestSnapshot = {
  areaCode: string
  startDate: string
  endDate: string
  /**
   * 동반 반려견. **담기에 이 순서 그대로 전부 실린다** (#152 · #174) —
   * `PlanCreateRequest.petIds` 가 받고 **첫 번째가 대표 반려견**이 된다.
   *
   * 예전에는 저장이 한 마리라 담기 패널에서 기준을 골랐다 (다견선택-세부명세 D4).
   *
   * `name` 은 일정 제목 기본값에만 쓰인다. 비어 있어도 흐름이 막히지 않는다.
   */
  pets: {
    petId: string
    name: string
  }[]
  budget: number | null
  requestNote: string
  /**
   * #128 로 더한 두 조건. **담기에는 쓰이지 않는다** — `POST /plans` 에 해당 필드가 없다.
   * 실패 화면의 `조건 바꾸기` 가 폼을 되살릴 때 이 둘도 살아나야 해서 함께 보관한다
   * (아트보드 02 ②: "입력한 조건은 그대로 남아 있어요").
   *
   * **선택 필드로 둔다.** 앞 형식으로 저장된 값이 열어 둔 탭에 남아 있을 수 있고,
   * 모양 검사가 없는 필드로 흘러들면 `readAiPlanRequest` 가 통째로 null 을 준다.
   */
  preferFavorites?: boolean
  pinnedPlaces?: PinnedPlace[]
}

// ─── 반려견 여행 준비물 (#155) ────────────────────────────────────────────────

/**
 * 준비물 한 항목.
 *
 * **`reason` 이 이 기능의 핵심이다** (XAI). 서버가 이 여행의 예보·반려견 특성·일정에
 * 근거한 완성 문장을 준다 — "2일차 강수확률 80% 예보라 야외 일정 중 비를 만날 수
 * 있습니다." FE 가 문장을 조립하지 않는다 (styling-guide.md §7).
 */
export type PackingListItem = {
  /** 분류. **enum 이 아니라 문자열이다** — 서버가 "필수"·"날씨 대비"·"반려견 케어"·"이동" 을
   * 그대로 주고, 모르는 분류가 와도 화면이 버리지 않는다 */
  category: string
  name: string
  reason: string
}

/**
 * `POST /ai-plans/packing-list/{planId}` 응답.
 *
 * **저장되지 않는 제안이다.** 서버가 결과를 보관하지 않으므로 새로고침하면 사라진다 —
 * 화면이 그 사실을 밝혀야 저장된 것으로 오해하고 나중에 다시 열어 보려다 잃지 않는다.
 *
 * **동기 API 이고 수십 초가 걸릴 수 있다.** AI 일정 생성(202 + 폴링)과 다르다 — 출력이
 * 짧아(8~15개) 잡을 두지 않았다.
 */
export type PackingListResult = {
  planId: string
  items: PackingListItem[]
  totalCount: number
}
