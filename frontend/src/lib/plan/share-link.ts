import { parseDay, todayUtc } from '@/lib/date/day'
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
