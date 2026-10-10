import { beforeEach, describe, expect, it } from 'vitest'

import { resolveMock } from '@/lib/api/mock'
import { resetMockStore } from '@/lib/api/mock/store'
import type { Pet } from '@/types/pet'

/** store 의 시드 회원(900000000000000001)에 대응하는 토큰 */
const TOKEN = 'mock-access-900000000000000001'
const PET_ID = '123456789012000001'
const OTHER_PET_ID = '123456789012000002'

function petOf(petId: string): Pet {
  const result = resolveMock(`/members/me/pets/${petId}`, 'GET', '', null, TOKEN)
  return result?.payload.dataBody as Pet
}

beforeEach(() => {
  resetMockStore()
})

describe('반려견 체중 — PetSaveRequest.weightKg', () => {
  it('응답에 체중이 실린다', () => {
    expect(petOf(PET_ID).weightKg).toBe(3.5)
  })

  it('체중을 모르는 아이는 null 이다 — 0 이 아니다', () => {
    expect(petOf(OTHER_PET_ID).weightKg).toBeNull()
  })

  it('범위를 벗어나면 400(PET_108) 이다', () => {
    const body = JSON.stringify({
      name: '몽실이',
      sizeType: 'SMALL',
      weightKg: 120,
      activityLevel: 'MEDIUM',
      sociality: 'HIGH',
    })
    const result = resolveMock('/members/me/pets', 'POST', '', body, TOKEN)

    expect(result?.status).toBe(400)
  })

  it('소수점 두 자리는 400(PET_109) 이다', () => {
    const body = JSON.stringify({
      name: '몽실이',
      sizeType: 'SMALL',
      weightKg: 3.55,
      activityLevel: 'MEDIUM',
      sociality: 'HIGH',
    })
    const result = resolveMock('/members/me/pets', 'POST', '', body, TOKEN)

    expect(result?.status).toBe(400)
  })

  it('체중을 빼도 통과한다 — 선택 필드다', () => {
    const body = JSON.stringify({
      name: '체중모름',
      sizeType: 'SMALL',
      activityLevel: 'MEDIUM',
      sociality: 'HIGH',
    })
    const result = resolveMock('/members/me/pets', 'POST', '', body, TOKEN)

    expect(result?.status).toBe(200)
    expect((result?.payload.dataBody as Pet).weightKg).toBeNull()
  })
})

describe('대표 반려견', () => {
  it('지정하면 기존 대표가 자동으로 내려간다 — 회원당 하나다', () => {
    expect(petOf(PET_ID).representative).toBe(true)
    expect(petOf(OTHER_PET_ID).representative).toBe(false)

    resolveMock(`/members/me/pets/${OTHER_PET_ID}/representative`, 'PUT', '', null, TOKEN)

    expect(petOf(PET_ID).representative).toBe(false)
    expect(petOf(OTHER_PET_ID).representative).toBe(true)
  })

  it('남의 반려견은 404 다 — 존재를 노출하지 않는다', () => {
    const result = resolveMock(
      '/members/me/pets/123456789012000099/representative',
      'PUT',
      '',
      null,
      TOKEN,
    )

    expect(result?.status).toBe(404)
  })
})

describe('반려견 사진', () => {
  it('업로드 응답은 키와 URL 뿐이다 — 삭제와 모양이 다르다', () => {
    const result = resolveMock(`/members/me/pets/${PET_ID}/profile-image`, 'POST', '', null, TOKEN)
    const body = result?.payload.dataBody as Record<string, unknown>

    expect(Object.keys(body).sort()).toEqual(['profileImageKey', 'profileImageUrl'])
  })

  it('업로드하면 이후 조회에 URL 이 실린다', () => {
    resolveMock(`/members/me/pets/${PET_ID}/profile-image`, 'POST', '', null, TOKEN)

    expect(petOf(PET_ID).profileImageUrl).not.toBeNull()
  })

  it('삭제 응답은 반려견 전체이고 URL 이 비워진다', () => {
    resolveMock(`/members/me/pets/${PET_ID}/profile-image`, 'POST', '', null, TOKEN)
    const result = resolveMock(
      `/members/me/pets/${PET_ID}/profile-image`,
      'DELETE',
      '',
      null,
      TOKEN,
    )

    expect((result?.payload.dataBody as Pet).profileImageUrl).toBeNull()
    expect((result?.payload.dataBody as Pet).petId).toBe(PET_ID)
  })

  it('PUT 으로 프로필을 통째로 덮어써도 사진은 남는다 — PetSaveRequest 밖의 필드다', () => {
    resolveMock(`/members/me/pets/${PET_ID}/profile-image`, 'POST', '', null, TOKEN)

    const body = JSON.stringify({
      name: '몽실이',
      sizeType: 'SMALL',
      activityLevel: 'MEDIUM',
      sociality: 'HIGH',
    })
    resolveMock(`/members/me/pets/${PET_ID}`, 'PUT', '', body, TOKEN)

    expect(petOf(PET_ID).profileImageUrl).not.toBeNull()
    expect(petOf(PET_ID).representative).toBe(true)
  })
})
