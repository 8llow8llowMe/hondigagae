import { MOCK_PLACES } from '@/lib/api/mock/place-data'
import type { ApiResponse, SliceResponse } from '@/types/api'
import type { PlaceSummary } from '@/types/place'

/**
 * 개발용 mock 응답 계층.
 *
 * **없는 API 를 상상해서 만드는 것이 아니다.** origin/develop 의 실제 계약
 * (`PlaceWebController`, `PlaceItem`)을 근거로, 백엔드가 로컬에 뜨지 않은 상태에서
 * 화면을 확인하기 위한 fixture 다. 규약은 `docs/api-integration-guide.md` §9.
 *
 * BFF 프록시와 `serverFetch` 양쪽에서 이 계층을 먼저 확인한다.
 * 클라이언트 코드는 mock 존재를 모른다 — 전송 계층·래퍼 판별·에러 분기가 실제 경로 그대로다.
 */

export type MockResult = { status: number; payload: ApiResponse<unknown> }

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

/** 백엔드 `size` 허용 범위 (1~50). 벗어나면 400 이다 */
const MIN_SIZE = 1
const MAX_SIZE = 50

/**
 * 경로+쿼리를 mock 응답으로 해석한다. 처리 대상이 아니면 null 을 반환해
 * 호출부가 실제 게이트웨이로 넘어가게 한다.
 */
export function resolveMock(path: string, method: string, search: string): MockResult | null {
  if (method !== 'GET') return null

  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search)

  if (path === '/places') return placeList(params)

  const detail = /^\/places\/(\d+)$/.exec(path)
  if (detail !== null) return placeDetail(detail[1] ?? '')

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
  const place = MOCK_PLACES.find((candidate) => candidate.placeId === placeId)

  // 백엔드는 없는 리소스를 404 로 응답한다
  if (place === undefined) return fail(404, 'PLACE_001', '존재하지 않는 장소입니다.')

  return { status: 200, payload: ok(place) }
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
