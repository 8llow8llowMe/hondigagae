import { beforeEach, describe, expect, it } from 'vitest'

import { resolveMock } from '@/lib/api/mock'
import { MOCK_EMAIL_CODE } from '@/lib/api/mock/auth-data'
import { MOCK_PLACES } from '@/lib/api/mock/place-data'
import { mockStore, resetMockStore } from '@/lib/api/mock/store'
import type { SliceResponse } from '@/types/api'
import type { PlaceDetail, PlaceSummary } from '@/types/place'

function list(search: string) {
  const result = resolveMock('/places', 'GET', search, null)
  if (result === null) throw new Error('mock 이 경로를 처리하지 못했다')
  return result
}

function body(search: string): SliceResponse<PlaceSummary> {
  return list(search).payload.dataBody as SliceResponse<PlaceSummary>
}

describe('resolveMock — 처리 범위', () => {
  it('구현되지 않은 경로는 null 을 반환해 실제 게이트웨이로 넘긴다', () => {
    expect(resolveMock('/ai-plans', 'POST', '', '{}')).toBeNull()
  })

  it('일정은 보호 리소스라 토큰 없이는 401 이다 — null 로 넘기지 않는다 (이슈 #75)', () => {
    expect(resolveMock('/plans', 'GET', '', null)?.status).toBe(401)
  })

  it('긴급 시설은 mock 이 처리한다 (이슈 #13)', () => {
    const result = resolveMock('/emergencies/facilities', 'GET', '?lat=33.5&lng=126.5', null)

    expect(result?.status).toBe(200)
  })

  it('GET 이 아니면 장소 mock 은 처리하지 않는다', () => {
    expect(resolveMock('/places', 'POST', '', '{}')).toBeNull()
  })
})

describe('resolveMock — 목록 페이지네이션', () => {
  it('기본 size 는 20 이다', () => {
    expect(body('').contents).toHaveLength(20)
  })

  it('마지막 placeId 를 커서로 다음 페이지를 준다', () => {
    const first = body('size=5')
    const cursor = first.contents.at(-1)?.placeId ?? ''
    const second = body(`size=5&lastPlaceId=${cursor}`)

    expect(second.contents[0]?.placeId).not.toBe(first.contents[0]?.placeId)
    expect(first.contents.map((p) => p.placeId)).not.toContain(second.contents[0]?.placeId)
  })

  it('끝까지 가면 hasNext 가 false 다', () => {
    expect(body('size=50').hasNext).toBe(false)
  })

  it('size 가 허용 범위를 벗어나면 400 이다 (백엔드와 동일)', () => {
    expect(list('size=0').status).toBe(400)
    expect(list('size=51').status).toBe(400)
  })
})

describe('resolveMock — 필터', () => {
  it('contentType 으로 거른다', () => {
    const contents = body('contentType=RESTAURANT&size=50').contents

    expect(contents.length).toBeGreaterThan(0)
    expect(contents.every((p) => p.contentType.code === 'RESTAURANT')).toBe(true)
  })

  it('petAllowanceType 으로 거른다', () => {
    const contents = body('petAllowanceType=ALLOWED&size=50').contents

    expect(contents.every((p) => p.petAllowanceType.code === 'ALLOWED')).toBe(true)
  })

  it('indoor 정보가 없는 장소는 true/false 어느 쪽으로도 잡히지 않는다', () => {
    const unknown = MOCK_PLACES.filter((p) => p.indoor === null)
    expect(unknown.length).toBeGreaterThan(0)

    const indoorTrue = body('indoor=true&size=50').contents
    const indoorFalse = body('indoor=false&size=50').contents

    expect(indoorTrue.every((p) => p.indoor === true)).toBe(true)
    expect(indoorFalse.every((p) => p.indoor === false)).toBe(true)
  })

  it('조건에 맞는 결과가 없으면 빈 목록을 준다 (404 가 아니다)', () => {
    const result = list('contentType=FESTIVAL&size=50')

    expect(result.status).toBe(200)
    expect((result.payload.dataBody as SliceResponse<PlaceSummary>).contents).toHaveLength(0)
  })
})

describe('resolveMock — 상세', () => {
  function detail(placeId: string) {
    const result = resolveMock(`/places/${placeId}`, 'GET', '', null)
    if (result === null) throw new Error('mock 이 경로를 처리하지 못했다')
    return result
  }

  it('목록 타입이 아니라 상세 타입을 반환한다', () => {
    const id = MOCK_PLACES[0]?.placeId ?? ''
    const result = detail(id)
    const body = result.payload.dataBody as PlaceDetail

    expect(result.status).toBe(200)
    expect(body.placeId).toBe(id)
    // 목록(PlaceItem)에는 없고 상세(PlaceDetailResponse)에만 있는 필드다
    expect(body).toHaveProperty('overview')
    expect(body).toHaveProperty('images')
    expect(Array.isArray(body.images)).toBe(true)
  })

  it('없는 장소는 404 이고 백엔드와 같은 resultCode 를 쓴다', () => {
    const result = detail('999999999999999999')

    expect(result.status).toBe(404)
    expect(result.payload.dataHeader.success).toBe(false)
    expect(result.payload.dataHeader.resultCode).toBe('PLACE_002')
  })

  it('숫자가 아닌 placeId 는 404 가 아니라 400 이다 (@PathVariable long)', () => {
    const result = detail('abc')

    expect(result.status).toBe(400)
    expect(result.payload.dataHeader.resultCode).toBe('PLACE_113')
  })

  it('/places/nearby 는 상세가 아니다 — 실제 게이트웨이로 넘긴다', () => {
    expect(resolveMock('/places/nearby', 'GET', 'lat=33.5&lng=126.5', null)).toBeNull()
  })
})

describe('mock 상세 데이터 품질', () => {
  function detailOf(placeId: string): PlaceDetail {
    const result = resolveMock(`/places/${placeId}`, 'GET', '', null)
    return result?.payload.dataBody as PlaceDetail
  }

  const details = MOCK_PLACES.map((place) => detailOf(place.placeId))

  it('intro 가 통째로 없는 케이스를 포함한다 — 섹션 숨김이 기본 경로에 드러나야 한다', () => {
    expect(details.some((detail) => detail.intro === null)).toBe(true)
  })

  it('petInfo 가 통째로 없는 케이스를 포함한다', () => {
    expect(details.some((detail) => detail.petInfo === null)).toBe(true)
  })

  it('images 가 비어 있는 케이스를 포함하고, images 는 절대 null 이 아니다', () => {
    expect(details.some((detail) => detail.images.length === 0)).toBe(true)
    expect(details.every((detail) => Array.isArray(detail.images))).toBe(true)
  })

  it('homepage 에 HTML anchor 원문이 들어 있는 케이스를 포함한다', () => {
    expect(details.some((detail) => detail.homepage?.includes('<a ') === true)).toBe(true)
  })

  it('목록과 같은 장소를 보여준다 — 상세만 다른 장소면 개발 중에만 있는 착시가 생긴다', () => {
    const summary = MOCK_PLACES[0]
    if (summary === undefined) throw new Error('mock 데이터가 비어 있다')

    expect(detailOf(summary.placeId).title).toBe(summary.title)
  })
})

describe('mock 데이터 품질', () => {
  it('문자열 placeId 를 쓴다 (정밀도 손상 방지)', () => {
    expect(MOCK_PLACES.every((p) => typeof p.placeId === 'string')).toBe(true)
  })

  it('placeId 가 중복되지 않는다', () => {
    expect(new Set(MOCK_PLACES.map((p) => p.placeId)).size).toBe(MOCK_PLACES.length)
  })

  it('nullable 필드가 실제로 비어 있는 케이스를 포함한다', () => {
    expect(MOCK_PLACES.some((p) => p.addr1 === null)).toBe(true)
    expect(MOCK_PLACES.some((p) => p.tel === null)).toBe(true)
    expect(MOCK_PLACES.some((p) => p.indoor === null)).toBe(true)
    expect(MOCK_PLACES.every((p) => p.firstImage === null)).toBe(true)
  })

  it('좌표가 제주 범위 안에 있다', () => {
    expect(
      MOCK_PLACES.every(
        (p) =>
          p.lat !== null &&
          p.lng !== null &&
          p.lat > 33.1 &&
          p.lat < 33.6 &&
          p.lng > 126.1 &&
          p.lng < 126.9,
      ),
    ).toBe(true)
  })
})

describe('resolveMock — 인증', () => {
  beforeEach(resetMockStore)

  it('등록된 계정으로 로그인하면 accessToken 과 refreshToken 을 준다', () => {
    const result = resolveMock(
      '/auth/login',
      'POST',
      '',
      JSON.stringify({ email: 'demo@hondigagae.dev', password: 'password123!' }),
    )

    expect(result).not.toBeNull()
    expect(result?.status).toBe(200)
    const body = result?.payload.dataBody as { accessToken: string; memberId: string }
    expect(body.accessToken.length).toBeGreaterThan(0)
    expect(body.memberId).toBe('900000000000000001')
    // 이게 없으면 BFF 세션의 refresh 가 빈 문자열이 되어 재발급 흐름이 돌지 않는다
    expect(result?.refreshToken).toBeTruthy()
  })

  it('비밀번호가 틀리면 401 AUTH_006 이다', () => {
    const result = resolveMock(
      '/auth/login',
      'POST',
      '',
      JSON.stringify({ email: 'demo@hondigagae.dev', password: 'wrong-password' }),
    )

    expect(result?.status).toBe(401)
    expect(result?.payload.dataHeader.resultCode).toBe('AUTH_006')
  })

  it('없는 이메일도 같은 401 이다 — 계정 열거를 막는다', () => {
    const result = resolveMock(
      '/auth/login',
      'POST',
      '',
      JSON.stringify({ email: 'nobody@hondigagae.dev', password: 'password123!' }),
    )

    expect(result?.status).toBe(401)
    expect(result?.payload.dataHeader.resultCode).toBe('AUTH_006')
  })

  it('가입되지 않은 이메일도 인증코드 발송은 성공한다', () => {
    const result = resolveMock(
      '/auth/email/send-code',
      'POST',
      '',
      JSON.stringify({ email: 'new@hondigagae.dev' }),
    )

    expect(result?.status).toBe(200)
    expect(result?.payload.dataHeader.success).toBe(true)
  })

  it('틀린 인증코드는 400 AUTH_004 다', () => {
    resolveMock('/auth/email/send-code', 'POST', '', JSON.stringify({ email: 'x@hondigagae.dev' }))
    const result = resolveMock(
      '/auth/email/verify-code',
      'POST',
      '',
      JSON.stringify({ email: 'x@hondigagae.dev', code: 'WRONG123' }),
    )

    expect(result?.status).toBe(400)
    expect(result?.payload.dataHeader.resultCode).toBe('AUTH_004')
  })

  it('검증 없이 가입하면 400 MEMBER_006 이다', () => {
    const result = resolveMock(
      '/members/signup',
      'POST',
      '',
      JSON.stringify({
        email: 'unverified@hondigagae.dev',
        password: 'password123!',
        name: '홍길동',
        nickname: '길동짱',
      }),
    )

    expect(result?.status).toBe(400)
    expect(result?.payload.dataHeader.resultCode).toBe('MEMBER_006')
  })

  it('이미 가입된 이메일은 409 MEMBER_001 이다', () => {
    resolveMock(
      '/auth/email/send-code',
      'POST',
      '',
      JSON.stringify({ email: 'demo@hondigagae.dev' }),
    )
    resolveMock(
      '/auth/email/verify-code',
      'POST',
      '',
      JSON.stringify({ email: 'demo@hondigagae.dev', code: MOCK_EMAIL_CODE }),
    )
    const result = resolveMock(
      '/members/signup',
      'POST',
      '',
      JSON.stringify({
        email: 'demo@hondigagae.dev',
        password: 'password123!',
        name: '홍길동',
        nickname: '길동짱',
      }),
    )

    expect(result?.status).toBe(409)
    expect(result?.payload.dataHeader.resultCode).toBe('MEMBER_001')
  })

  it('필드 검증 실패는 ValidationErrorBody 형태로 온다', () => {
    const result = resolveMock(
      '/members/signup',
      'POST',
      '',
      JSON.stringify({ email: 'a@b.c', password: 'short', name: '', nickname: '길동짱' }),
    )

    expect(result?.status).toBe(400)
    const raw = result?.payload.dataHeader.resultMessage as {
      message: string
      errors: { code: string; field: string; message: string }[]
    }
    expect(Array.isArray(raw.errors)).toBe(true)
    expect(raw.errors[0]?.field).toBe('password')
  })

  it('mock 이 모르는 POST 는 null 이라 게이트웨이로 넘어간다', () => {
    expect(resolveMock('/ai-plans', 'POST', '', '{}')).toBeNull()
  })

  it('send-code 공란 이메일은 400 AUTH_101 이다', () => {
    const result = resolveMock('/auth/email/send-code', 'POST', '', JSON.stringify({ email: '' }))

    expect(result?.status).toBe(400)
    expect(result?.payload.dataHeader.resultCode).toBe('AUTH_101')
  })

  it('verify-code 공란 이메일은 400 AUTH_101 이다', () => {
    const result = resolveMock(
      '/auth/email/verify-code',
      'POST',
      '',
      JSON.stringify({ email: '', code: MOCK_EMAIL_CODE }),
    )

    expect(result?.status).toBe(400)
    expect(result?.payload.dataHeader.resultCode).toBe('AUTH_101')
  })

  it('verify-code 공란 코드는 400 AUTH_104 다', () => {
    resolveMock(
      '/auth/email/send-code',
      'POST',
      '',
      JSON.stringify({ email: 'blankcode@hondigagae.dev' }),
    )
    const result = resolveMock(
      '/auth/email/verify-code',
      'POST',
      '',
      JSON.stringify({ email: 'blankcode@hondigagae.dev', code: '' }),
    )

    expect(result?.status).toBe(400)
    expect(result?.payload.dataHeader.resultCode).toBe('AUTH_104')
  })

  it('새 이메일로 인증 후 가입하면 200 이다', () => {
    resolveMock(
      '/auth/email/send-code',
      'POST',
      '',
      JSON.stringify({ email: 'signup1@hondigagae.dev' }),
    )
    resolveMock(
      '/auth/email/verify-code',
      'POST',
      '',
      JSON.stringify({ email: 'signup1@hondigagae.dev', code: MOCK_EMAIL_CODE }),
    )
    const result = resolveMock(
      '/members/signup',
      'POST',
      '',
      JSON.stringify({
        email: 'signup1@hondigagae.dev',
        password: 'password123!',
        name: '김철수',
        nickname: '철수독',
      }),
    )

    expect(result?.status).toBe(200)
  })

  it('가입 성공을 2회 연속 하면 두 신규 회원의 memberId 가 서로 다르다', () => {
    function signup(email: string, nickname: string): void {
      resolveMock('/auth/email/send-code', 'POST', '', JSON.stringify({ email }))
      resolveMock(
        '/auth/email/verify-code',
        'POST',
        '',
        JSON.stringify({ email, code: MOCK_EMAIL_CODE }),
      )
      const result = resolveMock(
        '/members/signup',
        'POST',
        '',
        JSON.stringify({ email, password: 'password123!', name: '홍길동', nickname }),
      )
      expect(result?.status).toBe(200)
    }

    signup('first@hondigagae.dev', '첫째')
    signup('second@hondigagae.dev', '둘째')

    const members = mockStore().members
    const first = members.find((member) => member.email === 'first@hondigagae.dev')
    const second = members.find((member) => member.email === 'second@hondigagae.dev')

    expect(first?.memberId).toBeTruthy()
    expect(second?.memberId).toBeTruthy()
    expect(first?.memberId).not.toBe(second?.memberId)
  })

  it('가입 후 로그인하면 가입 시 부여된 memberId 를 그대로 준다', () => {
    const email = 'loginafter@hondigagae.dev'
    const password = 'password123!'

    resolveMock('/auth/email/send-code', 'POST', '', JSON.stringify({ email }))
    resolveMock(
      '/auth/email/verify-code',
      'POST',
      '',
      JSON.stringify({ email, code: MOCK_EMAIL_CODE }),
    )
    resolveMock(
      '/members/signup',
      'POST',
      '',
      JSON.stringify({ email, password, name: '홍길동', nickname: '길동이' }),
    )

    const created = mockStore().members.find((member) => member.email === email)
    expect(created).toBeDefined()

    const loginResult = resolveMock('/auth/login', 'POST', '', JSON.stringify({ email, password }))

    expect(loginResult?.status).toBe(200)
    const body = loginResult?.payload.dataBody as { memberId: string }
    expect(body.memberId).toBe(created?.memberId)
  })
})
