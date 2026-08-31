import { beforeEach, describe, expect, it } from 'vitest'

import { resolveMock } from '@/lib/api/mock'
import { mockStore, resetMockStore } from '@/lib/api/mock/store'
import type { MemberMyInfo } from '@/types/member'

/**
 * 마이페이지 mock — 백엔드 계약 재현.
 *
 * **mock 이 백엔드보다 느슨하거나 엄격하면 안 된다.** 반려견 mock 과 같은 규칙이다
 * (#24 최종 리뷰 I5).
 */

/** 일반 계정 (provider null + 비밀번호) */
const GENERAL = 'mock-access-900000000000000001'
/** 연결됨 (KAKAO + 비밀번호) */
const LINKED = 'mock-access-900000000000000002'
/** 소셜 전용 (KAKAO + 비밀번호 없음) */
const SOCIAL_ONLY = 'mock-access-900000000000000003'

function call(path: string, method: string, body: unknown, token: string | null = GENERAL) {
  return resolveMock(path, method, '', body === null ? null : JSON.stringify(body), token)
}

function myInfo(token: string): MemberMyInfo {
  const result = call('/members/me', 'GET', null, token)
  return result?.payload.dataBody as MemberMyInfo
}

beforeEach(resetMockStore)

describe('GET /members/me', () => {
  /**
   * **계정 상태 3종을 모두 낼 수 있어야 한다** (D7). 그러지 않으면 `/mypage/password` 의
   * 분기를 화면으로 확인할 방법이 없다.
   */
  it('일반 계정 — provider 가 null 이고 비밀번호가 있다', () => {
    const member = myInfo(GENERAL)

    expect(member.provider).toBeNull()
    expect(member.hasPassword).toBe(true)
  })

  it('연결됨 — provider 와 비밀번호가 둘 다 있다', () => {
    const member = myInfo(LINKED)

    expect(member.provider).toBe('KAKAO')
    expect(member.hasPassword).toBe(true)
  })

  it('소셜 전용 — provider 는 있고 비밀번호가 없다', () => {
    const member = myInfo(SOCIAL_ONLY)

    expect(member.provider).toBe('KAKAO')
    expect(member.hasPassword).toBe(false)
  })

  it('role 은 metadata 객체다 — 표시명을 서버가 준다', () => {
    expect(myInfo(GENERAL).role).toEqual({
      code: 'USER',
      name: '일반 회원',
      description: '일반 회원 권한입니다.',
    })
  })

  it('토큰이 없으면 401 이다 — 도메인이 아니라 security-core 가 막는다', () => {
    const result = call('/members/me', 'GET', null, null)

    expect(result?.status).toBe(401)
    expect(result?.payload.dataHeader.resultCode).toBe('SECURITY_001')
  })

  /** 경로가 겹친다 — `/members/me/pets` 가 회원 mock 에 잡히면 반려견 목록이 죽는다 */
  it('반려견 경로를 가로채지 않는다', () => {
    const result = call('/members/me/pets', 'GET', null)

    expect(result?.status).toBe(200)
    expect(result?.payload.dataBody).toHaveProperty('pets')
  })
})

describe('PATCH /members/me — 닉네임만 바꾼다', () => {
  it('닉네임을 바꾸고 회원 정보 전체를 돌려준다', () => {
    const result = call('/members/me', 'PATCH', { nickname: '새닉네임' })

    expect(result?.status).toBe(200)
    expect((result?.payload.dataBody as MemberMyInfo).nickname).toBe('새닉네임')
    expect(myInfo(GENERAL).nickname).toBe('새닉네임')
  })

  it('빈 닉네임은 MEMBER_108 이다', () => {
    const result = call('/members/me', 'PATCH', { nickname: '' })

    expect(result?.status).toBe(400)
    expect(result?.payload.dataHeader.resultCode).toBe('MEMBER_108')
  })

  it('10자를 넘으면 MEMBER_109 이다', () => {
    const result = call('/members/me', 'PATCH', { nickname: '가'.repeat(11) })

    expect(result?.status).toBe(400)
    expect(result?.payload.dataHeader.resultCode).toBe('MEMBER_109')
  })

  /** 필드 오류는 `{ message, errors: [...] }` 구조로 와야 폼이 필드에 매핑할 수 있다 */
  it('검증 실패는 필드별 구조로 온다', () => {
    const raw = call('/members/me', 'PATCH', { nickname: '' })?.payload.dataHeader.resultMessage

    expect(raw).toMatchObject({ errors: [{ field: 'nickname', code: 'MEMBER_108' }] })
  })
})

describe('POST /members/me/password — 변경', () => {
  it('현재 비밀번호가 맞으면 성공하고 refresh 쿠키를 지운다', () => {
    const result = call('/members/me/password', 'POST', {
      currentPassword: 'password123!',
      newPassword: 'newPassword456!',
    })

    expect(result?.status).toBe(200)
    // 게이트웨이가 clearRefreshCookie() 를 싣는다 — 재로그인이 필요하다는 신호다
    expect(result?.refreshToken).toBe('')
  })

  it('현재 비밀번호가 틀리면 MEMBER_003 이다', () => {
    const result = call('/members/me/password', 'POST', {
      currentPassword: 'wrong123!',
      newPassword: 'newPassword456!',
    })

    expect(result?.status).toBe(400)
    expect(result?.payload.dataHeader.resultCode).toBe('MEMBER_003')
  })

  it('소셜 전용 계정은 MEMBER_007 이다 — 확인할 현재 비밀번호가 없다', () => {
    const result = call(
      '/members/me/password',
      'POST',
      { currentPassword: 'anything1!', newPassword: 'newPassword456!' },
      SOCIAL_ONLY,
    )

    expect(result?.payload.dataHeader.resultCode).toBe('MEMBER_007')
  })

  it('새 비밀번호 형식이 어긋나면 검증 400 이다 — 도메인 오류보다 먼저다', () => {
    const result = call('/members/me/password', 'POST', {
      currentPassword: 'wrong-but-irrelevant',
      newPassword: 'short',
    })

    expect(result?.status).toBe(400)
    expect(result?.payload.dataHeader.resultCode).toBe('MEMBER_104')
  })
})

describe('POST /members/me/password/setup — 최초 설정', () => {
  it('비밀번호가 없는 계정에 설정하면 hasPassword 가 true 가 된다', () => {
    const result = call(
      '/members/me/password/setup',
      'POST',
      { newPassword: 'newPassword456!' },
      SOCIAL_ONLY,
    )

    expect(result?.status).toBe(200)
    expect(myInfo(SOCIAL_ONLY).hasPassword).toBe(true)
  })

  /** 로그인 수단이 늘어날 뿐이라 세션을 끊지 않는다 — 변경·제거와 다른 점이다 */
  it('refresh 쿠키를 지우지 않는다', () => {
    const result = call(
      '/members/me/password/setup',
      'POST',
      { newPassword: 'newPassword456!' },
      SOCIAL_ONLY,
    )

    expect(result?.refreshToken).toBeUndefined()
  })

  it('이미 비밀번호가 있으면 MEMBER_008 이다', () => {
    const result = call('/members/me/password/setup', 'POST', { newPassword: 'newPassword456!' })

    expect(result?.payload.dataHeader.resultCode).toBe('MEMBER_008')
  })
})

describe('DELETE /members/me/password — 소셜 전용 전환', () => {
  it('연결된 계정은 비밀번호를 지우고 refresh 쿠키를 지운다', () => {
    const result = call('/members/me/password', 'DELETE', null, LINKED)

    expect(result?.status).toBe(200)
    expect(result?.refreshToken).toBe('')
    expect(myInfo(LINKED).hasPassword).toBe(false)
  })

  /** 마지막 로그인 수단 제거 방지 — 일반 계정은 지울 수 없다 */
  it('일반 계정은 MEMBER_009 다', () => {
    const result = call('/members/me/password', 'DELETE', null, GENERAL)

    expect(result?.status).toBe(400)
    expect(result?.payload.dataHeader.resultCode).toBe('MEMBER_009')
  })

  it('이미 소셜 전용이면 MEMBER_007 이다', () => {
    const result = call('/members/me/password', 'DELETE', null, SOCIAL_ONLY)

    expect(result?.payload.dataHeader.resultCode).toBe('MEMBER_007')
  })

  /** 되돌릴 수 있다 — 전환 후 다시 최초 설정이 가능해야 한다 (공통명세 S2) */
  it('전환 후 다시 최초 설정할 수 있다', () => {
    call('/members/me/password', 'DELETE', null, LINKED)
    const result = call(
      '/members/me/password/setup',
      'POST',
      { newPassword: 'newPassword456!' },
      LINKED,
    )

    expect(result?.status).toBe(200)
    expect(myInfo(LINKED).hasPassword).toBe(true)
  })
})

describe('POST /members/me/withdraw', () => {
  it('본문 없이 성공하고 회원이 사라진다', () => {
    const result = call('/members/me/withdraw', 'POST', null)

    expect(result?.status).toBe(200)
    expect(result?.refreshToken).toBe('')
    expect(mockStore().members.some((it) => it.memberId === '900000000000000001')).toBe(false)
  })

  it('탈퇴한 회원의 토큰으로는 내 정보를 볼 수 없다', () => {
    call('/members/me/withdraw', 'POST', null)

    expect(call('/members/me', 'GET', null)?.status).toBe(404)
  })
})

/**
 * 프로필 이미지 — **이 저장소 최초의 multipart 경로다** (#79).
 *
 * BFF 가 바이너리 본문을 `toMockBody` 로 걸러 **`body = null`** 로 넘긴다. 그 상태
 * 그대로 부르는 것이 이 묶음의 핵심이다 — mock 이 본문을 파싱하려 들면 업로드가
 * mock 에서만 깨진다.
 */
describe('프로필 이미지', () => {
  const UPLOAD_PATH = '/members/me/profile-image'

  /** multipart 는 본문이 아니라 경로·메서드로 판정한다 */
  function upload(token: string | null = GENERAL) {
    return resolveMock(UPLOAD_PATH, 'POST', '', null, token)
  }

  it('본문이 null 이어도 처리한다 — multipart 는 경로와 메서드로 판정한다', () => {
    expect(upload()?.status).toBe(200)
  })

  it('오브젝트 키와 공개 URL 을 준다 — MemberProfileImageUploadResponse 그대로', () => {
    const body = upload()?.payload.dataBody as {
      profileImageKey: string
      profileImageUrl: string
    }

    expect(body.profileImageKey).toMatch(/^members\/profiles\//)
    expect(body.profileImageUrl).toContain(body.profileImageKey)
    expect(() => new URL(body.profileImageUrl)).not.toThrow()
  })

  it('업로드하면 내 정보의 profileImageUrl 이 바뀐다', () => {
    const uploaded = upload()?.payload.dataBody as { profileImageUrl: string }

    expect(myInfo(GENERAL).profileImageUrl).toBe(uploaded.profileImageUrl)
  })

  it('파일을 저장하지 않으므로 두 번 올려도 같은 응답이다', () => {
    expect(upload()?.payload.dataBody).toEqual(upload()?.payload.dataBody)
  })

  it('토큰이 없으면 401 이다 — 컨트롤러가 isAuthenticated() 를 건다', () => {
    const result = upload(null)

    expect(result?.status).toBe(401)
    expect(result?.payload.dataHeader.resultCode).toBe('SECURITY_001')
  })

  /**
   * **업로드와 삭제의 응답 모양이 다르다** (공통명세 S1). 업로드는 `{key, url}` 뿐이고
   * 삭제는 회원 정보 전체다 — 화면의 캐시 갱신 방법이 갈리는 근거다.
   */
  it('삭제는 회원 정보 전체를 돌려주고 profileImageUrl 이 null 이 된다', () => {
    upload()
    const result = call(UPLOAD_PATH, 'DELETE', null)

    expect(result?.status).toBe(200)
    expect((result?.payload.dataBody as MemberMyInfo).profileImageUrl).toBeNull()
    expect((result?.payload.dataBody as MemberMyInfo).email).toBe('demo@hondigagae.dev')
  })

  it('GET 은 처리하지 않는다 — 게이트웨이로 넘어가야 한다', () => {
    expect(resolveMock(UPLOAD_PATH, 'GET', '', null, GENERAL)).toBeNull()
  })
})
