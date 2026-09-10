import type { MockStreamResult } from '@/lib/api/mock/ai-plan-data'
import { resolveAiPlanMock, resolveAiPlanStreamMock } from '@/lib/api/mock/ai-plan-data'
import type { MockResult } from '@/lib/api/mock/auth-data'
import { resolveAuthMock } from '@/lib/api/mock/auth-data'
import { mockNearbyFacilities } from '@/lib/api/mock/emergency-data'
import { resolveFavoriteMock } from '@/lib/api/mock/favorite-data'
import {
  mockRegionalWeather,
  mockSuitability,
  mockWalkSafety,
  mockWalkTimes,
} from '@/lib/api/mock/insight-data'
import { resolveMemberMock } from '@/lib/api/mock/member-data'
import { resolvePetMock } from '@/lib/api/mock/pet-data'
import { MOCK_PLACES } from '@/lib/api/mock/place-data'
import { mockPlaceDetail } from '@/lib/api/mock/place-detail-data'
import { resolvePlanMock } from '@/lib/api/mock/plan-data'
import { toLatLng } from '@/lib/geo/coord'
import { haversineMeters } from '@/lib/geo/distance'
import { allowsPetSize } from '@/lib/place/pet-size'
import type { ApiResponse, SliceResponse } from '@/types/api'
import type { PlaceSummary } from '@/types/place'

/**
 * 개발용 mock 응답 계층.
 *
 * **없는 API 를 상상해서 만드는 것이 아니다.** origin/develop 의 실제 계약
 * (`PlaceWebController`, `PlaceItem`, `AuthWebController`, `MemberWebController`)을
 * 근거로, 백엔드가 로컬에 뜨지 않은 상태에서 화면을 확인하기 위한 fixture 다.
 * 규약은 `docs/api-integration-guide.md` §9.
 *
 * BFF 프록시와 `serverFetch` 양쪽에서 이 계층을 먼저 확인한다.
 * 클라이언트 코드는 mock 존재를 모른다 — 전송 계층·래퍼 판별·에러 분기가 실제 경로 그대로다.
 */

export type { MockResult, MockStreamResult }

/**
 * mock 활성 여부.
 *
 * **프로덕션 빌드에서는 어떤 경우에도 켜지지 않는다.**
 */
export function isMockEnabled(): boolean {
  if (process.env.NODE_ENV === 'production') return false
  return process.env.MOCK_API === 'true'
}

function ok<T>(dataBody: T): ApiResponse<T> {
  return { dataHeader: { success: true, resultCode: null, resultMessage: null }, dataBody }
}

function fail(status: number, resultCode: string, resultMessage: string): MockResult {
  return {
    status,
    payload: { dataHeader: { success: false, resultCode, resultMessage }, dataBody: null },
  }
}

/** `/places/{placeId}` 로 착각하면 안 되는 하위 경로 */
const SUB_RESOURCES = new Set(['nearby'])

/** 백엔드 `size` 허용 범위 (1~50). 벗어나면 400 이다 */
const MIN_SIZE = 1
const MAX_SIZE = 50

/**
 * SSE 스트림 요청을 mock 으로 해석한다 (#91). 대상이 아니면 null 이다.
 *
 * **`resolveMock` 과 나눈 이유**: 스트림은 `MockResult`(status + JSON payload)에 담기지
 * 않는다. 프레임 목록을 시간 간격대로 흘려보내야 하고, 그 조립은 BFF 쪽에서 한다.
 *
 * 스트림 mock 은 이 하나뿐이다 — SSE 엔드포인트가 계약에 하나뿐이다.
 */
export function resolveMockStream(
  path: string,
  method: string,
  accessToken: string | null = null,
): MockStreamResult | null {
  return resolveAiPlanStreamMock(path, method, accessToken)
}

/**
 * 경로+메서드+본문을 mock 응답으로 해석한다. 처리 대상이 아니면 null 을 반환해
 * 호출부가 실제 게이트웨이로 넘어가게 한다.
 */
export function resolveMock(
  path: string,
  method: string,
  search: string,
  body: string | null,
  accessToken: string | null = null,
): MockResult | null {
  // 소셜 로그인은 GET + 쿼리(code·state)라 search 를 함께 넘긴다
  const auth = resolveAuthMock(path, method, search, body)
  if (auth !== null) return auth

  /*
    회원(마이페이지). 프로필 이미지 업로드는 multipart 라 `body` 가 null 로 온다 —
    그 경로는 경로와 메서드만 보고 판정한다 (`forwarded-body.ts` toMockBody).

    **반려견보다 먼저 본다.** `/members/me/pets` 가 `/members/me` 접두사와 겹치지만,
    `resolveMemberMock` 이 그 경로를 명시적으로 배제하므로 순서에 기대지 않는다.
  */
  const member = resolveMemberMock(path, method, body, accessToken)
  if (member !== null) return member

  // 반려견도 보호 리소스다. accessToken 에서 회원을 도출해 소유권을 판정한다
  const pet = resolvePetMock(path, method, body, accessToken)
  if (pet !== null) return pet

  // 일정도 보호 리소스다. GET(커서 목록)과 POST(생성)가 같은 경로라 method 를 함께 넘긴다
  const plan = resolvePlanMock(path, method, search, body, accessToken)
  if (plan !== null) return plan

  // AI 일정도 보호 리소스다. 제출(POST /ai-plans)과 작업 조회(GET /ai-plans/jobs/{id})다
  const aiPlan = resolveAiPlanMock(path, method, body, accessToken)
  if (aiPlan !== null) return aiPlan

  // 즐겨찾기도 보호 리소스다. 목록(GET)·저장(POST)·해제(DELETE) 셋 다 본문이 없어 body 를 넘기지 않는다
  const favorite = resolveFavoriteMock(path, method, accessToken)
  if (favorite !== null) return favorite

  if (method !== 'GET') return null

  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search)

  if (path === '/places') return placeList(params)

  // 주변 장소 — 커서가 아니라 totalCount 를 준다 (NearbyPlaceResponse)
  if (path === '/places/nearby') return nearbyPlaces(params)

  /*
    오늘의 산책 골든타임 (#158). `lat`/`lng` 는 mock 이 쓰지 않는다 — 제주 안에서 좌표를
    바꿔도 예보 격자가 같아 결과가 거의 같고, 좌표로 값을 가르면 없는 정밀도를 흉내 내게 된다.
    갈래는 반려견 조건으로만 낸다 — 그것이 실제로 판정을 바꾸는 축이다. **셋을 다 읽는다**
    (#262 · #270): 판정 자리가 넷이고 그중 `NO_FORECAST` 는 이유가 둘이라, 로컬에서 봐야 할
    화면이 다섯이다. 그 넷은 실데이터로 만들기 어렵다 — 밤 늦게만, 원천이 죽어야, 경보가
    떠야, 경보 없이 하루가 전부 위험이어야 나온다. 조합표는 `mockWalkTimes` 머리주석에 있다.
  */
  if (path === '/insights/walk-times') {
    return {
      status: 200,
      payload: ok(
        mockWalkTimes(
          // **파라미터가 없으면 조건이 없는 것이다** — 게스트·반려견 미등록 (#270)
          params.has('heatSensitive')
            ? {
                heatSensitive: params.get('heatSensitive') === 'true',
                coldSensitive: params.get('coldSensitive') === 'true',
                noiseSensitive: params.get('noiseSensitive') === 'true',
              }
            : null,
        ),
      ),
    }
  }

  /*
    권역 비교 (#158). `date` 는 mock 이 쓰지 않는다 — fixture 가 한 날짜로 고정돼 있고,
    날짜마다 값을 지어내면 없는 예보 이력을 흉내 내게 된다.
  */
  if (path === '/insights/regional-weather') {
    return {
      status: 200,
      payload: ok(mockRegionalWeather(params.get('heatSensitive') === 'true')),
    }
  }

  // 긴급 시설. `lat`/`lng` 는 mock 이 쓰지 않는다 — 거리는 fixture 가 이미 갖고 있다
  if (path === '/emergencies/facilities') {
    const radius = Number.parseInt(params.get('radius') ?? '10000', 10)
    return { status: 200, payload: ok(mockNearbyFacilities(radius)) }
  }

  // 인사이트는 상세보다 먼저 본다 — /places/{id}/suitability 가 상세 정규식에 안 걸리지만
  // 순서를 명시해 두면 상세 규칙을 넓힐 때 실수하지 않는다
  const insight = /^\/places\/(\d+)\/(suitability|walk-safety)$/.exec(path)
  if (insight !== null) {
    const placeId = insight[1] as string

    if (insight[2] === 'suitability') return { status: 200, payload: ok(mockSuitability(placeId)) }

    return {
      status: 200,
      payload: ok(mockWalkSafety(placeId, params.get('heatSensitive') === 'true')),
    }
  }

  const detail = /^\/places\/([^/]+)$/.exec(path)
  if (detail !== null) {
    const rawId = detail[1] ?? ''

    // /places/nearby 는 위에서 이미 처리했다. 여기까지 오면 상세로 오해한 것이다
    if (SUB_RESOURCES.has(rawId)) return null

    // 컨트롤러가 @PathVariable long 이라, 숫자가 아닌 id 는 404 가 아니라 400 이다
    if (!/^\d+$/.test(rawId)) {
      return fail(400, 'PLACE_113', '요청 파라미터 형식이 올바르지 않습니다.')
    }

    return placeDetail(rawId)
  }

  return null
}

function placeList(params: URLSearchParams): MockResult {
  const rawSize = params.get('size')
  const size = rawSize === null ? 20 : Number(rawSize)

  if (!Number.isInteger(size) || size < MIN_SIZE || size > MAX_SIZE) {
    return fail(400, 'PLACE_113', '조회 개수는 1 이상 50 이하여야 합니다.')
  }

  const filtered = MOCK_PLACES.filter((place) => matches(place, params))

  // 커서 = 직전 응답의 마지막 placeId. 그 다음 항목부터 자른다
  const cursor = params.get('lastPlaceId')
  const start = cursor === null ? 0 : filtered.findIndex((place) => place.placeId === cursor) + 1

  const contents = filtered.slice(start, start + size)
  const hasNext = start + size < filtered.length

  const body: SliceResponse<PlaceSummary> = { contents, hasNext }
  return { status: 200, payload: ok(body) }
}

/**
 * `GET /places/nearby` — `NearbyPlaceResponse`.
 *
 * **목록과 페이징 모델이 다르다.** 커서가 없고 `totalCount` 와 `radius` 를 돌려준다
 * (screen-inventory §5-1). 백엔드 검증도 흉내 낸다: `lat`/`lng` 필수, `radius` 상한 50km.
 *
 * 거리는 fixture 좌표로 실제로 계산한다 — 상수로 박아 두면 지도를 옮겨도 거리가
 * 그대로여서 "재검색이 도는가" 를 화면에서 확인할 수 없다.
 */
function nearbyPlaces(params: URLSearchParams): MockResult {
  // **`Number(null)` 은 0 이다.** 그대로 Number 로 감싸면 좌표를 안 보낸 요청이
  // 기니 만(0,0) 조회로 통과한다 — 백엔드는 @RequestParam 필수라 400 이다
  const lat = readCoord(params.get('lat'))
  const lng = readCoord(params.get('lng'))

  if (lat === null || lng === null) {
    return fail(400, 'PLACE_113', '위도와 경도는 필수입니다.')
  }

  const radius = Number(params.get('radius') ?? '5000')
  if (!Number.isFinite(radius) || radius <= 0 || radius > 50_000) {
    return fail(400, 'PLACE_113', '검색 반경은 50000 이하여야 합니다.')
  }

  const rawSize = params.get('size')
  const size = rawSize === null ? 15 : Number(rawSize)
  if (!Number.isInteger(size) || size < MIN_SIZE || size > MAX_SIZE) {
    return fail(400, 'PLACE_113', '조회 개수는 1 이상 50 이하여야 합니다.')
  }

  const center = { lat, lng }
  const within = MOCK_PLACES.filter((place) => matches(place, params))
    .flatMap((place) => {
      const distanceMeters = haversineMeters(center, toLatLng(place))
      // 좌표가 없는 장소는 반경 판정을 할 수 없다 — 백엔드도 좌표 인덱스로 찾는다
      return distanceMeters === null || distanceMeters > radius
        ? []
        : [{ place, distanceMeters: Math.round(distanceMeters) }]
    })
    .sort((left, right) => left.distanceMeters - right.distanceMeters)

  return {
    status: 200,
    payload: ok({ places: within.slice(0, size), totalCount: within.length, radius }),
  }
}

/** 빠졌거나 숫자가 아니면 `null`. `Number(null) === 0` 함정을 여기서 막는다 */
function readCoord(raw: string | null): number | null {
  if (raw === null || raw.trim() === '') return null

  const value = Number(raw)
  return Number.isFinite(value) ? value : null
}

function placeDetail(placeId: string): MockResult {
  const detail = mockPlaceDetail(placeId)

  // 백엔드는 없는 리소스를 404 로 응답한다 (PlaceErrorCode.NOT_FOUND_PLACE)
  if (detail === null) return fail(404, 'PLACE_002', '존재하지 않는 장소입니다.')

  return { status: 200, payload: ok(detail) }
}

function matches(place: PlaceSummary, params: URLSearchParams): boolean {
  const sigunguCode = params.get('sigunguCode')
  if (sigunguCode !== null && place.sigunguCode !== sigunguCode) return false

  const contentType = params.get('contentType')
  if (contentType !== null && place.contentType.code !== contentType) return false

  const petAllowanceType = params.get('petAllowanceType')
  if (petAllowanceType !== null && place.petAllowanceType.code !== petAllowanceType) return false

  const indoor = params.get('indoor')
  if (indoor !== null) {
    // 원천에 정보가 없는 장소(null)는 true/false 어느 쪽으로도 잡히지 않는다 — 백엔드와 동일
    if (place.indoor === null) return false
    if (place.indoor !== (indoor === 'true')) return false
  }

  /*
    크기 축 두 개는 **`allowedPetSize` 가 null 이면 어느 쪽으로도 잡히지 않는다** —
    백엔드가 `eq` / `in` 을 쓰는데 SQL 에서 NULL 은 둘 다 만족하지 않기 때문이다
    (`indoor` 와 같은 규칙). 엔티티가 `nullable = false` 라 실제로 null 이 오지는 않지만,
    presenter 가 null 을 내보낼 수 있는 모양이라 타입을 따라 여기서도 갈라 둔다 (#148).
  */
  const allowedPetSize = params.get('allowedPetSize')
  if (allowedPetSize !== null && place.allowedPetSize?.code !== allowedPetSize) return false

  // 내 반려견 크기 — **받아 주지 않는 것으로 확인된 곳만 뺀다.**
  // `UNKNOWN` 은 남긴다: 정보 없음을 "불가" 로 단정하면 실제로는 갈 수 있는 장소가
  // 검색에서 사라진다 (backend `AllowedPetSize#allows` 와 같은 규칙이다)
  const petSizeType = params.get('petSizeType')
  if (petSizeType !== null) {
    if (place.allowedPetSize === null) return false
    if (!allowsPetSize(place.allowedPetSize.code, petSizeType)) return false
  }

  /*
    내 반려견 체중 — 백엔드는 `maxPetWeightKg IS NULL OR maxPetWeightKg >= petWeightKg` 다
    (`PlaceCustomRepositoryImpl`). **상한을 모르는 곳(null)은 남긴다** — 크기 축과 같은
    규칙이고, 정보 없음을 "불가" 로 단정하면 갈 수 있는 곳이 검색에서 사라진다.
  */
  const petWeightKg = params.get('petWeightKg')
  if (petWeightKg !== null) {
    const weight = Number(petWeightKg)
    if (Number.isFinite(weight) && place.maxPetWeightKg !== null && place.maxPetWeightKg < weight) {
      return false
    }
  }

  const sourceCategory = params.get('sourceCategory')
  if (sourceCategory !== null && place.sourceCategory !== sourceCategory) return false

  const keyword = params.get('keyword')?.trim()
  if (keyword !== null && keyword !== undefined && keyword !== '') {
    const haystack = `${place.title} ${place.addr1 ?? ''}`.toLowerCase()
    if (!haystack.includes(keyword.toLowerCase())) return false
  }

  return true
}
