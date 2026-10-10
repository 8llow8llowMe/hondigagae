import {
  DEFAULT_PLAN_FILTERS,
  PLAN_STATUS_FILTERS,
  type PlanFilters,
  type PlanStatusFilter,
} from '@/types/plan'

/**
 * 일정 목록 필터의 URL 직렬화 — architecture-guide.md §10 규약.
 *
 * **이 필터는 서버 조회 파라미터가 아니다.** `GET /plans` 에 `status`·`petId` 가 없어
 * 좁히기는 화면에서 한다 (공통명세 S3). 그래도 URL 에 두는 이유는 새로고침·뒤로가기·
 * 만들기 후 복귀에서 보고 있던 조건이 살아 있어야 하기 때문이다.
 *
 * 규약대로: 배열은 **콤마 구분 단일 키**, 기본값은 **URL 에서 생략**,
 * 잘못된 값은 **예외 없이 기본값으로 떨어뜨린다**(URL 은 사용자가 손으로 고친다).
 */

type SearchParamsLike = URLSearchParams | Record<string, string | string[] | undefined>

function read(params: SearchParamsLike, key: string): string | null {
  if (params instanceof URLSearchParams) return params.get(key)

  const value = params[key]
  if (value === undefined) return null
  // 반복 키로 들어오면 첫 값만 쓴다 — 규약은 콤마 구분 단일 키다
  return Array.isArray(value) ? (value[0] ?? null) : value
}

function isStatusFilter(value: string): value is PlanStatusFilter {
  return (PLAN_STATUS_FILTERS as readonly string[]).includes(value)
}

export function parsePlanFilters(params: SearchParamsLike): PlanFilters {
  const status = read(params, 'status')
  const petId = read(params, 'petId')

  return {
    status: status !== null && isStatusFilter(status) ? status : DEFAULT_PLAN_FILTERS.status,
    petIds:
      petId === null
        ? []
        : // 빈 조각(`?petId=,1`)과 중복을 걸러 낸다 — 그대로 두면 개수가 어긋난다
          [...new Set(petId.split(',').map((id) => id.trim()))].filter((id) => id !== ''),
  }
}

/** `?` 없는 쿼리 문자열. 기본 상태면 빈 문자열이라 호출부가 경로만 쓰면 된다 */
export function toPlanFilterQuery(filters: PlanFilters): string {
  const params = new URLSearchParams()

  if (filters.status !== DEFAULT_PLAN_FILTERS.status) params.set('status', filters.status)
  if (filters.petIds.length > 0) params.set('petId', filters.petIds.join(','))

  return params.toString()
}
