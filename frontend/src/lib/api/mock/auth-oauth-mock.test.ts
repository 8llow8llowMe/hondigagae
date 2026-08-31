import { beforeEach, describe, expect, it } from 'vitest'

import { resolveMock } from '@/lib/api/mock'
import { mockStore, resetMockStore } from '@/lib/api/mock/store'

/**
 * 소셜 로그인 mock — 백엔드 `OAuthLoginProcessor` · `RedisOAuthStateStoreAdapter` 재현.
 *
 * **이 mock 이 생기면서 `social@` 계정에 처음으로 로그인할 수 있게 됐다.** 비밀번호가
 * 없어 이메일 로그인이 불가능한 계정이라, #83 이 만든 `/mypage/password` 의 소셜 전용
 * 분기를 브라우저로 확인할 유일한 경로다 (`store.ts` 의 fixture 주석 참고).
 */

type AuthorizeBody = { authorizationUrl: string }

function authorize(provider: string) {
  return resolveMock(`/auth/${provider}/authorize`, 'GET', '', null)
}

/** authorize 가 만들어 준 콜백 주소에서 code·state 를 꺼낸다 */
function issued(provider: string): { code: string; state: string } {
  const body = authorize(provider)?.payload.dataBody as AuthorizeBody
  const params = new URLSearchParams(body.authorizationUrl.split('?')[1] ?? '')
  return { code: params.get('code') ?? '', state: params.get('state') ?? '' }
}

function login(provider: string, code: string, state: string) {
  return resolveMock(`/auth/${provider}/login`, 'GET', `?code=${code}&state=${state}`, null)
}

beforeEach(resetMockStore)

describe('GET /auth/{provider}/authorize', () => {
  it('우리 콜백으로 돌아오는 주소를 준다 — 로컬에서 한 바퀴 돈다', () => {
    const body = authorize('kakao')?.payload.dataBody as AuthorizeBody

    expect(body.authorizationUrl).toMatch(/^\/oauth\/kakao\/callback\?code=[^&]+&state=[^&]+$/)
  })

  it('state 를 provider 와 함께 저장한다 — 백엔드도 값으로 provider 를 들고 대조한다', () => {
    const { state } = issued('kakao')

    expect(mockStore().oauthStates.has(`KAKAO:${state}`)).toBe(true)
  })

  it('모르는 provider 는 400 AUTH_007 이다', () => {
    const result = authorize('google')

    expect(result?.status).toBe(400)
    expect(result?.payload.dataHeader.resultCode).toBe('AUTH_007')
  })
})

describe('GET /auth/{provider}/login', () => {
  it('kakao 는 소셜 전용 계정(social@)으로 로그인된다', () => {
    const { code, state } = issued('kakao')
    const result = login('kakao', code, state)

    expect(result?.status).toBe(200)
    // 세션이 완성되려면 refresh 도 함께 와야 한다 — 일반 로그인과 같은 응답 모양이다
    expect(result?.refreshToken).toBe('mock-refresh-900000000000000003')
    expect((result?.payload.dataBody as { memberId: string }).memberId).toBe('900000000000000003')
  })

  it('naver 는 미가입 이메일이라 자동 회원가입 후 로그인된다', () => {
    const before = mockStore().members.length
    const { code, state } = issued('naver')

    expect(login('naver', code, state)?.status).toBe(200)

    const store = mockStore()
    expect(store.members.length).toBe(before + 1)
    const created = store.members[store.members.length - 1]
    expect(created?.provider).toBe('NAVER')
    // 소셜로 만들어진 계정은 비밀번호가 없다 (백엔드 createOAuthMember 도 password(null))
    expect(created?.password).toBeNull()
  })

  it('같은 콜백 주소를 두 번 태우면 두 번째는 AUTH_010 이다', () => {
    /*
      **중복 실행 가드의 회귀 테스트다.** state 는 서버가 조회와 동시에 지운다
      (Redis GETDEL). StrictMode 가 effect 를 두 번 돌리면 첫 호출이 성공한 직후
      두 번째가 여기로 떨어져 오류 화면이 성공을 덮는다.
    */
    const { code, state } = issued('kakao')

    expect(login('kakao', code, state)?.status).toBe(200)

    const again = login('kakao', code, state)
    expect(again?.status).toBe(401)
    expect(again?.payload.dataHeader.resultCode).toBe('AUTH_010')
  })

  it('state 가 없거나 모르는 값이면 AUTH_010 이다', () => {
    const { code } = issued('kakao')

    expect(login('kakao', code, '')?.payload.dataHeader.resultCode).toBe('AUTH_010')
    expect(login('kakao', code, 'forged')?.payload.dataHeader.resultCode).toBe('AUTH_010')
  })

  it('다른 provider 의 state 는 통하지 않는다', () => {
    const kakao = issued('kakao')

    expect(login('naver', kakao.code, kakao.state)?.payload.dataHeader.resultCode).toBe('AUTH_010')
  })

  it('이미 다른 소셜로 가입된 계정은 409 AUTH_008 이고 어느 소셜인지 말해 준다', () => {
    // `linked` 코드는 프로필 이메일을 social@(KAKAO)로 바꾼다 → naver 로 오면 provider 불일치
    const { state } = issued('naver')
    const result = login('naver', 'linked-code', state)

    expect(result?.status).toBe(409)
    expect(result?.payload.dataHeader.resultCode).toBe('AUTH_008')
    // 화면이 문구를 짓지 않고 그대로 노출한다 — provider 이름이 서버 문구 안에 있어야 한다
    expect(result?.payload.dataHeader.resultMessage).toContain('카카오')
  })

  it('동의·인증 결함은 각각 AUTH_009 / AUTH_011 / AUTH_012 다', () => {
    const cases: [string, string][] = [
      ['email-denied', 'AUTH_009'],
      ['profile-denied', 'AUTH_011'],
      ['unverified', 'AUTH_012'],
    ]

    for (const [code, expected] of cases) {
      const { state } = issued('kakao')
      const result = login('kakao', `${code}-1`, state)

      expect(result?.status).toBe(400)
      expect(result?.payload.dataHeader.resultCode).toBe(expected)
    }
  })

  it('제공자 통신 불가는 502 AUTH_014 다', () => {
    const { state } = issued('kakao')
    const result = login('kakao', 'unavailable-1', state)

    expect(result?.status).toBe(502)
    expect(result?.payload.dataHeader.resultCode).toBe('AUTH_014')
  })

  it('state 는 유효한데 code 가 비면 AUTH_013 이다', () => {
    const { state } = issued('kakao')
    const result = login('kakao', '', state)

    expect(result?.payload.dataHeader.resultCode).toBe('AUTH_013')
  })

  it('모르는 provider 는 state 를 보기 전에 AUTH_007 이다', () => {
    const result = login('google', 'code', 'state')

    expect(result?.status).toBe(400)
    expect(result?.payload.dataHeader.resultCode).toBe('AUTH_007')
  })

  it('실패해도 state 는 소비된다 — 백엔드 GETDEL 과 같다', () => {
    const { state } = issued('kakao')
    login('kakao', 'unavailable-1', state)

    expect(mockStore().oauthStates.has(`KAKAO:${state}`)).toBe(false)
  })
})
