import { FormNotice } from '@/components/form-notice'
import { messages } from '@/lib/messages'

/**
 * 표시 전용. 세션이 끊긴 이유를 로그인 화면에서 안내한다.
 *
 * **모르는 값이면 아무것도 렌더하지 않는다.** 쿼리는 사용자가 조작할 수 있으므로
 * 여기 없는 값이 오면 조용히 무시한다 — `SignupDoneNotice` 가 `signedUp !== '1'` 을
 * 처리하는 것과 같은 판단이다.
 *
 * 서버 컴포넌트(`app/(auth)/login/page.tsx`)와 분리한 별도 파일인 이유도 같다:
 * 같은 파일에 두면 렌더 테스트가 `env.server.ts` 의 필수 env 파싱까지 끌고 온다
 * (docs/testing-guide.md §1).
 *
 * **표는 객체 리터럴이 아니라 `Map` 이다.** 객체로 두면 `reauth=__proto__` · `reauth=toString`
 * 같은 프로토타입 키가 `undefined` 가 아니라 **상속된 값**을 돌려준다 — `toString` 은
 * 함수라 React 가 "Objects are not valid as a React child" 로 터진다.
 * 사용자가 조작하는 값으로 조회하는 표는 `Map` 을 쓴다.
 */
const NOTICES = new Map<string, string>([
  ['password-changed', messages.member.passwordChangedNotice],
  ['password-removed', messages.member.removePasswordDone],
  ['withdrawn', messages.member.withdrawDone],
])

export function ReauthNotice({ reauth }: { reauth: string | undefined }) {
  if (reauth === undefined) return null

  const message = NOTICES.get(reauth)
  if (message === undefined) return null

  return <FormNotice message={message} />
}
