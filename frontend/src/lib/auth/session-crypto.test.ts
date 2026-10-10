import { describe, expect, it } from 'vitest'

import { seal, unseal } from '@/lib/auth/session-crypto'

const SECRET = 'test-secret-that-is-at-least-32-characters-long'

describe('seal / unseal', () => {
  it('봉인한 페이로드를 그대로 복원한다', () => {
    const payload = { accessToken: 'a.b.c', refreshToken: 'r.s.t', memberId: '1' }

    expect(unseal(seal(payload, SECRET), SECRET)).toEqual(payload)
  })

  it('같은 페이로드도 매번 다른 토큰을 만든다 (IV 가 랜덤이다)', () => {
    const payload = { memberId: '1' }

    expect(seal(payload, SECRET)).not.toBe(seal(payload, SECRET))
  })

  it('다른 secret 으로는 복원하지 못한다', () => {
    const token = seal({ memberId: '1' }, SECRET)

    expect(unseal(token, 'another-secret-that-is-also-32-characters')).toBeNull()
  })

  it('위조된 토큰은 예외 대신 null 을 반환한다 (쿠키는 사용자가 조작할 수 있다)', () => {
    const token = seal({ memberId: '1' }, SECRET)
    const tampered = `${token.slice(0, -4)}AAAA`

    expect(unseal(tampered, SECRET)).toBeNull()
  })

  it('형식이 깨진 토큰은 null 을 반환한다', () => {
    expect(unseal('not-a-token', SECRET)).toBeNull()
    expect(unseal('', SECRET)).toBeNull()
  })
})
