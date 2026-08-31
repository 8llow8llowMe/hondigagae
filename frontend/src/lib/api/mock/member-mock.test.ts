import { beforeEach, describe, expect, it } from 'vitest'

import { resolveMock } from '@/lib/api/mock'
import { resetMockStore } from '@/lib/api/mock/store'

const DEMO_TOKEN = 'mock-access-900000000000000001'

const UPLOAD_PATH = '/members/me/profile-image'

/**
 * 프로필 이미지 업로드는 multipart 다. BFF 가 바이너리 본문을 `toMockBody` 로 걸러
 * **`body = null`** 로 넘긴다 — 그 상태 그대로 부른다.
 */
function upload(token: string | null = DEMO_TOKEN) {
  return resolveMock(UPLOAD_PATH, 'POST', '', null, token)
}

describe('프로필 이미지 업로드 mock', () => {
  beforeEach(resetMockStore)

  it('본문이 null 이어도 처리한다 — multipart 는 경로와 메서드로 판정한다', () => {
    const result = upload()

    expect(result?.status).toBe(200)
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

  it('파일을 저장하지 않으므로 두 번 올려도 같은 응답이다', () => {
    expect(upload()?.payload.dataBody).toEqual(upload()?.payload.dataBody)
  })

  it('토큰이 없으면 401 이다 — 컨트롤러가 isAuthenticated() 를 건다', () => {
    const result = upload(null)

    expect(result?.status).toBe(401)
    expect(result?.payload.dataHeader.resultCode).toBe('AUTH_011')
  })

  it('GET 은 처리하지 않는다 — 게이트웨이로 넘어가야 한다', () => {
    expect(resolveMock(UPLOAD_PATH, 'GET', '', null, DEMO_TOKEN)).toBeNull()
  })

  it('삭제는 아직 mock 에 없다 — 마이페이지 이슈에서 붙인다', () => {
    expect(resolveMock(UPLOAD_PATH, 'DELETE', '', null, DEMO_TOKEN)).toBeNull()
  })

  it('/members/me/pets 를 가로채지 않는다 — 경로가 정확히 일치할 때만 응답한다', () => {
    const pets = resolveMock('/members/me/pets', 'GET', '', null, DEMO_TOKEN)

    expect(pets?.status).toBe(200)
    expect(pets?.payload.dataBody).toHaveProperty('pets')
  })
})
