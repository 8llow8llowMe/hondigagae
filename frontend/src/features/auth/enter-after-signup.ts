import type { LoginRequest } from '@/lib/api/auth'

type EnterAfterSignupDeps = {
  login: (values: LoginRequest) => Promise<unknown>
  /** 세션에 들어간다 — 호출부는 `enterSession`(문서째 새로 받기)을 넘긴다 */
  enter: (href: string) => void
  /** 로그인 화면으로 보낸다 — 호출부는 `router.replace` 를 넘긴다 */
  toLogin: (href: string) => void
  handOff: (email: string) => void
}

/**
 * 가입 직후 **같은 자격으로 로그인을 이어 부른다** (#1158, 사용자 결정 2026-10-06).
 *
 * 예전에는 가입을 마치면 로그인 화면으로 보내 비밀번호를 다시 치게 했다(회원가입-세부명세 D8 #3
 * (a)). 근거였던 두 가지를 이렇게 다룬다:
 *
 * - **"비밀번호를 메모리에 더 오래 든다"** — 가입 폼이 이미 들고 있는 값을 요청 하나 더 쓰는
 *   동안만 쓴다. 이 함수는 값을 어디에도 남기지 않는다
 * - **"실패 시 상태가 모호하다"** — 가입은 이미 됐다. 로그인이 어떤 이유로든 실패하면 **던지지
 *   않고** 예전과 같은 로그인 화면(`signedUp=1` 가입 완료 안내)으로 보낸다. 던지면 폼이 가입
 *   실패로 그려 사용자가 다시 가입하다 409 를 맞는다
 *
 * 로그인 화면으로 갈 때 이메일은 **URL 이 아니라 넘겨주기**(`login-email-handoff.ts`)로 간다.
 */
export async function enterAfterSignup(
  deps: EnterAfterSignupDeps,
  { email, password, returnTo }: { email: string; password: string; returnTo: string },
): Promise<void> {
  try {
    await deps.login({ email, password })
  } catch {
    deps.handOff(email)
    deps.toLogin(`/login?${new URLSearchParams({ returnTo, signedUp: '1' }).toString()}`)
    return
  }
  deps.enter(returnTo)
}
