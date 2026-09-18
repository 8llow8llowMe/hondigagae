/**
 * 소셜 동의 화면의 **제공자 세그먼트 검증** — 이슈 #707.
 *
 * 화면 자체는 `src/features/auth/social-signup-consent-screen.test.ts` 가 렌더로 본다.
 * 여기서 잠그는 것은 **페이지에만 있는 판단**이다: 모르는 제공자를 404 로 거절하는 것과,
 * 그 검사가 세션을 읽기 전에 오는 것.
 *
 * **소스를 문자열로 읽는다.** 이 페이지는 `readSession()` 을 부르는 async 서버 컴포넌트라
 * node 환경에서 렌더할 방법이 없고, import 만 해도 `env.server.ts` 가 부팅 환경변수로
 * fail-fast 한다 (`main-layout-surface.test.ts` 와 같은 사정, `testing-guide.md` §1).
 * 테스트를 위해 그 fail-fast 를 무르면 **실서버에서 환경변수 누락을 늦게 발견하게 되므로**
 * 무르지 않는다.
 *
 * **거부 판정 자체는 이미 렌더 없이 검증된다** — `src/lib/auth/oauth-provider.test.ts` 가
 * `isOAuthProvider` 의 경계(대문자·프로토타입 키·빈 문자열)를 본다. 여기서 볼 것은
 * **그 함수를 이 페이지가 정말 쓰는가**뿐이다.
 */
import { describe, expect, it } from 'vitest'

import { readSourceWithoutComments } from '@/test/source'

const source = readSourceWithoutComments('app/(auth)/signup/social/[provider]/page.tsx')

describe('소셜 동의 화면 페이지 — 제공자 세그먼트', () => {
  /*
    경로 세그먼트는 사용자가 손으로 바꿀 수 있다. 200 으로 답하면 크롤러가 없는 페이지를
    정상으로 읽고 모니터링도 실패를 세지 못한다.
  */
  it('모르는 제공자는 notFound() 로 거절한다', () => {
    expect(source).toContain('if (!isOAuthProvider(provider)) notFound()')
  })

  /*
    **순서가 계약이다.** 뒤로 미루면 잘못된 주소에 쿠키 복호화 비용을 태우고, 세션이
    있는 사용자에게는 404 대신 `LoggedInNotice` 가 나가 같은 주소가 세션 유무로 다른
    상태를 답한다.
  */
  it('세션을 읽기 전에 거른다', () => {
    const guard = source.indexOf('isOAuthProvider(provider)')
    const session = source.indexOf('readSession()')

    expect(guard).toBeGreaterThan(-1)
    expect(session).toBeGreaterThan(guard)
  })

  /* `returnTo` 는 쿼리라 오픈 리다이렉트 표면이다 — 거르지 않고 넘기면 안 된다 */
  it('returnTo 를 safeReturnTo 로 거른다', () => {
    expect(source).toContain('safeReturnTo(returnTo)')
  })

  /* 이미 로그인한 사용자에게 가입 동의를 다시 묻지 않는다 — `/signup` 과 같은 처리다 */
  it('세션이 있으면 LoggedInNotice 로 보낸다', () => {
    expect(source).toContain('<LoggedInNotice returnTo={target} />')
  })

  /*
    **`loading.tsx` 를 두지 않는다.** 경계가 있으면 응답이 먼저 스트리밍돼 `notFound()`
    가 HTTP 상태를 404 로 바꾸지 못하고 200 으로 굳는다.
  */
  it('세그먼트에 loading.tsx 를 두지 않는다', () => {
    expect(() =>
      readSourceWithoutComments('app/(auth)/signup/social/[provider]/loading.tsx'),
    ).toThrow()
  })
})
