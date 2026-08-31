import { beforeEach, describe, expect, it } from 'vitest'

import { resolveMock } from '@/lib/api/mock'
import { mockStore, resetMockStore } from '@/lib/api/mock/store'
import type { Pet, PetList } from '@/types/pet'

const DEMO_TOKEN = 'mock-access-900000000000000001'
const OTHER_TOKEN = 'mock-access-900000000000000777'

const MY_PET = '123456789012000001'
const OTHERS_PET = '123456789012000099'

const validBody = {
  name: '두부',
  breed: '비숑',
  birthYm: '2020-03',
  sizeType: 'SMALL',
  heatSensitive: false,
  coldSensitive: false,
  noiseSensitive: false,
  activityLevel: 'MEDIUM',
  walkPreferred: true,
  sociality: 'MEDIUM',
}

function call(path: string, method: string, body: unknown, token: string | null = DEMO_TOKEN) {
  return resolveMock(path, method, '', body === null ? null : JSON.stringify(body), token)
}

function listBody(token: string | null = DEMO_TOKEN): PetList {
  const result = call('/members/me/pets', 'GET', null, token)
  return result?.payload.dataBody as PetList
}

function errorsOf(result: ReturnType<typeof call>): { code: string; field: string }[] {
  const message = result?.payload.dataHeader.resultMessage as {
    errors?: { code: string; field: string }[]
  }
  return message.errors ?? []
}

describe('반려견 mock — 인증', () => {
  beforeEach(resetMockStore)

  it('토큰이 없으면 401 이다 — 5개 엔드포인트가 모두 인증을 요구한다', () => {
    expect(call('/members/me/pets', 'GET', null, null)?.status).toBe(401)
    expect(call('/members/me/pets', 'POST', validBody, null)?.status).toBe(401)
    expect(call(`/members/me/pets/${MY_PET}`, 'GET', null, null)?.status).toBe(401)
    expect(call(`/members/me/pets/${MY_PET}`, 'PUT', validBody, null)?.status).toBe(401)
    expect(call(`/members/me/pets/${MY_PET}`, 'DELETE', null, null)?.status).toBe(401)
  })

  it('형식이 다른 토큰도 401 이다', () => {
    expect(call('/members/me/pets', 'GET', null, 'garbage')?.status).toBe(401)
  })

  it('재발급된 토큰도 같은 회원으로 인정한다', () => {
    const result = call('/members/me/pets', 'GET', null, `${DEMO_TOKEN}-reissued`)

    expect(result?.status).toBe(200)
  })
})

describe('반려견 mock — 목록', () => {
  beforeEach(resetMockStore)

  it('본인 반려견만 내려준다', () => {
    const body = listBody()

    expect(body.totalCount).toBe(2)
    expect(body.pets.map((pet) => pet.petId)).not.toContain(OTHERS_PET)
  })

  it('SliceResponse 가 아니다 — hasNext / contents 가 없다', () => {
    const body = listBody() as unknown as Record<string, unknown>

    expect(body.hasNext).toBeUndefined()
    expect(body.contents).toBeUndefined()
  })

  it('enum 을 metadata 객체로 내려준다 — 요청의 code 문자열이 아니다', () => {
    const pet = listBody().pets[0] as Pet

    expect(pet.sizeType).toEqual({
      code: 'SMALL',
      name: '소형견',
      description: '체중 10kg 미만',
    })
  })

  it('birthYm 이 없으면 age 도 null 이다', () => {
    const pet = listBody().pets.find((candidate) => candidate.birthYm === null)

    expect(pet?.age).toBeNull()
  })

  it('birthYm 이 있으면 age 를 계산해 내려준다 — FE 가 계산하지 않는다', () => {
    const pet = listBody().pets.find((candidate) => candidate.birthYm === '2017-05')

    expect(typeof pet?.age).toBe('number')
    expect(pet?.age).toBeGreaterThan(0)
  })
})

describe('반려견 mock — 소유권과 경로', () => {
  beforeEach(resetMockStore)

  it('남의 반려견은 404 다 — 403 이 아니다', () => {
    const result = call(`/members/me/pets/${OTHERS_PET}`, 'GET', null)

    expect(result?.status).toBe(404)
    expect(result?.payload.dataHeader.resultCode).toBe('PET_001')
  })

  it('없는 반려견도 같은 404 다 — 존재 여부가 구분되지 않는다', () => {
    const result = call('/members/me/pets/123456789012999999', 'GET', null)

    expect(result?.status).toBe(404)
    expect(result?.payload.dataHeader.resultCode).toBe('PET_001')
  })

  it('숫자가 아닌 petId 는 404 가 아니라 400 이다 — @PathVariable long', () => {
    const result = call('/members/me/pets/abc', 'GET', null)

    expect(result?.status).toBe(400)
    expect(result?.payload.dataHeader.resultCode).toBe('PET_113')
  })

  it('반려견 경로가 아니면 null 을 반환해 게이트웨이로 넘긴다', () => {
    // `/members/me` 는 마이페이지 mock 이 처리하므로 예시로 쓸 수 없다 (#83).
    // mock 이 다루지 않는 경로여야 이 단언이 의미를 갖는다
    expect(resolveMock('/members/me/sessions', 'GET', '', null, DEMO_TOKEN)).toBeNull()
  })
})

describe('반려견 mock — 검증 (백엔드 제약 재현)', () => {
  beforeEach(resetMockStore)

  it('빈 birthYm 은 PET_104 다 — @Pattern 은 null 만 유효로 본다', () => {
    const result = call('/members/me/pets', 'POST', { ...validBody, birthYm: '' })

    expect(result?.status).toBe(400)
    expect(errorsOf(result)).toEqual([
      expect.objectContaining({ code: 'PET_104', field: 'birthYm' }),
    ])
  })

  it('birthYm 을 아예 빼면 통과한다 — null 과 같다', () => {
    const withoutBirthYm: Record<string, unknown> = { ...validBody }
    delete withoutBirthYm.birthYm

    const result = call('/members/me/pets', 'POST', withoutBirthYm)

    expect(result?.status).toBe(200)
  })

  it('빈 breed 는 통과한다 — @Size(max=50) 뿐이라 birthYm 과 동작이 다르다', () => {
    const result = call('/members/me/pets', 'POST', { ...validBody, breed: '' })

    expect(result?.status).toBe(200)
  })

  it('13월은 PET_104 다', () => {
    const result = call('/members/me/pets', 'POST', { ...validBody, birthYm: '2020-13' })

    expect(errorsOf(result)).toEqual([
      expect.objectContaining({ code: 'PET_104', field: 'birthYm' }),
    ])
  })

  it('이름이 비면 PET_101 이다', () => {
    const result = call('/members/me/pets', 'POST', { ...validBody, name: '  ' })

    expect(errorsOf(result)).toEqual([expect.objectContaining({ code: 'PET_101', field: 'name' })])
  })

  it('이름이 21자면 PET_102 다', () => {
    const result = call('/members/me/pets', 'POST', { ...validBody, name: 'ㄱ'.repeat(21) })

    expect(errorsOf(result)).toEqual([expect.objectContaining({ code: 'PET_102', field: 'name' })])
  })

  it('품종이 51자면 PET_103 이다', () => {
    const result = call('/members/me/pets', 'POST', { ...validBody, breed: 'ㄱ'.repeat(51) })

    expect(errorsOf(result)).toEqual([expect.objectContaining({ code: 'PET_103', field: 'breed' })])
  })

  it('알 수 없는 enum 은 필수 오류로 본다 (PET_105 / 106 / 107)', () => {
    const result = call('/members/me/pets', 'POST', {
      ...validBody,
      sizeType: 'GIANT',
      activityLevel: null,
      sociality: 'EXTREME',
    })

    expect(errorsOf(result).map((error) => error.code)).toEqual(['PET_105', 'PET_106', 'PET_107'])
  })

  it('오류가 여러 개면 DTO 선언 순서로 정렬한다 — FE 는 필드별 첫 오류만 채택한다', () => {
    const result = call('/members/me/pets', 'POST', {
      ...validBody,
      name: '',
      birthYm: '',
      sizeType: 'GIANT',
    })

    expect(errorsOf(result).map((error) => error.field)).toEqual(['name', 'birthYm', 'sizeType'])
  })
})

describe('반려견 mock — 등록 상한', () => {
  beforeEach(resetMockStore)

  it('5마리를 넘기면 PET_002 이고 상태는 400 이다 — 409 가 아니다', () => {
    for (let index = 0; index < 3; index += 1) {
      expect(call('/members/me/pets', 'POST', { ...validBody, name: `개${index}` })?.status).toBe(
        200,
      )
    }

    const overflow = call('/members/me/pets', 'POST', { ...validBody, name: '여섯번째' })

    expect(overflow?.status).toBe(400)
    expect(overflow?.payload.dataHeader.resultCode).toBe('PET_002')
  })

  it('상한 검사가 검증보다 먼저다 — 잘못된 본문이어도 PET_002 가 온다', () => {
    for (let index = 0; index < 3; index += 1) {
      call('/members/me/pets', 'POST', { ...validBody, name: `개${index}` })
    }

    const overflow = call('/members/me/pets', 'POST', { ...validBody, name: '' })

    expect(overflow?.payload.dataHeader.resultCode).toBe('PET_002')
  })

  it('삭제한 반려견은 상한에서 빠진다', () => {
    for (let index = 0; index < 3; index += 1) {
      call('/members/me/pets', 'POST', { ...validBody, name: `개${index}` })
    }
    expect(call('/members/me/pets', 'POST', validBody)?.payload.dataHeader.resultCode).toBe(
      'PET_002',
    )

    call(`/members/me/pets/${MY_PET}`, 'DELETE', null)

    expect(call('/members/me/pets', 'POST', { ...validBody, name: '빈자리' })?.status).toBe(200)
  })
})

describe('반려견 mock — 등록 / 수정 / 삭제', () => {
  beforeEach(resetMockStore)

  it('등록하면 petId 가 매번 달라진다 — 정밀도 손상 없이 증가한다', () => {
    const first = call('/members/me/pets', 'POST', { ...validBody, name: '하나' })
    const second = call('/members/me/pets', 'POST', { ...validBody, name: '둘' })

    const firstId = (first?.payload.dataBody as Pet).petId
    const secondId = (second?.payload.dataBody as Pet).petId

    expect(firstId).not.toBe(secondId)
  })

  it('등록한 반려견이 목록에 나타난다', () => {
    call('/members/me/pets', 'POST', { ...validBody, name: '두부' })

    expect(listBody().pets.map((pet) => pet.name)).toContain('두부')
  })

  it('수정은 통째로 덮어쓴다 — PUT 은 부분 수정이 아니다', () => {
    const result = call(`/members/me/pets/${MY_PET}`, 'PUT', {
      ...validBody,
      name: '몽실이',
      breed: '푸들',
    })
    const updated = result?.payload.dataBody as Pet

    expect(updated.breed).toBe('푸들')
    // 원래 heatSensitive 는 true 였다. 본문의 false 로 덮인다
    expect(updated.heatSensitive).toBe(false)
  })

  it('남의 반려견은 수정도 404 다', () => {
    expect(call(`/members/me/pets/${OTHERS_PET}`, 'PUT', validBody)?.status).toBe(404)
  })

  it('삭제는 소프트 삭제다 — 행이 남고 목록에서만 빠진다', () => {
    call(`/members/me/pets/${MY_PET}`, 'DELETE', null)

    expect(listBody().totalCount).toBe(1)
    expect(mockStore().pets.find((pet) => pet.petId === MY_PET)?.deleted).toBe(true)
  })

  it('삭제 응답은 dataBody 가 null 이다 — unwrapVoid 대상', () => {
    const result = call(`/members/me/pets/${MY_PET}`, 'DELETE', null)

    expect(result?.status).toBe(200)
    expect(result?.payload.dataBody).toBeNull()
  })

  it('삭제한 반려견은 다시 조회하면 404 다', () => {
    call(`/members/me/pets/${MY_PET}`, 'DELETE', null)

    expect(call(`/members/me/pets/${MY_PET}`, 'GET', null)?.status).toBe(404)
  })

  it('다른 회원은 자기 반려견만 본다', () => {
    const body = listBody(OTHER_TOKEN)

    expect(body.totalCount).toBe(1)
    expect(body.pets[0]?.name).toBe('남의개')
  })
})
