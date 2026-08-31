import type { MockResult } from '@/lib/api/mock/auth-data'
import { memberIdOf, type MockMember, mockStore } from '@/lib/api/mock/store'
import { PASSWORD_PATTERN } from '@/lib/form/password-pattern'
import type { ApiResponse } from '@/types/api'
import type { MemberMyInfo } from '@/types/member'

/**
 * 회원(마이페이지) mock.
 *
 * **백엔드보다 느슨하거나 엄격해서는 안 된다** — 반려견 mock 과 같은 규칙이다.
 *
 * 근거: `MemberWebController` · `MemberMyInfoResponse` · `MemberMyInfoUpdateRequest` ·
 * `MemberPasswordChangeRequest` · `MemberPasswordSetupRequest` ·
 * `MemberProfileImageUploadResponse` · `MemberErrorCode` · `MemberValidationMessage` ·
 * `StorageErrorCode` 소스 실측. 계약 상세는 docs/features/member/공통명세.md.
 *
 * **프로필 이미지 업로드는 이 저장소 최초의 `multipart/form-data` 요청이다** (#79).
 * BFF 가 바이너리 본문을 `toMockBody` 로 걸러 **`body = null`** 로 넘기므로, 그 경로만
 * 본문을 보지 않고 **경로와 메서드로 판정**한다.
 *
 * **`/members/me/pets` 는 여기서 처리하지 않는다.** 경로가 겹치므로 `resolveMock` 이
 * 반려견 mock 을 먼저 본다 — 아래 `resolveMemberMock` 의 경로 판정 주석 참고.
 */

function ok<T>(dataBody: T): ApiResponse<T> {
  return { dataHeader: { success: true, resultCode: null, resultMessage: null }, dataBody }
}

function fail(status: number, resultCode: string, resultMessage: unknown): MockResult {
  return {
    status,
    payload: { dataHeader: { success: false, resultCode, resultMessage }, dataBody: null },
  }
}

/** Bean Validation 실패는 `{ message, errors: [...] }` 형태로 온다 — ValidationErrorSupport */
function failValidation(errors: { code: string; field: string; message: string }[]): MockResult {
  return fail(400, errors[0]?.code ?? 'MEMBER_100', {
    message: errors[0]?.message ?? '요청 값이 올바르지 않습니다.',
    errors,
  })
}

/**
 * 미인증. **`AuthErrorCode` 가 아니라 `SecurityErrorCode` 다** — 토큰이 없거나 유효하지
 * 않은 요청은 도메인에 닿기 전에 `OAuth2AuthenticationFailureHandler` 가 막는다.
 *
 * 기존 mock 들이 쓰던 `AUTH_011` 은 실제로 `OAUTH_PROFILE_REQUIRED` 이고 **400** 이다.
 * 401 과 짝지어 쓰면 mock 이 서버가 내지 않는 조합을 만들어 낸다 — 화면이 `resultCode`
 * 로 분기하기 시작하면 그때 어긋난다.
 */
const UNAUTHORIZED = (): MockResult => fail(401, 'SECURITY_001', '인증이 필요합니다.')
const NOT_FOUND = (): MockResult => fail(404, 'MEMBER_002', '존재하지 않는 회원입니다')

/**
 * 고정 오브젝트 키. **mock 은 파일을 저장하지 않는다** — 바이너리를 들고 있어 봐야
 * 화면이 확인할 것은 "업로드가 통과했고 URL 이 돌아온다" 뿐이다.
 */
const MOCK_OBJECT_KEY = 'members/profiles/mock/2026/08/3f2a9c11-0e4b-4a1f-9c3d-0b8e2f7a5d61.png'

/**
 * 로컬 MinIO 공개 주소. `application-local.yml` 의
 * `infra.storage.{public-url, bucket}` 을 그대로 옮긴 값이라 형태가 실제와 같다
 * (`http://localhost:9000` / `hondigagae-local`). dev·prod 는 `MINIO_PUBLIC_URL` 환경변수라
 * 소스에 실값이 없다 — 그래서 화면은 `next/image` 가 아니라 `<img>` 로 그린다
 * (공통명세 S3 의 이미지 호스트 문단).
 */
const MOCK_PROFILE_IMAGE_URL = `http://localhost:9000/hondigagae-local/${MOCK_OBJECT_KEY}`

/** `MemberMyInfoResponse.role` — CodeNameDescriptionMetadata. 서버가 표시명까지 준다 */
const USER_ROLE = { code: 'USER', name: '일반 회원', description: '일반 회원 권한입니다.' }

/**
 * 저장 형태 → 응답 DTO.
 *
 * **`hasPassword` 는 저장하지 않고 `password` 에서 파생시킨다.** 두 값을 따로 들면
 * 최초 설정·제거에서 한쪽만 고쳐졌을 때 mock 이 실제로는 불가능한 상태를 낸다.
 */
function toMyInfo(member: MockMember): MemberMyInfo {
  return {
    memberId: member.memberId,
    email: member.email,
    name: member.name,
    nickname: member.nickname,
    profileImageUrl: member.profileImageUrl,
    role: USER_ROLE,
    provider: member.provider,
    hasPassword: member.password !== null,
  }
}

function parseBody(body: string | null): Record<string, unknown> {
  if (body === null || body === '') return {}
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

/** `MemberMyInfoUpdateRequest` — @NotBlank(MEMBER_108) → @Size(max=10, MEMBER_109) */
function validateNickname(nickname: string): { code: string; field: string; message: string }[] {
  if (nickname.trim().length === 0) {
    return [{ code: 'MEMBER_108', field: 'nickname', message: '닉네임은 필수입니다.' }]
  }
  if (nickname.length > 10) {
    return [{ code: 'MEMBER_109', field: 'nickname', message: '닉네임은 10자 이하만 가능합니다.' }]
  }
  return []
}

/**
 * 새 비밀번호 — @NotBlank(MEMBER_112) → @Size(MEMBER_104) → @Pattern(MEMBER_105).
 *
 * **길이와 문자 구성은 각각 독립 제약이라 둘 다 어긋나면 오류도 둘이다.** 백엔드
 * `ValidationErrorSupport` 가 그렇게 내려주므로 여기서 하나로 합치면 안 된다.
 */
function validateNewPassword(
  newPassword: string,
): { code: string; field: string; message: string }[] {
  if (newPassword.length === 0) {
    return [{ code: 'MEMBER_112', field: 'newPassword', message: '새 비밀번호는 필수입니다.' }]
  }

  const errors: { code: string; field: string; message: string }[] = []
  if (newPassword.length < 8 || newPassword.length > 20) {
    errors.push({
      code: 'MEMBER_104',
      field: 'newPassword',
      message: '비밀번호는 8자 이상 20자 이하여야 합니다.',
    })
  }
  if (!PASSWORD_PATTERN.test(newPassword)) {
    errors.push({
      code: 'MEMBER_105',
      field: 'newPassword',
      message: '비밀번호는 공백 없이 영문자, 숫자, 특수문자를 각각 1자 이상 포함해야 합니다.',
    })
  }
  return errors
}

/**
 * 처리 대상이 아니면 null 을 반환해 호출부가 게이트웨이로 넘기게 한다.
 *
 * **`/members/me/pets*` 를 잡지 않는다.** `resolveMock` 이 반려견 mock 을 먼저 부르므로
 * 실제로 도달하지 않지만, 순서에 기대지 않고 여기서도 명시적으로 배제한다 —
 * 순서를 바꾸는 것만으로 반려견 목록이 404 가 되면 원인을 찾기 어렵다.
 */
export function resolveMemberMock(
  path: string,
  method: string,
  body: string | null,
  accessToken: string | null,
): MockResult | null {
  if (!path.startsWith('/members/me')) return null
  if (path === '/members/me/pets' || path.startsWith('/members/me/pets/')) return null

  // 마이페이지 엔드포인트는 모두 @PreAuthorize("isAuthenticated()") 다
  const memberId = memberIdOf(accessToken)
  if (memberId === null) return UNAUTHORIZED()

  const store = mockStore()
  const member = store.members.find((it) => it.memberId === memberId)
  if (member === undefined) return NOT_FOUND()

  if (path === '/members/me') {
    if (method === 'GET') return { status: 200, payload: ok(toMyInfo(member)) }
    if (method === 'PATCH') return updateMyInfo(member, parseBody(body))
    return null
  }

  /*
    프로필 이미지. **본문을 보지 않는다** — multipart 는 mock 계층에 `body = null` 로
    들어오므로 경로와 메서드만으로 판정한다.

    업로드와 삭제의 **응답 모양이 다르다**: 업로드는 `{key, url}` 뿐이고 삭제는 회원 정보
    전체다 (공통명세 S1). 화면의 캐시 갱신 방법이 갈리는 근거라 mock 도 그대로 재현한다.
  */
  if (path === '/members/me/profile-image') {
    if (method === 'POST') {
      member.profileImageUrl = MOCK_PROFILE_IMAGE_URL
      return {
        status: 200,
        payload: ok({
          profileImageKey: MOCK_OBJECT_KEY,
          profileImageUrl: MOCK_PROFILE_IMAGE_URL,
        }),
      }
    }
    if (method === 'DELETE') {
      member.profileImageUrl = null
      return { status: 200, payload: ok(toMyInfo(member)) }
    }
    return null
  }

  if (path === '/members/me/password') {
    if (method === 'POST') return changePassword(member, parseBody(body))
    if (method === 'DELETE') return removePassword(member)
    return null
  }

  if (path === '/members/me/password/setup' && method === 'POST') {
    return setupPassword(member, parseBody(body))
  }

  if (path === '/members/me/withdraw' && method === 'POST') {
    return withdraw(store.members, member)
  }

  return null
}

function updateMyInfo(member: MockMember, values: Record<string, unknown>): MockResult {
  const nickname = text(values.nickname)

  const errors = validateNickname(nickname)
  if (errors.length > 0) return failValidation(errors)

  member.nickname = nickname
  return { status: 200, payload: ok(toMyInfo(member)) }
}

/**
 * 비밀번호 변경. 성공하면 게이트웨이가 refresh 쿠키를 지운다 —
 * `refreshToken: ''` 이 그것을 흉내 낸다 (로그아웃 mock 과 같은 방식).
 * 이것이 없으면 "변경 후 재로그인" 흐름이 mock 에서만 성립하지 않는다.
 */
function changePassword(member: MockMember, values: Record<string, unknown>): MockResult {
  const currentPassword = text(values.currentPassword)
  const newPassword = text(values.newPassword)

  const errors: { code: string; field: string; message: string }[] = []
  if (currentPassword.length === 0) {
    errors.push({
      code: 'MEMBER_111',
      field: 'currentPassword',
      message: '현재 비밀번호는 필수입니다.',
    })
  }
  errors.push(...validateNewPassword(newPassword))
  if (errors.length > 0) return failValidation(errors)

  // 소셜 전용 계정은 확인할 현재 비밀번호가 없다 — 검증 400 이 아니라 도메인 400 이다
  if (member.password === null) {
    return fail(400, 'MEMBER_007', '소셜 로그인 계정은 비밀번호를 사용하지 않습니다.')
  }
  if (member.password !== currentPassword) {
    return fail(400, 'MEMBER_003', '비밀번호가 일치하지 않습니다.')
  }

  member.password = newPassword
  return { status: 200, payload: ok(null), refreshToken: '' }
}

/** 최초 설정. **refresh 쿠키를 지우지 않는다** — 로그인 수단이 늘어날 뿐이다 */
function setupPassword(member: MockMember, values: Record<string, unknown>): MockResult {
  const newPassword = text(values.newPassword)

  const errors = validateNewPassword(newPassword)
  if (errors.length > 0) return failValidation(errors)

  if (member.password !== null) {
    return fail(
      400,
      'MEMBER_008',
      '이미 비밀번호가 설정된 계정입니다. 비밀번호 변경을 이용해주세요.',
    )
  }

  member.password = newPassword
  return { status: 200, payload: ok(null) }
}

/** 소셜 전용 전환. 변경과 마찬가지로 게이트웨이가 refresh 쿠키를 지운다 */
function removePassword(member: MockMember): MockResult {
  // 마지막 로그인 수단 제거 방지 — 소셜이 없는 일반 계정은 비밀번호를 지울 수 없다
  if (member.provider === null) {
    return fail(400, 'MEMBER_009', '소셜 로그인이 연결된 계정만 비밀번호를 제거할 수 있습니다.')
  }
  if (member.password === null) {
    return fail(400, 'MEMBER_007', '소셜 로그인 계정은 비밀번호를 사용하지 않습니다.')
  }

  member.password = null
  return { status: 200, payload: ok(null), refreshToken: '' }
}

/**
 * 탈퇴. 백엔드는 개인정보를 마스킹하고 **같은 이메일로 재가입할 수 없게** 남긴다.
 * mock 은 목록에서 빼고 이메일만 소진시킨다 — 재가입 차단까지 흉내 내려면 별도
 * 탈퇴 이메일 목록이 필요한데, 화면이 그 분기를 그리지 않아 지금은 과하다.
 */
function withdraw(members: MockMember[], member: MockMember): MockResult {
  const index = members.indexOf(member)
  if (index >= 0) members.splice(index, 1)

  return { status: 200, payload: ok(null), refreshToken: '' }
}
