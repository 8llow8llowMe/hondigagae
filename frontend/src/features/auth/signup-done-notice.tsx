import { messages } from '@/lib/messages'

/**
 * 표시 전용. `signedUp=1` 일 때만 가입 완료 안내를 보여준다 — 회원가입-세부명세.md D5.
 *
 * 가입 성공 리다이렉트와 409(이메일 중복) "로그인하기" 링크가 완전히 같은
 * `/login?returnTo=…&email=…` 쿼리 셰이프를 쓴다. `email` 유무로 판정하면
 * 중복 계정 케이스에도 이 배너가 잘못 뜬다 — `signedUp` 전용 파라미터로만 판정한다.
 *
 * `app/(auth)/login/page.tsx`(async 서버 컴포넌트, `readSession` 을 통해 서버 전용
 * env 를 끌어온다)와 분리한 별도 파일이다. 같은 파일에 두면 이 컴포넌트만 렌더
 * 테스트하려 해도 import 체인이 `env.server.ts` 의 필수 env 파싱까지 끌고 와
 * node 테스트 환경에서 실패한다 (docs/testing-guide.md §1).
 */
export function SignupDoneNotice({ signedUp }: { signedUp: string | undefined }) {
  if (signedUp !== '1') return null

  return (
    <p role="status" className="text-body-2 text-info-700 bg-info-100 rounded-md px-3 py-2">
      {messages.auth.signupDone}
    </p>
  )
}
