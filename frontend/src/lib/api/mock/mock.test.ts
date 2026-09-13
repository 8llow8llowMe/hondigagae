import { beforeEach, describe, expect, it } from 'vitest'

import { resolveMock } from '@/lib/api/mock'
import { MOCK_EMAIL_CODE } from '@/lib/api/mock/auth-data'
import { MOCK_PLACES } from '@/lib/api/mock/place-data'
import { mockStore, resetMockStore } from '@/lib/api/mock/store'
import { isAllowedImageHost } from '@/lib/image/remote-host'
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
    /*
      **이 단언은 mock 이 정말 모르는 경로여야 의미가 있다.**

      `/members/me/profile-image` 를 쓰지 않는다 — mock 이 처리한다 (#79 · #83).
      `/places/nearby` 도 쓸 수 없게 됐다 — 지도(#14)가 붙으며 mock 이 처리한다.
      산책 코스(두루누비)는 **백엔드에 패키지 자체가 없다** — 화면도 mock 도 없는 것이
      확실한 경로다 (screen-inventory §6).
    */
    expect(resolveMock('/walk-courses', 'GET', '', null)).toBeNull()
  })

  it('AI 일정은 mock 이 처리한다 (이슈 #84)', () => {
    // 보호 리소스라 토큰 없이는 401 이다 — null 로 넘기지 않는다
    expect(resolveMock('/ai-plans', 'POST', '', '{}')?.status).toBe(401)
    expect(resolveMock('/ai-plans/jobs/아무거나', 'GET', '', null)?.status).toBe(401)
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

  it('keyword 는 이름 또는 주소 부분 일치다', () => {
    const contents = body('keyword=오설록&size=50').contents

    expect(contents.length).toBeGreaterThan(0)
    expect(
      contents.every((place) => `${place.title} ${place.addr1 ?? ''}`.includes('오설록')),
    ).toBe(true)
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

  it('/places/nearby 는 상세로 오해되지 않는다 — 전용 응답을 준다', () => {
    const result = resolveMock('/places/nearby', 'GET', 'lat=33.5&lng=126.5', null)

    expect(result?.status).toBe(200)
    // 상세(PlaceDetailResponse)가 아니라 NearbyPlaceResponse 다 — 커서가 없고 totalCount 가 있다
    expect(result?.payload.dataBody).toHaveProperty('totalCount')
    expect(result?.payload.dataBody).not.toHaveProperty('hasNext')
  })

  it('/places/nearby 는 lat·lng 없이 부르면 400 이다 — 백엔드가 필수로 받는다', () => {
    const result = resolveMock('/places/nearby', 'GET', 'radius=5000', null)

    expect(result?.status).toBe(400)
  })

  it('/places/nearby 는 반경 밖 장소를 빼고 가까운 순으로 준다', () => {
    const result = resolveMock('/places/nearby', 'GET', 'lat=33.5&lng=126.5&radius=50000', null)
    const nearby = result?.payload.dataBody as { places: { distanceMeters: number }[] }

    const distances = nearby.places.map((entry) => entry.distanceMeters)
    expect(distances).toEqual([...distances].sort((left, right) => left - right))
    expect(distances.every((meters) => meters <= 50_000)).toBe(true)
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
    expect(MOCK_PLACES.some((p) => p.firstImage === null)).toBe(true)
  })

  /*
    #67 B. **"사진이 없다" 와 "사진이 있는데 못 쓴다" 는 다른 갈래다.** 뒤쪽은 실데이터로
    만들 수 없다 — dev 실측에서 이미지 호스트는 `tong.visitkorea.or.kr` 하나뿐이라
    거절 경로가 단위 테스트에만 잠겨 있었다. 거절이 무너지면 `next/image` 가 런타임에
    던져 화면 전체가 죽으므로, 로컬에서 늘 눈에 보이는 자리를 하나 둔다.
  */
  /*
    #247 C. **예전에는 전부 null 이라 썸네일 경로가 로컬에서 한 번도 돌지 않았다** —
    화면은 늘 카테고리 일러스트만 보여 줬고, `imageSrc()` → `next/image` 로 이어지는 길이
    mock 에서 끊겨 있었다.

    **전부 채우지도 않는다.** dev 실측(2026-09-07)에서 제주 400곳 중 사진 보유는 123곳(31%)
    이다 — 다 채우면 "사진 없는 장소가 대부분" 이라는 이 서비스의 조건이 로컬에서 사라지고,
    일러스트·"이미지 없음" 갈래를 볼 수 없게 된다.
  */
  it('실제로 뜨는 사진과 사진 없음이 함께 있다', () => {
    const usable = MOCK_PLACES.filter((p) => isAllowedImageHost(p.firstImage))
    const empty = MOCK_PLACES.filter((p) => p.firstImage === null)

    expect(usable.length).toBeGreaterThan(0)
    expect(empty.length).toBeGreaterThan(0)
    // 사진 없는 쪽이 더 많아야 실제 분포에 가깝다 (실측 31%)
    expect(empty.length).toBeGreaterThan(usable.length)
  })

  /* 화면이 쓰지 않는 값이지만 계약에는 늘 함께 온다 — 비워 두면 그 규칙이 시험되지 않는다 */
  it('사진이 있으면 firstImage2 도 함께 온다', () => {
    for (const p of MOCK_PLACES.filter((x) => isAllowedImageHost(x.firstImage))) {
      expect(p.firstImage2).not.toBeNull()
    }
  })

  it('허용 목록 밖 호스트의 firstImage 를 가진 장소를 포함한다', () => {
    const rejected = MOCK_PLACES.filter(
      (p) => p.firstImage !== null && !isAllowedImageHost(p.firstImage),
    )

    expect(rejected.length).toBeGreaterThan(0)
    // 실재하는 주소를 부르지 않는다 — 예약된 `.invalid` 다 (RFC 2606)
    for (const place of rejected) {
      expect(new URL(place.firstImage as string).hostname.endsWith('.invalid')).toBe(true)
    }
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

  it('필드 검증 실패는 문자열 resultMessage + fieldErrors 로 온다 (#491)', () => {
    const result = resolveMock(
      '/members/signup',
      'POST',
      '',
      JSON.stringify({ email: 'a@b.c', password: 'short', name: '', nickname: '길동짱' }),
    )

    expect(result?.status).toBe(400)
    // 대표 메시지가 문자열이 아니면 화면에 [object Object] 가 나간다
    expect(typeof result?.payload.dataHeader.resultMessage).toBe('string')
    const fieldErrors = result?.payload.dataHeader.fieldErrors
    expect(Array.isArray(fieldErrors)).toBe(true)
    expect(fieldErrors?.[0]?.field).toBe('password')
  })

  it('mock 이 모르는 POST 는 null 이라 게이트웨이로 넘어간다', () => {
    /*
      **예시로 실재하는 엔드포인트를 쓰지 않는다.** `/members/me/profile-image`(#79·#83)와
      `/auth/password/reset`(#85)이 차례로 구현되면서 이 단언이 두 번 무의미해졌다.
      지금은 **백엔드에 실재하는 POST 엔드포인트가 전부 mock 에 있다** — 컨트롤러
      5종(auth · member · pet · plan · ai-plan) 실측, 2026-08-31.

      그래서 여기서 고정하는 것은 "아직 구현 안 된 경로" 가 아니라 표에 없는 경로의
      **통과 계약**이다. 백엔드에 없는 경로를 써야 다음 기능이 구현돼도 흔들리지 않는다.
    */
    expect(resolveMock('/auth/password/rotate', 'POST', '', '{}')).toBeNull()
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

describe('petWeightKg 필터', () => {
  it('체중 상한이 낮은 곳을 뺀다', () => {
    const heavy = body('areaCode=39&size=50&petWeightKg=30').contents
    const light = body('areaCode=39&size=50&petWeightKg=1').contents

    expect(heavy.length).toBeLessThanOrEqual(light.length)
  })

  it('상한을 모르는 곳(null)은 남긴다 — 정보 없음을 "불가" 로 단정하지 않는다', () => {
    const filtered = body('areaCode=39&size=50&petWeightKg=99').contents

    expect(filtered.some((place) => place.maxPetWeightKg === null)).toBe(true)
  })

  it('필터를 걸지 않으면 상한이 낮은 곳도 남는다', () => {
    const all = body('areaCode=39&size=50').contents
    const filtered = body('areaCode=39&size=50&petWeightKg=99').contents

    expect(all.length).toBeGreaterThanOrEqual(filtered.length)
  })
})
