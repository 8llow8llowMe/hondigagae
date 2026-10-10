import { describe, expect, it } from 'vitest'

import { PET_INVALIDATE_KEY, PET_QUERY_OPTIONS, petKeys } from '@/features/pet/queries'
import { ApiError, NO_RESPONSE_STATUS } from '@/lib/api/error'

describe('petKeys', () => {
  it('도메인 단위 무효화가 가능한 계층 구조다', () => {
    expect(petKeys.list()).toEqual(['pets', 'list'])
    expect(petKeys.detail('1')).toEqual(['pets', 'detail', '1'])
    expect(PET_INVALIDATE_KEY).toEqual(['pets'])
  })
})

describe('PET_QUERY_OPTIONS.retry', () => {
  const retry = PET_QUERY_OPTIONS.retry

  it('400 은 재시도하지 않는다 — 요청이 잘못됐다 (§7)', () => {
    expect(retry(0, new ApiError(400, 'PET_113', null))).toBe(false)
  })

  it('404 는 재시도하지 않는다 — 데이터 부재는 재시도해도 같다', () => {
    expect(retry(0, new ApiError(404, 'PET_001', null))).toBe(false)
  })

  it('401 은 재시도하지 않는다 — 재발급 흐름이 처리한다', () => {
    expect(retry(0, new ApiError(401, null, null))).toBe(false)
  })

  it('5xx 는 1회만 재시도한다', () => {
    const error = new ApiError(500, null, null)

    expect(retry(0, error)).toBe(true)
    expect(retry(1, error)).toBe(false)
  })

  it('무응답도 1회 재시도한다', () => {
    expect(retry(0, new ApiError(NO_RESPONSE_STATUS, null, null))).toBe(true)
  })
})
