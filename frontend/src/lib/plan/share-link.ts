import { ApiError, isRetriable } from '@/lib/api/error'
import { toMessage } from '@/lib/api/response'
import { parseDay, todayUtc } from '@/lib/date/day'
import type { FailureAnnounce } from '@/lib/form/submit-failure-focus'
import { messages } from '@/lib/messages'
import { SHAREABLE_PLAN_STATUSES } from '@/types/plan'

/**
 * 공유 링크의 순수 규칙 (#628) — 주소 조립 · 공유 가능 판정 · 만료 표기.
 *
 * **렌더와 분리한다.** 셋 다 계약 해석이고, 특히 공유 가능 판정은 백엔드
 * `PlanStatus.isShareable()` 의 복제본이라 값으로 검증해야 한다.
 */

/** 열람 화면의 경로 접두어. 라우트(`app/(main)/shared-plans/[token]`)와 같아야 한다 */
export const SHARED_PLAN_PATH = '/shared-plans'

/**
 * 받은 사람이 열 주소. 만들 수 없으면 `null`.
 *
 * **`origin` 을 주입받는다.** 브라우저의 `window.location.origin` 을 넘긴다 —
 * `NEXT_PUBLIC_*` 로 기준 주소를 하나 더 두면 프리뷰·dev·프로덕션에서 어긋날 자리가
 * 하나 더 생기고, 사용자가 지금 보고 있는 주소가 곧 정답이다. 서버 렌더에는
 * `window` 가 없으므로 **빈 문자열이 들어올 수 있고 그때는 `null`** 이다.
 *
 * 토큰은 URL-safe Base64 라 정상 값에는 인코딩할 문자가 없다. 그래도 인코딩하는 것은
 * 서버가 토큰 문자셋을 바꿨을 때 주소가 조용히 깨지지 않게 하기 위해서다.
 */
export function shareUrlOf(token: string, origin: string): string | null {
  if (token === '' || origin === '') return null

  // 끝 슬래시를 먹지 않으면 `//shared-plans` 가 된다
  const base = origin.replace(/\/+$/, '')

  return `${base}${SHARED_PLAN_PATH}/${encodeURIComponent(token)}`
}

/**
 * 이 상태의 일정을 공유할 수 있는가. 백엔드 `PlanStatus.isShareable()` 복제본이다.
 *
 * **모르는 코드는 `false`** 다. 서버가 상태를 늘렸을 때 기본값이 `true` 면 화면이 먼저
 * 열리고 서버가 `PLAN_022` 로 막는다 — 사용자는 눌러 보고서야 안 된다는 것을 안다.
 */
export function isShareablePlan(statusCode: string): boolean {
  return (SHAREABLE_PLAN_STATUSES as readonly string[]).includes(statusCode)
}

/**
 * ⋯ 메뉴의 공유 항목 상태 (#1154).
 *
 * - `enabled` — 공유할 수 있다
 * - `locked` — **초안**이다. 잠긴 채 보인다
 * - `hidden` — 모르는 상태다. 확정하면 열린다고 약속할 근거가 없어 감춘다
 *
 * **초안을 감추기만 하면 사용자는 공유 기능이 없는 줄 안다** — 사용성 점검에서 실제로 그랬다.
 * 누르면 `PLAN_022` 400 이 나는 항목을 두지 않는다는 #628 의 결정은 그대로다: `locked` 는
 * 눌리지 않는다(비활성). 어디 있는지와 무엇을 하면 열리는지만 말한다.
 */
export function shareMenuState(statusCode: string): 'enabled' | 'locked' | 'hidden' {
  if (isShareablePlan(statusCode)) return 'enabled'
  return statusCode === 'DRAFT' ? 'locked' : 'hidden'
}

/**
 * 만료 안내 한 줄. 날짜를 못 읽으면 `null` — 틀린 날짜는 없는 날짜보다 나쁘다.
 *
 * **D-N 을 쓰지 않는다.** 30일짜리라 `D-29` 는 크기 감각을 주지 못하고, 이 줄을 읽는
 * 자리(발급 모달)는 "언제까지 유효한지" 를 그대로 전달하면 되는 곳이다.
 *
 * `expiresAt` 은 백엔드 `LocalDateTime`(`YYYY-MM-DDTHH:mm:ss`)이라 **시각은 버리고
 * 날짜 칸으로만 비교한다** — 시각까지 보면 "오늘 23시 만료" 가 "0일 남음" 이 된다.
 */
export function shareExpiryLabel(expiresAt: string, today: Date): string | null {
  const day = parseDay(expiresAt.slice(0, 10))
  if (day === null) return null

  const now = todayUtc(today)
  if (day < now) return messages.plan.shareExpired
  if (day === now) return messages.plan.shareExpiryToday

  const date = new Date(day)
  const label = `${date.getUTCFullYear()}년 ${date.getUTCMonth() + 1}월 ${date.getUTCDate()}일`

  return messages.plan.shareExpiryOn.replace('{date}', label)
}

/** 발급 모달 조회 실패를 무엇으로 그릴지 — 일시 장애(재시도 있음)이거나 문구 알림이거나 */
export type ShareLoadFailure = { kind: 'temporary' } | { kind: 'alert'; message: string }

/**
 * 발급 모달이 링크를 못 불러왔을 때 (#979 · #1159).
 *
 * **"공유 중이 아님" 은 여기 오지 않는다** — 서버가 200 + `dataBody: null` 로 답한다.
 * 대신 일정이 없는 404 `PLAN_001` 이 들어온다(다른 탭에서 지운 경우). 예전 호출부는 404 를
 * 통째로 `null` 로 접어 이것을 "공유 중이 아님" 으로 보였다.
 *
 * 5xx · 무응답만 `temporary` — **재시도 버튼이 선다** (#1159, `api-integration-guide.md` §3
 * "5xx · 무응답 — 재시도 버튼 제공"). 예전에는 "잠시 후 다시 시도해 주세요." 문구만 있고 버튼이 없어
 * 모달을 닫았다 다시 열어야 했다. 그 밖의 실패는 **서버 문구를 그대로** 쓴다 — 404 에
 * 재시도를 권하지 않는다.
 */
export function shareLoadFailure(error: unknown): ShareLoadFailure {
  // ApiError 가 아니면 `isRetriable` 이 전송 단계 실패(무응답)로 보고 true 다
  if (isRetriable(error) || !(error instanceof ApiError)) return { kind: 'temporary' }
  // 서버 문구가 없는 4xx(래퍼 없는 게이트웨이 404·403)도 재시도를 권하지 않는다
  return { kind: 'alert', message: toMessage(error.rawMessage, messages.plan.shareLoadFailed) }
}

/**
 * 사용자가 누른 재시도의 진행 (#1159).
 * - `running` — 요청이 도는 중. 본문을 골격으로 바꾼다
 * - `settled` — 요청은 끝났고 결과가 아직 그려지지 않았을 수 있다. 그려지면 포커스를 옮긴다
 * - `focused` — 포커스를 옮긴 그 결과가 화면에 있다. **다음 조회가 시작되면 `idle` 로 돌아간다**
 */
export type ShareRetryPhase = 'idle' | 'running' | 'settled' | 'focused'

/** 발급 모달 본문의 다섯 갈래 — 실패는 `unavailable`(재시도 있음)과 `error`(서버 문구만) 둘이다 */
export type PlanShareState = 'loading' | 'unavailable' | 'error' | 'idle' | 'shared'

/**
 * 발급 모달 본문이 무엇을 그릴지 (#1159).
 *
 * **재시도 중이면 실패보다 골격이 먼저다.** 오류에서 다시 부르면 React Query 는 결과가 날 때까지
 * `isError` 를 그대로 두어, 일시 장애가 선 채로 버튼만 눌린 것처럼 보인다. 사용자가 누른 재시도만
 * 본다 — 배경 재조회(무효화 · `refetchOnReconnect`)까지 골격으로 바꾸면 보던 자리가 예고 없이
 * 사라지고, 그 안에 있던 포커스가 `BODY` 로 떨어진다.
 */
export function shareContentState({
  isPending,
  isFetching,
  retryPhase,
  failure,
  hasLink,
}: {
  isPending: boolean
  isFetching: boolean
  retryPhase: ShareRetryPhase
  failure: ShareLoadFailure | null
  hasLink: boolean
}): PlanShareState {
  const retrying = retryPhase === 'running' || (retryPhase === 'settled' && isFetching)

  if (isPending || retrying) return 'loading'
  if (failure !== null) return failure.kind === 'temporary' ? 'unavailable' : 'error'
  return hasLink ? 'shared' : 'idle'
}

/**
 * 발급 모달의 실패 표시가 무엇으로 읽히는가 (`form-guide.md` §8, #1102).
 *
 * **`focus` 는 포커스를 실제로 옮기는(옮긴) 결과에만 준다.** 처음 불러오다 실패하면 포커스가 `닫기`
 * 에 있으므로 `live`(`role="alert"`), 재시도 결과는 포커스가 그 표시로 오므로 `focus` 다 — 둘 다
 * 두면 같은 문구를 두 번 읽는다. 재시도 뒤 다른 조회(`링크 만들기` 뒤 무효화 등)가 실패하면 그때는
 * 포커스가 오지 않으므로 다시 `live` 여야 한다 — 그래서 `focused` 는 다음 조회에서 `idle` 로 돌아간다.
 * 그대로 두면 "역할을 뗐는데 포커스도 안 간" 무음 실패가 된다.
 */
export function shareFailureAnnounce(retryPhase: ShareRetryPhase): FailureAnnounce {
  return retryPhase === 'idle' ? 'live' : 'focus'
}

/** 발급 모달 조회의 최대 재시도 횟수 — `api-integration-guide.md` §7 일정 행 */
const SHARE_LINK_QUERY_MAX_RETRY = 1

/**
 * 발급 모달 조회의 React Query `retry` (#979).
 *
 * §7 일정 행의 "retry 1" 을 **오류 종류를 보존한 채** 구현한다. 숫자 `retry: 1` 은 전역
 * error-aware retry 를 덮어써 404 `PLAN_001` · 400 `PLAN_022` 까지 한 번 더 부른다
 * (`features/pet/queries.ts` 와 같은 이유). 5xx · 무응답만 한 번 재시도한다.
 */
export function shouldRetryShareLinkQuery(failureCount: number, error: unknown): boolean {
  return isRetriable(error) && failureCount < SHARE_LINK_QUERY_MAX_RETRY
}
