import { beforeEach, describe, expect, it } from 'vitest'

import { resolveMock } from '@/lib/api/mock'
import { MAX_PASSWORD_RESET_FAILURES, MOCK_PASSWORD_RESET_CODE } from '@/lib/api/mock/auth-data'
import { mockStore, resetMockStore } from '@/lib/api/mock/store'

/**
 * 비밀번호 재설정 mock — 백엔드 `PasswordResetProcessor` 계약 재현.
 *
 * **mock 이 백엔드보다 느슨하거나 엄격하면 안 된다.** 특히 계정 열거 방지는 mock 이
 * 어기면 화면의 위반을 잡을 수 없다 — mock 이 404 를 내면 화면은 그저 그것을 보여줄 뿐이다.
 */

/** 일반 계정 (비밀번호 있음) — 코드가 실제로 발급된다 */
const GENERAL_EMAIL = 'demo@hondigagae.dev'
/** 소셜 전용 (비밀번호 없음) — 응답은 성공이지만 코드는 발급되지 않는다 */
const SOCIAL_ONLY_EMAIL = 'social@hondigagae.dev'
const UNKNOWN_EMAIL = 'nobody@hondigagae.dev'

const NEW_PASSWORD = 'newPassword456!'

function sendCode(email: string) {
  return resolveMock('/auth/password/reset/send-code', 'POST', '', JSON.stringify({ email }))
}

function reset(email: string, code: string, newPassword = NEW_PASSWORD) {
  return resolveMock(
    '/auth/password/reset',
    'POST',
    '',
    JSON.stringify({ email, code, newPassword }),
  )
}

beforeEach(resetMockStore)

describe('POST /auth/password/reset/send-code', () => {
  it('미가입 이메일도 200 이다 — 응답으로 계정 존재를 알려주지 않는다', () => {
    const known = sendCode(GENERAL_EMAIL)
    const unknown = sendCode(UNKNOWN_EMAIL)

    expect(known?.status).toBe(200)
    expect(unknown?.status).toBe(200)
    // dataHeader 까지 동일해야 한다 — 한 글자라도 다르면 그것이 열거 신호다
    expect(unknown?.payload.dataHeader).toEqual(known?.payload.dataHeader)
  })

  it('소셜 전용 계정도 200 이지만 코드는 발급되지 않는다', () => {
    // 백엔드는 이 계정에 코드가 아니라 "소셜 로그인을 이용해 주세요" 안내 메일을 보낸다
    expect(sendCode(SOCIAL_ONLY_EMAIL)?.status).toBe(200)
    expect(mockStore().passwordResetCodes.has(SOCIAL_ONLY_EMAIL)).toBe(false)

    // 그래서 뒤이은 재설정은 AUTH_005 다 — 여기서도 "비밀번호가 없는 계정" 이라고 말하지 않는다
    const result = reset(SOCIAL_ONLY_EMAIL, MOCK_PASSWORD_RESET_CODE)
    expect(result?.status).toBe(400)
    expect(result?.payload.dataHeader.resultCode).toBe('AUTH_005')
  })

  it('일반 계정에는 코드가 발급된다', () => {
    sendCode(GENERAL_EMAIL)

    expect(mockStore().passwordResetCodes.get(GENERAL_EMAIL)?.code).toBe(MOCK_PASSWORD_RESET_CODE)
  })

  it('공란 이메일은 400 AUTH_101, 형식 오류는 400 AUTH_102 다', () => {
    expect(sendCode('')?.payload.dataHeader.resultCode).toBe('AUTH_101')
    expect(sendCode('not-an-email')?.payload.dataHeader.resultCode).toBe('AUTH_102')
  })

  it('재발송하면 실패 카운터가 초기화된다 — 백엔드 clearVerifyFailures', () => {
    sendCode(GENERAL_EMAIL)
    reset(GENERAL_EMAIL, 'WRONGCODE')
    expect(mockStore().passwordResetCodes.get(GENERAL_EMAIL)?.attempts).toBe(1)

    sendCode(GENERAL_EMAIL)
    expect(mockStore().passwordResetCodes.get(GENERAL_EMAIL)?.attempts).toBe(0)
  })
})

describe('POST /auth/password/reset', () => {
  it('발급되지 않은 이메일은 400 AUTH_005 다', () => {
    const result = reset(UNKNOWN_EMAIL, MOCK_PASSWORD_RESET_CODE)

    expect(result?.status).toBe(400)
    expect(result?.payload.dataHeader.resultCode).toBe('AUTH_005')
  })

  it('코드가 맞으면 비밀번호가 바뀌고 새 비밀번호로 로그인된다', () => {
    sendCode(GENERAL_EMAIL)
    expect(reset(GENERAL_EMAIL, MOCK_PASSWORD_RESET_CODE)?.status).toBe(200)

    const login = resolveMock(
      '/auth/login',
      'POST',
      '',
      JSON.stringify({ email: GENERAL_EMAIL, password: NEW_PASSWORD }),
    )
    expect(login?.status).toBe(200)
  })

  it('성공 응답에 refreshToken 이 없다 — 이 엔드포인트는 Set-Cookie 를 싣지 않는다', () => {
    /*
      **비밀번호 *변경*(`MemberWebController`)과 헷갈리면 안 된다.** 그쪽은
      `clearRefreshCookie()` 를 싣고 화면이 세션을 끊어야 하지만, 재설정은
      `AuthWebController.resetPassword` 가 쿠키 헤더를 붙이지 않는다 (소스 실측).
      전 기기 무효화는 서버 안에서만 일어난다.
    */
    sendCode(GENERAL_EMAIL)

    expect(reset(GENERAL_EMAIL, MOCK_PASSWORD_RESET_CODE)?.refreshToken).toBeUndefined()
  })

  it('코드가 소비돼 같은 코드를 두 번 쓸 수 없다', () => {
    sendCode(GENERAL_EMAIL)
    reset(GENERAL_EMAIL, MOCK_PASSWORD_RESET_CODE)

    const again = reset(GENERAL_EMAIL, MOCK_PASSWORD_RESET_CODE)
    expect(again?.payload.dataHeader.resultCode).toBe('AUTH_005')
  })

  it('불일치는 AUTH_004, 5번째에서 AUTH_017 로 코드가 무효화된다', () => {
    sendCode(GENERAL_EMAIL)

    // 백엔드는 증가 후 `failures >= 5` 로 판정한다 — 4번째까지는 AUTH_004 다
    for (let attempt = 1; attempt < MAX_PASSWORD_RESET_FAILURES; attempt += 1) {
      expect(reset(GENERAL_EMAIL, 'WRONGCODE')?.payload.dataHeader.resultCode).toBe('AUTH_004')
    }

    const exceeded = reset(GENERAL_EMAIL, 'WRONGCODE')
    expect(exceeded?.status).toBe(400)
    expect(exceeded?.payload.dataHeader.resultCode).toBe('AUTH_017')

    // 코드가 사라졌으므로 이제 올바른 코드도 통하지 않는다
    expect(mockStore().passwordResetCodes.has(GENERAL_EMAIL)).toBe(false)
    expect(reset(GENERAL_EMAIL, MOCK_PASSWORD_RESET_CODE)?.payload.dataHeader.resultCode).toBe(
      'AUTH_005',
    )
  })

  it('회원가입 인증코드로는 통과하지 못한다 — 발급처가 다르다', () => {
    sendCode(GENERAL_EMAIL)

    // MOCK_EMAIL_CODE(회원가입)와 MOCK_PASSWORD_RESET_CODE 를 다르게 둔 이유가 이것이다
    expect(reset(GENERAL_EMAIL, 'A3K7MP2X')?.payload.dataHeader.resultCode).toBe('AUTH_004')
  })

  it('짧은 비밀번호는 newPassword 필드 오류(AUTH_107)다', () => {
    sendCode(GENERAL_EMAIL)
    const result = reset(GENERAL_EMAIL, MOCK_PASSWORD_RESET_CODE, 'short')

    expect(result?.status).toBe(400)
    const fieldErrors = result?.payload.dataHeader.fieldErrors ?? []
    // 필드명이 `newPassword` 여야 화면의 입력에 오류가 붙는다 (요청 DTO 와 같은 이름)
    expect(fieldErrors[0]?.field).toBe('newPassword')
    expect(fieldErrors[0]?.code).toBe('AUTH_107')
    // 대표 메시지는 문자열이다 — 객체를 실으면 화면에 [object Object] 가 나간다 (#491)
    expect(typeof result?.payload.dataHeader.resultMessage).toBe('string')
  })

  it('검증 실패는 코드 검증보다 먼저이고 DTO 선언 순서로 정렬된다', () => {
    // 백엔드도 @Valid 가 컨트롤러 진입 시점에 돌아 도메인 로직에 닿지 않는다.
    // `Ab1!` 은 구성은 맞고 길이만 모자라 newPassword 오류가 하나만 잡힌다
    sendCode(GENERAL_EMAIL)
    const result = reset(GENERAL_EMAIL, '', 'Ab1!')

    const fieldErrors = result?.payload.dataHeader.fieldErrors ?? []
    expect(fieldErrors.map((it) => it.field)).toEqual(['code', 'newPassword'])
    expect(fieldErrors.map((it) => it.code)).toEqual(['AUTH_104', 'AUTH_107'])
  })
})
