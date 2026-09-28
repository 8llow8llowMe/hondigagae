import { classify, toErrorStatus } from '@/lib/api/error'
import { messages } from '@/lib/messages'

/**
 * 공유 링크 열람 화면의 `<title>` — 이슈 #980. `error` 가 `null` 이면 조회 성공이다.
 *
 * **오류만 받고 일정을 받지 않는다.** 유효한 링크의 제목에 일정 이름을 싣지 않는 것이
 * `일정공유-세부명세.md` 보안 메모의 결정이다 — 일정 이름은 사용자가 지은 사적 문자열이라
 * 브라우저 히스토리·탭 제목·화면 공유로 남에게 샌다. 이 함수에는 **넘길 자리 자체가 없어**
 * 호출부가 실수로도 실을 수 없다.
 *
 * - **404 → `sharedNotFoundTitle`.** 없는 토큰·폐기·삭제·초안 회귀가 전부 404 로 같게 온다.
 * - **410 → `sharedExpiredTitle`.** 만료는 상태가 200 으로 남는 갈래라(D8-2) 탭 제목이
 *   상태를 말하는 유일한 신호다. 404 와 다른 말이어야 한다(본문도 갈린다).
 * - **성공·5xx·무응답·그 밖 → `sharedPageTitle`.** 5xx 뒤 `error.tsx` 의 재시도가 성공하면
 *   멀쩡한 일정 화면의 탭에 실패 문구가 남는다 — 성공 제목과 같아야 한다
 *   (`architecture-guide.md` §7 #206, `src/lib/plan/detail-title.ts` 와 같은 축).
 *
 * `generateMetadata` 안에 두면 테스트할 수 없어 뽑아냈다 (`testing-guide.md` §1).
 */
export function sharedPlanPageTitle(error: unknown): string {
  const status = toErrorStatus(error)
  if (status === null) return messages.plan.sharedPageTitle

  switch (classify(status)) {
    case 'not-found':
      return messages.plan.sharedNotFoundTitle
    case 'gone':
      return messages.plan.sharedExpiredTitle
    default:
      return messages.plan.sharedPageTitle
  }
}
