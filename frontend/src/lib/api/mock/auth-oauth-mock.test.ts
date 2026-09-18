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

/** 동의 3종을 모두 실은 쿼리 — 화면의 가입 경로가 보내는 모양이다 (#688) */
const AGREED_QUERY = '?termsAgreed=true&privacyAgreed=true&ageOver14Confirmed=true'

function authorize(provider: string, search = AGREED_QUERY) {
  return resolveMock(`/auth/${provider}/authorize`, 'GET', search, null)
}

/** authorize 가 만들어 준 콜백 주소에서 code·state 를 꺼낸다 */
function issued(provider: string, search = AGREED_QUERY): { code: string; state: string } {
  const body = authorize(provider, search)?.payload.dataBody as AuthorizeBody
  const params = new URLSearchParams(body.authorizationUrl.split('?')[1] ?? '')
  return { code: params.get('code') ?? '', state: params.get('state') ?? '' }
}

/**
 * 콜백. `cookieState` 는 BFF 가 봉인을 풀어 되돌려 준 state 쿠키다 (#689).
 * 기본값이 쿼리 state 인 것은 **중계가 정상일 때의 모양**이라서다 — 중계가 끊긴 경우는
 * 아래에서 명시적으로 `null` 을 넘겨 확인한다.
 */
function login(provider: string, code: string, state: string, cookieState: string | null = state) {
  return resolveMock(
    `/auth/${provider}/login`,
    'GET',
    `?code=${code}&state=${state}`,
    null,
    null,
    cookieState,
  )
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

  it('state 쿠키를 함께 내려준다 — BFF 가 이 값을 봉인해 브라우저에 심는다 (#689)', () => {
    const result = authorize('kakao')
    const body = result?.payload.dataBody as AuthorizeBody
    const state = new URLSearchParams(body.authorizationUrl.split('?')[1] ?? '').get('state')

    expect(result?.oauthState).toBe(state)
  })

  it('모르는 provider 는 400 AUTH_007 이다', () => {
    const result = authorize('google')

    expect(result?.status).toBe(400)
    expect(result?.payload.dataHeader.resultCode).toBe('AUTH_007')
  })

  /*
    **동의는 state 와 함께 보관된다** (#688). 콜백은 인가코드를 이미 태운 뒤라 동의를
    다시 받을 수 없어서, 백엔드도 여기서 받아 state 옆에 넣어 둔다. mock 이 이 값을
    잊으면 미동의 최초 연동이 로컬에서만 통과한다.
  */
  it('동의를 state 와 함께 보관한다', () => {
    const { state } = issued('kakao')

    expect(mockStore().oauthStates.get(`KAKAO:${state}`)).toEqual({
      termsAgreed: true,
      privacyAgreed: true,
      ageOver14Confirmed: true,
    })
  })

  it('동의 쿼리가 없으면 전부 false 로 보관한다 — 백엔드 기본값과 같다', () => {
    const { state } = issued('kakao', '')

    expect(mockStore().oauthStates.get(`KAKAO:${state}`)).toEqual({
      termsAgreed: false,
      privacyAgreed: false,
      ageOver14Confirmed: false,
    })
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
    // name 은 프로필의 name, 없으면 nickname 으로 채운다 — 백엔드 createOAuthMember 와 같다
    expect(created?.name).toBe('박소셜')
    expect(created?.nickname).toBe('소셜이')
  })

  it('AUTH_011 은 nickname·name 이 둘 다 빌 때만 난다 — mock 이 백엔드보다 엄격하지 않다', () => {
    /*
      백엔드 `validateRequiredProfile` 은 `!hasText(nickname) && !hasText(name)` 이다.
      `nickname` 만 보고 던지면 실제로는 통과할 프로필이 mock 에서만 400 이 된다.

      **한쪽만 빈 fixture 는 두지 않는다.** 그 조합은 백엔드가 통과시킨 뒤 빈 닉네임으로
      회원을 만들어 DB 제약에 걸릴 수 있는 상태라(컨트롤러 주석이 그 위험을 적어 뒀다),
      mock 이 만들면 실제로 존재할 수 없는 계정을 정상인 것처럼 제공하게 된다.
      여기서 고정하는 것은 "둘 다 빌 때만 던진다" 는 조건뿐이다.
    */
    const { state } = issued('kakao')
    const result = login('kakao', 'profile-denied-1', state)

    expect(result?.payload.dataHeader.resultCode).toBe('AUTH_011')
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

  it('state 쿠키가 없으면 AUTH_010 이다 — BFF 중계가 끊긴 상태다 (#689)', () => {
    /*
      **이 테스트가 없으면 프록시의 쿠키 중계가 끊겨도 로컬은 통과한다.** 백엔드는
      쿠키가 없으면 AUTH_010 으로 거부하므로, 그 조건을 mock 도 같이 들고 있어야
      "로컬은 되는데 실서버만 막힌다" 가 생기지 않는다.
    */
    const { code, state } = issued('kakao')

    const result = login('kakao', code, state, null)
    expect(result?.status).toBe(401)
    expect(result?.payload.dataHeader.resultCode).toBe('AUTH_010')
    // 거부됐으니 state 는 소비되지 않는다 — 다시 시도하면 통과해야 한다
    expect(login('kakao', code, state)?.status).toBe(200)
  })

  it('쿠키와 쿼리의 state 가 다르면 AUTH_010 이다 — 다른 브라우저에서 받아온 state 다', () => {
    const kakao = issued('kakao')
    const other = issued('kakao')

    const result = login('kakao', kakao.code, kakao.state, other.state)
    expect(result?.payload.dataHeader.resultCode).toBe('AUTH_010')
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

  /*
    **동의 검사는 신규 생성 직전에만 돈다** (#688 · 백엔드 `validateSignupConsent`).
    `kakao` 는 이미 가입된 `social@` 이라 동의가 비어도 통과해야 하고, `naver` 는 미가입
    이메일이라 자동 회원가입 경로로 빠져 거부된다. 이 대비가 깨지면 기존 회원의 소셜
    로그인이 동의 화면 없이는 불가능해진다.
  */
  it('기존 회원의 로그인은 동의가 비어도 통과한다', () => {
    const { code, state } = issued('kakao', '')

    expect(login('kakao', code, state)?.status).toBe(200)
  })

  it('문서 동의 없는 최초 연동은 400 MEMBER_010 이다', () => {
    const { code, state } = issued('naver', '?ageOver14Confirmed=true')
    const result = login('naver', code, state)

    expect(result?.status).toBe(400)
    expect(result?.payload.dataHeader.resultCode).toBe('MEMBER_010')
    // 거부됐으면 회원이 만들어지면 안 된다
    expect(mockStore().members.some((member) => member.provider === 'NAVER')).toBe(false)
  })

  it('만 14세 확인 없는 최초 연동은 400 MEMBER_011 이다 — MEMBER_010 과 코드를 나눈다', () => {
    const { code, state } = issued('naver', '?termsAgreed=true&privacyAgreed=true')
    const result = login('naver', code, state)

    expect(result?.status).toBe(400)
    expect(result?.payload.dataHeader.resultCode).toBe('MEMBER_011')
  })

  it('둘 다 비면 MEMBER_010 이 먼저 나간다 — 백엔드와 같은 순서다', () => {
    const { code, state } = issued('naver', '')

    expect(login('naver', code, state)?.payload.dataHeader.resultCode).toBe('MEMBER_010')
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
