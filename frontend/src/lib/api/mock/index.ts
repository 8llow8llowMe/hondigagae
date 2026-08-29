import type { MockResult } from '@/lib/api/mock/auth-data'
import { resolveAuthMock } from '@/lib/api/mock/auth-data'
import { mockSuitability, mockWalkSafety } from '@/lib/api/mock/insight-data'
import { resolvePetMock } from '@/lib/api/mock/pet-data'
import { MOCK_PLACES } from '@/lib/api/mock/place-data'
import { mockPlaceDetail } from '@/lib/api/mock/place-detail-data'
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

export type { MockResult }

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
  const auth = resolveAuthMock(path, method, body)
  if (auth !== null) return auth

  // 반려견은 보호 리소스다. accessToken 에서 회원을 도출해 소유권을 판정한다
  const pet = resolvePetMock(path, method, body, accessToken)
  if (pet !== null) return pet

  if (method !== 'GET') return null

  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search)

  if (path === '/places') return placeList(params)

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

    // /places/nearby 는 상세가 아니라 별도 엔드포인트다. mock 이 처리하지 않으므로
    // null 을 반환해 실제 게이트웨이로 넘긴다
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

  const sourceCategory = params.get('sourceCategory')
  if (sourceCategory !== null && place.sourceCategory !== sourceCategory) return false

  return true
}
