import { describe, expect, it, vi } from 'vitest'

import { enterAfterSignup } from '@/features/auth/enter-after-signup'

function deps(login: () => Promise<unknown>) {
  return {
    login: vi.fn(login),
    enter: vi.fn(),
    toLogin: vi.fn(),
    handOff: vi.fn(),
  }
}

const INPUT = { email: 'a@b.c', password: 'Pw!12345', returnTo: '/ai-plans/new' }

/*
  **가입 직후 다시 로그인시키지 않는다** (#1158, 사용자 결정 2026-10-06 — 회원가입-세부명세
  D8 #3 개정). 가입 API 는 토큰을 주지 않아(`Response<Void>`) 같은 자격으로 로그인을 이어 부른다.
*/
describe('enterAfterSignup (#1158)', () => {
  it('로그인이 되면 가려던 곳으로 바로 간다', async () => {
    const d = deps(() => Promise.resolve({ memberId: '1' }))
    await enterAfterSignup(d, INPUT)

    expect(d.login).toHaveBeenCalledWith({ email: 'a@b.c', password: 'Pw!12345' })
    expect(d.enter).toHaveBeenCalledWith('/ai-plans/new')
    expect(d.toLogin).not.toHaveBeenCalled()
  })

  /* 가입은 이미 됐다 — 로그인 실패를 가입 실패로 말하면 사용자가 다시 가입하다 409 를 맞는다 */
  it('로그인이 실패해도 던지지 않고 로그인 화면으로 보낸다 — 가입 완료 안내와 함께', async () => {
    const d = deps(() => Promise.reject(new Error('500')))
    await expect(enterAfterSignup(d, INPUT)).resolves.toBeUndefined()

    expect(d.enter).not.toHaveBeenCalled()
    expect(d.toLogin).toHaveBeenCalledWith('/login?returnTo=%2Fai-plans%2Fnew&signedUp=1')
  })

  it('로그인 화면으로 갈 때 이메일은 URL 이 아니라 넘겨주기로 간다', async () => {
    const d = deps(() => Promise.reject(new Error('500')))
    await enterAfterSignup(d, INPUT)

    expect(d.handOff).toHaveBeenCalledWith('a@b.c')
    expect(String(d.toLogin.mock.calls[0]?.[0])).not.toContain('email')
  })
})
