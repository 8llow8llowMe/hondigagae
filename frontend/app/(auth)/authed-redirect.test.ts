/**
 * **로그인한 채 인증 화면에 오면 안내 대신 목적지로 보낸다** — 이슈 #1082.
 *
 * 예전에는 세 화면이 `LoggedInNotice`("이미 로그인되어 있어요" + 이동 링크 + 로그아웃)를
 * 그렸다. 그 화면을 둔 근거(공통명세 S5-5 "로그아웃 진입점이 여기뿐")가 계정 메뉴
 * (`nav/account-menu.tsx`)와 마이페이지 로그아웃이 생기며 사라졌고, 안내는 누구로·어디로
 * 가는지도 말하지 않았다. 지금은 **세션이 있으면 서버에서 `redirect(safeReturnTo(returnTo))`**
 * 한다.
 *
 * ### 페이지를 실제로 부른다 (소스 문자열이 아니다)
 *
 * 세 페이지는 `readSession()` 을 부르는 async 서버 컴포넌트라 렌더할 수 없고, 세션 모듈을
 * import 만 해도 `env.server.ts` 가 부팅 환경변수로 fail-fast 한다
 * (`signup/social/[provider]/page.test.ts` 머리주석). **그래서 세션 모듈을 통째로 목으로
 * 바꾼다** — 진짜 모듈을 불러오지 않으니 fail-fast 를 무를 필요가 없다. 그러면 페이지
 * 함수를 그대로 `await` 해 **`redirect` 가 어느 주소로 불렸는지**를 단언할 수 있다.
 *
 * `redirect` 목은 Next 처럼 **던진다.** 던지지 않으면 페이지가 그 뒤의 폼 JSX 까지 만들어
 * "리다이렉트하고도 폼을 그린다" 는 결함을 이 테스트가 놓친다.
 *
 * **목적지 규칙(오픈 리다이렉트 방지)은 여기서 다시 검증하지 않는다** — `safeReturnTo` 의
 * 경계는 `src/lib/http/redirect.test.ts` 가 본다. 여기서 볼 것은 세 페이지가 **정말 그
 * 함수를 거친 값으로** 보내는가다. 그래서 대표 입력 셋(내부 경로 · 외부 URL · 인증 경로)만 쓴다.
 */
import type * as Navigation from 'next/navigation'

import { beforeEach, describe, expect, it, vi } from 'vitest'

/*
  **`toThrow` 가 아니라 `toHaveBeenCalledWith` 로 목적지를 본다.** `toThrow` 는 부분 문자열
  비교라 `'NEXT_REDIRECT:/'` 가 `/mypage` 로 보낸 경우에도 통과한다.
*/
const { readSession, redirect } = vi.hoisted(() => ({
  readSession: vi.fn(),
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`)
  }),
}))

vi.mock('@/lib/auth/session', () => ({ readSession }))
vi.mock('next/navigation', async (importOriginal) => ({
  ...(await importOriginal<typeof Navigation>()),
  redirect,
}))

const SESSION = { accessToken: 'a', refreshToken: 'r', memberId: 'member-1' }

type Query = { returnTo?: string }

/*
  세 페이지의 인자 모양이 조금씩 다르다 — 소셜 동의는 제공자 세그먼트를 함께 받는다.
  **제공자는 알려진 값(`kakao`)으로 준다.** 모르는 값이면 세션을 읽기 전에 404 로 끝나
  이 테스트가 볼 갈래에 닿지 않는다 (그 순서는 형제 `page.test.ts` 가 잠근다).
*/
const PAGES = [
  {
    name: '/login',
    call: async (query: Query) => {
      const { default: Page } = await import('./login/page')
      return Page({ searchParams: Promise.resolve(query) })
    },
  },
  {
    name: '/signup',
    call: async (query: Query) => {
      const { default: Page } = await import('./signup/page')
      return Page({ searchParams: Promise.resolve(query) })
    },
  },
  {
    name: '/signup/social/[provider]',
    call: async (query: Query) => {
      const { default: Page } = await import('./signup/social/[provider]/page')
      return Page({
        params: Promise.resolve({ provider: 'kakao' }),
        searchParams: Promise.resolve(query),
      })
    },
  },
] as const

beforeEach(() => {
  readSession.mockReset()
  redirect.mockClear()
})

describe.each(PAGES)('$name — 세션이 있으면', ({ call }) => {
  beforeEach(() => {
    readSession.mockResolvedValue(SESSION)
  })

  it('returnTo 로 보낸다', async () => {
    await expect(call({ returnTo: '/mypage' })).rejects.toThrow('NEXT_REDIRECT')
    expect(redirect).toHaveBeenCalledTimes(1)
    expect(redirect).toHaveBeenCalledWith('/mypage')
  })

  /* 쿼리가 붙은 목적지도 그대로 간다 — 경로만 남기고 자르지 않는다 */
  it('returnTo 의 쿼리를 보존한다', async () => {
    await expect(call({ returnTo: '/places?region=jeju' })).rejects.toThrow('NEXT_REDIRECT')
    expect(redirect).toHaveBeenCalledWith('/places?region=jeju')
  })

  /* 쿼리는 사용자가 조작할 수 있다. 그대로 보내면 오픈 리다이렉트다 */
  it('외부 URL returnTo 는 홈으로 좁힌다', async () => {
    await expect(call({ returnTo: 'https://evil.example' })).rejects.toThrow('NEXT_REDIRECT')
    expect(redirect).toHaveBeenCalledWith('/')
  })

  /*
    **리다이렉트 루프가 없다.** `safeReturnTo` 가 `/login` · `/signup` 을 홈으로 바꾸므로
    `/login?returnTo=/signup` 이 `/signup` → `/login` 으로 핑퐁하지 않는다.
  */
  it('인증 화면을 가리키는 returnTo 는 홈으로 보낸다', async () => {
    await expect(call({ returnTo: '/signup' })).rejects.toThrow('NEXT_REDIRECT')
    expect(redirect).toHaveBeenCalledWith('/')
  })

  it('returnTo 가 없으면 홈으로 보낸다', async () => {
    await expect(call({})).rejects.toThrow('NEXT_REDIRECT')
    expect(redirect).toHaveBeenCalledWith('/')
  })
})

describe.each(PAGES)('$name — 세션이 없으면', ({ call }) => {
  it('리다이렉트하지 않고 화면을 그린다', async () => {
    readSession.mockResolvedValue(null)

    await expect(call({ returnTo: '/mypage' })).resolves.toBeTruthy()
    expect(redirect).not.toHaveBeenCalled()
  })
})
