import { mockStore, nextMemberId } from '@/lib/api/mock/store'
import type { ApiResponse } from '@/types/api'

/**
 * 인증 mock.
 *
 * 근거: `AuthWebController` · `MemberWebController` · `AuthErrorCode` ·
 * `MemberErrorCode` · `MemberValidationMessage` · `ValidationErrorSupport` 소스 실측
 * (origin/develop, 2026-08-27). **없는 API 를 만들지 않는다.**
 */

export type MockResult = {
  status: number
  payload: ApiResponse<unknown>
  /** 게이트웨이의 Set-Cookie 를 대신한다. 없으면 BFF 세션의 refresh 가 비어 재발급이 안 돈다 */
  refreshToken?: string
}

/** 개발용 고정 인증코드. 백엔드 예시(A3K7MP2X)와 같은 8자 영숫자 형태다 */
export const MOCK_EMAIL_CODE = 'A3K7MP2X'

function ok<T>(dataBody: T): ApiResponse<T> {
  return { dataHeader: { success: true, resultCode: null, resultMessage: null }, dataBody }
}

function fail(status: number, resultCode: string, resultMessage: unknown): MockResult {
  return {
    status,
    payload: { dataHeader: { success: false, resultCode, resultMessage }, dataBody: null },
  }
}

type FieldError = { code: string; field: string; message: string }

/** 백엔드 ValidationErrorBody 형태로 만든다 — 첫 오류가 대표 메시지다 */
function failValidation(errors: FieldError[]): MockResult {
  const first = errors[0]
  if (first === undefined) return fail(400, 'MEMBER_100', '요청 값이 올바르지 않습니다.')
  return fail(400, first.code, { message: first.message, errors })
}

function parse(body: string | null): Record<string, unknown> {
  if (body === null || body.length === 0) return {}
  try {
    const parsed: unknown = JSON.parse(body)
    return parsed !== null && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {}
  } catch {
    return {}
  }
}

function text(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PASSWORD_PATTERN = /^(?=.*[A-Za-z])(?=.*\d)(?=.*[!@#$%^&*()\-_=+[\]{};:'",.<>/?\\|])\S+$/

/** 백엔드 정렬 순서를 흉내 낸다: DTO 선언 순서 → 필수 → 길이 → 형식 */
function validateSignup(values: Record<string, unknown>): FieldError[] {
  const errors: FieldError[] = []
  const email = text(values.email)
  const password = text(values.password)
  const name = text(values.name)
  const nickname = text(values.nickname)

  if (email.length === 0)
    errors.push({ code: 'MEMBER_101', field: 'email', message: '이메일은 필수입니다.' })
  else if (!EMAIL_PATTERN.test(email))
    errors.push({ code: 'MEMBER_102', field: 'email', message: '이메일 형식이 올바르지 않습니다.' })

  if (password.length === 0)
    errors.push({ code: 'MEMBER_103', field: 'password', message: '비밀번호는 필수입니다.' })
  else {
    if (password.length < 8 || password.length > 20)
      errors.push({
        code: 'MEMBER_104',
        field: 'password',
        message: '비밀번호는 8자 이상 20자 이하여야 합니다.',
      })
    if (!PASSWORD_PATTERN.test(password))
      errors.push({
        code: 'MEMBER_105',
        field: 'password',
        message: '비밀번호는 공백 없이 영문자, 숫자, 특수문자를 각각 1자 이상 포함해야 합니다.',
      })
  }

  if (name.length === 0)
    errors.push({ code: 'MEMBER_106', field: 'name', message: '이름은 필수입니다.' })
  else if (name.length > 10)
    errors.push({ code: 'MEMBER_107', field: 'name', message: '이름은 10자 이하만 가능합니다.' })

  if (nickname.length === 0)
    errors.push({ code: 'MEMBER_108', field: 'nickname', message: '닉네임은 필수입니다.' })
  else if (nickname.length > 10)
    errors.push({
      code: 'MEMBER_109',
      field: 'nickname',
      message: '닉네임은 10자 이하만 가능합니다.',
    })

  return errors
}

/** 처리 대상이 아니면 null 을 반환해 호출부가 게이트웨이로 넘기게 한다 */
export function resolveAuthMock(
  path: string,
  method: string,
  body: string | null,
): MockResult | null {
  const store = mockStore()

  if (path === '/auth/login' && method === 'POST') {
    const values = parse(body)
    const email = text(values.email)
    const password = text(values.password)
    const member = store.members.find((it) => it.email === email && it.password === password)

    // 미존재와 비밀번호 불일치를 하나의 응답으로 합친다 — 계정 열거 방지 (AuthErrorCode 주석)
    if (member === undefined) {
      return fail(401, 'AUTH_006', '이메일 또는 비밀번호가 올바르지 않습니다.')
    }

    return {
      status: 200,
      payload: ok({ accessToken: `mock-access-${member.memberId}`, memberId: member.memberId }),
      refreshToken: `mock-refresh-${member.memberId}`,
    }
  }

  if (path === '/auth/logout' && method === 'POST') {
    // 게이트웨이는 빈 값으로 쿠키를 지운다. BFF 가 '' 을 보고 세션을 비운다
    return { status: 200, payload: ok(null), refreshToken: '' }
  }

  if (path === '/auth/token/reissue' && method === 'POST') {
    const member = store.members[0]
    if (member === undefined) return fail(401, 'AUTH_002', '유효하지 않은 Refresh Token입니다.')
    return {
      status: 200,
      payload: ok({
        accessToken: `mock-access-${member.memberId}-reissued`,
        memberId: member.memberId,
      }),
      refreshToken: `mock-refresh-${member.memberId}`,
    }
  }

  if (path === '/auth/email/send-code' && method === 'POST') {
    const email = text(parse(body).email)

    // AuthValidationMessage 순서: 필수 → 형식 (AuthEmailCodeSendRequest 의 @NotBlank / @Email)
    if (email.length === 0) {
      return failValidation([{ code: 'AUTH_101', field: 'email', message: '이메일은 필수입니다.' }])
    }
    if (!EMAIL_PATTERN.test(email)) {
      return failValidation([
        { code: 'AUTH_102', field: 'email', message: '이메일 형식이 올바르지 않습니다.' },
      ])
    }
    // 가입 여부와 무관하게 항상 성공한다 — 계정 열거 방지
    store.pendingEmails.add(email)
    return { status: 200, payload: ok(null) }
  }

  if (path === '/auth/email/verify-code' && method === 'POST') {
    const values = parse(body)
    const email = text(values.email)
    const code = text(values.code)

    // AuthValidationMessage 순서: DTO 선언 순서(email → code) → 필수 → 형식.
    // pendingEmails 조회보다 먼저 온다 — 공란 입력이 AUTH_005/AUTH_004 로 잘못 떨어지면 안 된다
    if (email.length === 0) {
      return failValidation([{ code: 'AUTH_101', field: 'email', message: '이메일은 필수입니다.' }])
    }
    if (!EMAIL_PATTERN.test(email)) {
      return failValidation([
        { code: 'AUTH_102', field: 'email', message: '이메일 형식이 올바르지 않습니다.' },
      ])
    }
    if (code.length === 0) {
      return failValidation([
        { code: 'AUTH_104', field: 'code', message: '인증코드는 필수입니다.' },
      ])
    }

    if (!store.pendingEmails.has(email)) {
      return fail(
        400,
        'AUTH_005',
        '인증코드가 만료되었거나 발급되지 않았습니다. 다시 요청해주세요.',
      )
    }
    if (code !== MOCK_EMAIL_CODE) {
      return fail(400, 'AUTH_004', '인증코드가 일치하지 않습니다.')
    }

    store.verifiedEmails.add(email)
    return { status: 200, payload: ok(null) }
  }

  if (path === '/members/signup' && method === 'POST') {
    const values = parse(body)
    const errors = validateSignup(values)
    if (errors.length > 0) return failValidation(errors)

    const email = text(values.email)
    if (!store.verifiedEmails.has(email)) {
      return fail(
        400,
        'MEMBER_006',
        '이메일 인증이 완료되지 않았습니다. 인증 후 다시 시도해주세요.',
      )
    }
    if (store.members.some((it) => it.email === email)) {
      return fail(409, 'MEMBER_001', `이미 가입된 이메일 (${email})입니다.`)
    }

    store.members.push({
      memberId: nextMemberId(store),
      email,
      password: text(values.password),
      name: text(values.name),
      nickname: text(values.nickname),
    })
    store.verifiedEmails.delete(email)
    return { status: 200, payload: ok(null) }
  }

  return null
}
