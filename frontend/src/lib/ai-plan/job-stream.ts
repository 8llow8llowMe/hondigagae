/**
 * AI 일정 작업 SSE 구독 판정 (#91) — 명세 S3.
 *
 * 근거: 백엔드 `AiPlanWebController.streamJobStatus` · `AiPlanJobSseStreamer` **소스 실측**.
 *
 * **DOM 이 필요한 부분과 판정을 나눈다.** `EventSource` 조립은 훅이 하고, 이 파일은
 * "이 이벤트를 어떻게 읽고 언제 끊는가" 만 다뤄 node 환경 테스트로 덮는다.
 */
import { isJobCanceled, isJobCompleted, isJobFailed, statusCodeOf } from '@/lib/ai-plan/job'
import type { AiPlanJob } from '@/types/ai-plan'

/**
 * 이벤트 이름 — 백엔드 `AiPlanJobSseStreamer.EVENT_NAME` 복제본.
 *
 * **`onmessage` 로는 오지 않는다.** 이름 있는 이벤트라 `addEventListener('job-update')`
 * 로 받아야 한다. 이슈 체크리스트는 25초 하트비트만 짚었지만, 데이터 이벤트도 마찬가지다
 * — `onmessage` 만 달면 화면은 영원히 아무것도 못 받고 폴백도 돌지 않는다.
 */
export const JOB_STREAM_EVENT = 'job-update'

/**
 * 이벤트 `data` 를 작업으로 읽는다.
 *
 * **공통 래퍼(`dataHeader`/`dataBody`)가 없다.** 컨트롤러 설명이 "이벤트 data 는 작업 상태
 * 조회 응답의 dataBody 와 동일한 JSON" 이라고 못박고 있어 `unwrap()` 을 태우면 안 된다.
 *
 * 읽을 수 없는 프레임은 `null` 이다 — 던지지 않는다. 한 프레임이 깨졌다고 구독을 끊으면
 * 다음 정상 프레임을 못 받는다.
 */
export function parseJobEvent(data: string): AiPlanJob | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(data)
  } catch {
    return null
  }

  if (parsed === null || typeof parsed !== 'object') return null

  // `status` 가 없으면 작업 상태가 아니다. 최소한의 모양만 확인하고 통과시킨다 —
  // 필드 검증은 화면의 판정 함수(`lib/ai-plan/job.ts`)가 이미 방어적으로 한다
  if (!('status' in parsed)) return null

  return parsed as AiPlanJob
}

/**
 * 이 작업 상태에서 구독을 닫아야 하는가.
 *
 * **닫지 않으면 무한 재구독이 된다.** 백엔드는 종결 상태를 보낸 뒤 `emitter.complete()`
 * 로 연결을 닫는데, 네이티브 `EventSource` 는 서버가 닫은 연결을 **자동 재연결 대상**으로
 * 본다. 그러면 재구독 → 종결 스냅샷 → 닫힘이 끝없이 돈다.
 *
 * **`CANCELED` 도 종결이다** (#250). 취소는 별도 이벤트가 아니라 `CANCELED` 상태 이벤트로
 * 오고 서버가 그 직후 닫는다 — 빠뜨리면 취소한 작업에서 정확히 그 무한 재구독이 돈다.
 */
export function isTerminalJob(job: AiPlanJob | null): boolean {
  return isJobCompleted(job) || isJobFailed(job) || isJobCanceled(job)
}

/** 종결의 순위 — 단계 수와 무관하게 가장 높다 */
const TERMINAL_RANK = Number.POSITIVE_INFINITY

/**
 * 작업이 얼마나 나아갔는가 (#1057). **클수록 앞이다.** 순위를 매길 수 없는 상태는 `null` 이다.
 *
 * `PENDING`(0) < 단계 전 `RUNNING`(1) < `stepOrder` 1..n(2..n+1) < 종결. 백엔드
 * `AiPlanJobSseStreamer` 의 단조 가드와 **같은 순서**다 — 서버가 한 연결 안에서 지키는 것을
 * 화면은 두 출처(SSE · 조회)를 합칠 때 지킨다.
 *
 * `stepOrder` 가 1 보다 작거나 숫자가 아니면 **단계 전**으로 읽는다. 계약보다 앞선 서버는 필드를
 * 싣지 않는다(`jobStepProgress` 와 같은 방어) — `NaN` 이 섞이면 모든 비교가 거짓이 된다.
 */
export function jobProgressRank(job: AiPlanJob): number | null {
  if (isTerminalJob(job)) return TERMINAL_RANK

  const code = statusCodeOf(job.status)
  if (code === 'PENDING') return 0
  if (code !== 'RUNNING') return null

  const order = job.stepOrder
  return typeof order === 'number' && Number.isInteger(order) && order >= 1 ? 1 + order : 1
}

/**
 * 캐시에 남길 쪽을 고른다 — **작업을 뒤로 돌리지 않는다** (#1057).
 *
 * SSE 와 폴링이 같은 캐시에 쓰므로 순서가 엇갈릴 수 있다. 조회 응답은 **떠난 시점**의 상태라
 * 도착했을 때 이미 옛 값일 수 있다:
 *  - 구독이 `COMPLETED` 를 받은 뒤 그 전에 떠난 폴링 응답(`PENDING`)이 도착하면 완료된 화면이
 *    대기 화면으로 되돌아간다. **작업은 종결되면 그 상태에 머문다**(`AiPlanJobStatus.isTerminal`)
 *  - 구독이 `DRAFTING`(4) 을 넣은 뒤 첫 조회의 `WEATHER`(3) 가 도착하면 `3/4` 로 되돌아가고,
 *    구독이 열려 있어 30초 안전 폴링이 와서야 복구된다 — 하루 다시 만들기가 `날씨 전망 반영` 에
 *    40초 머물던 원인이다(#985 조사). **한 작업 안에서 단계는 앞으로만 간다**(`AiPlanWorker`)
 *
 * 그래서 **순위가 줄어드는 쪽이 항상 틀렸다.** 같은 순위면 새 값을 쓴다 — 같은 단계를 다시 보낸
 * 것이라 버릴 이유가 없다. 순위를 모르는 상태는 가로막지 않는다 — "낮다" 로 읽으면 서버가 상태를
 * 늘렸을 때 화면이 영영 옛 값에 머문다.
 */
export function mergeJobUpdate(cached: AiPlanJob | undefined, incoming: AiPlanJob): AiPlanJob {
  if (cached === undefined) return incoming

  const cachedRank = jobProgressRank(cached)
  const incomingRank = jobProgressRank(incoming)
  if (cachedRank !== null && incomingRank !== null && incomingRank < cachedRank) return cached

  return incoming
}
