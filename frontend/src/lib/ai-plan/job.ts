/**
 * AI 일정 생성 작업 상태 판정 — 명세 S4(폴링) · S7(상태 화면).
 *
 * 근거: backend ai-service `AiPlanJobStatus` · `AiPlanJobStep` · `AiPlanJobStatusResponse`
 * **소스 실측**. 상태는 `PENDING`·`RUNNING`·`COMPLETED`·`FAILED`·**`CANCELED`** 다섯이고,
 * 세부 단계는 **서버가 내려 준다**(#250 · PR #246) — 넷 중 지금 밟는 것과 `n / m` 이 온다.
 * **화면이 단계를 지어내지 않는다는 규칙은 그대로다**: 서버가 준 값만 그린다 (명세 S2).
 *
 * 작업 타입 정본은 `src/types/ai-plan.ts` 다. 여기서는 판정만 한다.
 */

/**
 * 판정에 필요한 최소 모양.
 *
 * 실제 응답의 `status` 는 항상 metadata 객체지만 **문자열도 받는다** — SSE 이벤트나 mock 이
 * 코드만 실어 보내도 판정이 깨지지 않아야 한다.
 */
type StatusLike =
  string | { code: string; name?: string; description?: string | null } | null | undefined
type JobLike = { status: StatusLike }

/** status 가 문자열이든 metadata 객체든 코드 문자열을 꺼낸다 */
export function statusCodeOf(status: StatusLike): string | null {
  if (status === null || status === undefined) return null
  if (typeof status === 'string') return status
  return status.code
}

/**
 * 작업이 실패했는가.
 *
 * 백엔드는 작업 실패를 HTTP 5xx 가 아니라 **HTTP 200 + `status=FAILED`** 로 응답한다
 * (api-integration-guide.md §5). `dataHeader.success` 만 보면 실패를 놓친다.
 */
export function isJobFailed(job: JobLike | null | undefined): boolean {
  return statusCodeOf(job?.status) === 'FAILED'
}

export function isJobCompleted(job: JobLike | null | undefined): boolean {
  return statusCodeOf(job?.status) === 'COMPLETED'
}

/**
 * 작업이 취소됐는가 (#250).
 *
 * **실패와 갈라서 판정한다.** 취소는 `errorCode` 를 비운 채로 오므로 실패 화면에 태우면
 * 사유 없는 "일정을 만들지 못했어요" 가 뜬다 — 사용자가 스스로 그만둔 것이지 장애가
 * 아니다.
 */
export function isJobCanceled(job: JobLike | null | undefined): boolean {
  return statusCodeOf(job?.status) === 'CANCELED'
}

/**
 * 폴링을 계속해야 하는가.
 * 완료·실패·**취소**에서 반드시 멈춘다. 멈추지 않는 폴링이 대표 사고다.
 *
 * **`CANCELED` 를 빠뜨리면 취소한 작업을 폴링 상한까지 두드린다** — 서버는 이미 종결
 * 상태로 못 박고 SSE 도 닫았는데 화면만 진행 중으로 남는다 (#250).
 */
export function shouldKeepPolling(job: JobLike | null | undefined): boolean {
  if (job === null || job === undefined) return true
  return !isJobCompleted(job) && !isJobFailed(job) && !isJobCanceled(job)
}

/** 대기 화면이 그릴 세부 단계 — `n / m` 과 단계 metadata */
export type JobStepProgress = {
  order: number
  total: number
}

/**
 * `n / m 단계` 로 그릴 수 있는가 (#250).
 *
 * **없으면 null 이고, 화면은 그 자리를 비운다.** 세 가지가 다 null 을 낳는다:
 *  - `PENDING` — `stepOrder` 가 **null 이다.** 0 이나 1 로 채우면 시작한 것으로 그린다
 *  - 계약보다 앞선 배포 — 필드를 모르는 서버가 붙어 있으면 `undefined` 로 온다.
 *    SSE 프레임은 `parseJobEvent` 가 모양을 검사하지 않고 통과시키므로 **타입만 믿으면
 *    `NaN / undefined 단계` 가 화면에 나간다**
 *  - 값이 어긋남 — 순서가 전체보다 크면 그리지 않는다. `5 / 4 단계` 는 진행률이 아니라
 *    버그의 표시다
 */
export function jobStepProgress(
  job: { stepOrder?: number | null; totalSteps?: number | null } | null | undefined,
): JobStepProgress | null {
  const order = job?.stepOrder
  const total = job?.totalSteps

  if (typeof order !== 'number' || typeof total !== 'number') return null
  if (!Number.isInteger(order) || !Number.isInteger(total)) return null
  if (order < 1 || total < 1 || order > total) return null

  return { order, total }
}

/** 폴링 간격(ms) — 아트보드 02 */
export const JOB_POLL_INTERVAL_MS = 2000

/**
 * 구독 중에도 남겨 두는 확인 주기(ms).
 *
 * **구독의 생존을 클라이언트가 관측할 수 없다.** 백엔드의 25초 하트비트는 SSE 코멘트
 * 프레임이라 `addEventListener` 로 오지 않고, 데이터 이벤트는 상태가 바뀔 때만 와서
 * "조용한 것" 과 "끊긴 것" 이 구분되지 않는다. 중간 프록시가 조용히 끊으면
 * `EventSource` 가 반열림으로 남아 `onerror` 가 늦게 오거나 오지 않는다.
 *
 * 그때 폴링을 완전히 끊어 두면 **폴링 상한까지 화면이 멈춘다.** 이 주기가 그 구멍을
 * 30초로 좁힌다 — 구독이 정상이면 요청 몇 번이다.
 *
 * **#495 로 이 안전망의 몸값이 올랐다.** 상한이 90초에서 330초가 되어 반열림 연결이
 * 방치될 수 있는 구간도 3.7배가 됐다 — 그만큼 이 주기를 지우거나 늘릴 이유가 줄었다.
 */
export const JOB_STREAM_SAFETY_POLL_MS = 30_000

/**
 * 안내를 덧붙이는 시점(ms). 이 전에는 아무 말도 하지 않는다 — 정상 소요 시간이다.
 *
 * **30초는 정상 경로를 전부 붙잡았다** (#495). dev 실측이 52 · 60 · 80초라 가장 빠른
 * 실행조차 이 값을 넘겨, 아무 문제 없는 생성이 항상 "오래 걸림" 안내를 봤다. 안내가
 * 늘 뜨면 안내가 아니다.
 *
 * **90초인 이유는 BE `ai-llm.queue-wait-ms` 와 같은 값이기 때문이다.** 모델 호출 차례를
 * 기다리는 상한이 90초이므로(`ai-service/application.yml`), 여기를 넘겼다는 것은 한 턴이
 * 느린 것이 아니라 **내 잡이 게이트에서 줄을 섰다**는 뜻이다 — 그때가 정확히 기다려
 * 달라고 말해야 하는 시점이다. 한 턴만으로 90초를 넘기려면 실측 최악(80초)보다 느려야 한다.
 *
 * 소요 자체는 하드웨어가 정한다 — #489 는 iGPU 공유 메모리 + 같은 호스트의 Jenkins 라는
 * 구성에서 **60~70초가 정상**이고 CI 가 도는 동안은 그보다 느리다고 결론냈다.
 */
export const JOB_POLL_SLOW_MS = 90_000

/**
 * 폴링 상한(ms). 넘으면 멈추고 수동 확인을 준다 (명세 S8 미결 3).
 * **무제한이면 죽은 작업을 영원히 두드린다.**
 *
 * **서버가 판정을 내릴 때까지는 기다린다** (#495). 이전 값 90초는 "수십 초의 3배 여유"
 * 라고 적혀 있었지만, BE 가 실제로 쥐고 있는 예산은 그보다 훨씬 크다
 * (`ai-service/application.yml` 의 `ai-plan.job`):
 *
 * ```text
 * 잡 1건이 워커를 쥐는 벽시계 최악값
 *   = 게이트 대기 90 + 모델 호출 120 + 내부 조회(5초 x 최대 7회) 35 = 245초
 * pending/running-timeout-seconds: 300  ← BE 가 AIPLAN_006 을 내리는 시각
 * ```
 *
 * 90초는 그 예산의 0.3배라 **서버가 결론을 내기 한참 전에 화면이 먼저 손을 뗐다.**
 * 330초는 BE 상한 300초 + 판정·전파 여유 30초다. 서버가 `FAILED` 로 바꾸면
 * `shouldKeepPolling` 이 폴링을 자연 종료시키고 화면은 **이유가 적힌 실패 화면**을 띄운다 —
 * `AIPLAN_006 JOB_TIMEOUT`(504) 도 그렇게 도착한다.
 *
 * **다만 그 300초는 제출 시각부터의 총 예산이 아니다.** `expireIfStuck` 는 두 시계를
 * 따로 잰다 — `PENDING` 은 `createdAt`, `RUNNING` 은 `startedAt` 기준이고 각각 300초다
 * (`AiPlanJobProcessor.expireIfStuck`). 대기열에 선 잡은 `startedAt` 이 최대 245초 늦게
 * 찍히고 **거기서 300초를 새로 받으므로**, 제출 → 서버 판정까지 최악은 545초다.
 *
 * | 갈래 | 서버 판정 시각 | 330초 안에 받는가 |
 * |------|----------------|-------------------|
 * | 단독 실행 | 최악 300초 | **받는다** |
 * | 대기열에 선 잡 (동시 제출 2건째) | 최악 545초 | 못 받는다 |
 *
 * **못 받는 갈래를 알고도 330초에 둔다.** 그때 뜨는 것은 실패 화면이 아니라 수동 확인
 * 화면이고, 그 화면은 `jobExceededDescription` 으로 **"만들기는 계속되고 있어요"** 라고
 * 상황을 정확히 말한다 — 오작동이 아니라 설계된 인계다. 575초까지 올려 모든 갈래에서
 * 판정을 받아내는 안은, 9분 35초를 말없이 기다리게 하는 대가가 더 크다고 보고 접었다
 * (#495). 대기열에 섰다는 사실을 대기 화면이 먼저 말하게 하는 쪽이 진짜 해법이고,
 * 그것은 새 계약이라 별도 이슈다.
 *
 * BE 의 네 값(`queue-wait-ms` · `timeout-ms` · `pending/running-timeout-seconds` ·
 * `AsyncConfig` 대기열 길이)이 한 세트로 움직이므로, 그쪽이 바뀌면 이 값도 함께 본다.
 *
 * **대가 둘**: (1) 구독이 끊겨 2초 폴링으로 떨어진 갈래에서 최악 요청 수가 45 → 165 회가
 * 된다. 구독이 살아 있으면 `JOB_STREAM_SAFETY_POLL_MS`(30초) 주기라 11회다.
 * (2) 경과 시간 tick(`TICK_MS` 1초)에 매인 리렌더가 최악 90 → 330 회가 된다. `elapsedMs`
 * 는 훅 밖으로 나가지 않고 `JobPollPhase` 3값을 만드는 데만 쓰이므로 줄일 여지가 있지만,
 * 대기 화면 하나의 스켈레톤 리렌더라 지금 값을 감당하지 못할 이유가 없다.
 */
export const JOB_POLL_LIMIT_MS = 330_000

/** 대기 화면이 말해야 하는 국면 — 명세 S7 */
export type JobPollPhase = 'normal' | 'slow' | 'exceeded'

export function jobPollPhase(elapsedMs: number): JobPollPhase {
  if (elapsedMs >= JOB_POLL_LIMIT_MS) return 'exceeded'
  if (elapsedMs >= JOB_POLL_SLOW_MS) return 'slow'
  return 'normal'
}

/**
 * 폴링 간격. 멈춰야 하면 false — React Query `refetchInterval` 에 그대로 넘긴다.
 *
 * **상한을 넘기면 진행 중이어도 멈춘다.** `elapsedMs` 를 생략하면 상한을 보지 않는다
 * (상한 판단이 필요 없는 호출부를 위해 남겨 둔다).
 */
export function jobPollInterval(
  job: JobLike | null | undefined,
  elapsedMs?: number,
): number | false {
  if (elapsedMs !== undefined && jobPollPhase(elapsedMs) === 'exceeded') return false
  return shouldKeepPolling(job) ? JOB_POLL_INTERVAL_MS : false
}
