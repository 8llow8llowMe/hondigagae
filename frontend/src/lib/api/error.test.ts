import { describe, expect, it } from 'vitest'

import {
  ApiError,
  classify,
  isRetriable,
  NO_RESPONSE_STATUS,
  parseRetryAfterSeconds,
  shouldOfferRetry,
  toErrorStatus,
} from '@/lib/api/error'

describe('classify', () => {
  it('404 는 데이터 부재로 분류한다', () => {
    expect(classify(404)).toBe('not-found')
  })

  it('401 은 미인증으로 분류한다', () => {
    expect(classify(401)).toBe('unauthorized')
  })

  it('400 은 입력 검증 실패로 분류한다', () => {
    expect(classify(400)).toBe('validation')
  })

  it('5xx 는 일시 장애로 분류한다', () => {
    expect(classify(500)).toBe('temporary')
    expect(classify(503)).toBe('temporary')
  })

  it('무응답(status 0)은 일시 장애로 분류한다', () => {
    expect(classify(0)).toBe('temporary')
  })

  it('403 은 권한 문제로 분류한다', () => {
    expect(classify(403)).toBe('forbidden')
  })
})

describe('shouldOfferRetry', () => {
  it('데이터 부재(404)에는 재시도를 제안하지 않는다', () => {
    expect(shouldOfferRetry(new ApiError(404, 'PET_001', '없음'))).toBe(false)
  })

  it('일시 장애(5xx)에는 재시도를 제안한다', () => {
    expect(shouldOfferRetry(new ApiError(503, null, null))).toBe(true)
  })

  it('미인증(401)에는 재시도를 제안하지 않는다 (재발급 흐름이 담당한다)', () => {
    expect(shouldOfferRetry(new ApiError(401, null, null))).toBe(false)
  })

  it('입력 검증 실패(400)에는 재시도를 제안하지 않는다', () => {
    expect(shouldOfferRetry(new ApiError(400, 'PET_100', '올바르지 않음'))).toBe(false)
  })
})

describe('isRetriable', () => {
  it('ApiError 가 아닌 오류는 전송 실패로 보고 재시도 가능으로 판정한다', () => {
    expect(isRetriable(new Error('boom'))).toBe(true)
  })
})

describe('toErrorStatus', () => {
  it('성공(에러 없음)이면 null 이다', () => {
    expect(toErrorStatus(null)).toBeNull()
    expect(toErrorStatus(undefined)).toBeNull()
  })

  it('ApiError 는 status 를 그대로 준다', () => {
    expect(toErrorStatus(new ApiError(404, 'PLACE_002', '존재하지 않는 장소입니다.'))).toBe(404)
  })

  it('ApiError 가 아니면 무응답으로 취급한다 — 재시도 UI 가 나와야 한다', () => {
    expect(toErrorStatus(new Error('boom'))).toBe(NO_RESPONSE_STATUS)
  })
})

describe('classify — 409 / 429', () => {
  it('409 는 conflict 다 (이메일 중복 MEMBER_001)', () => {
    expect(classify(409)).toBe('conflict')
  })

  it('429 는 rate-limited 다 (로그인 잠금 AUTH_015 / 코드 쿨다운 AUTH_003)', () => {
    expect(classify(429)).toBe('rate-limited')
  })

  it('409 / 429 는 재시도 대상이 아니다', () => {
    expect(isRetriable(new ApiError(409, 'MEMBER_001', '이미 가입된 이메일입니다.'))).toBe(false)
    expect(isRetriable(new ApiError(429, 'AUTH_015', '로그인 시도가 너무 많습니다.'))).toBe(false)
    expect(shouldOfferRetry(new ApiError(429, 'AUTH_015', null))).toBe(false)
  })

  it('403 은 여전히 forbidden 이다', () => {
    expect(classify(403)).toBe('forbidden')
  })
})

describe('parseRetryAfterSeconds — Retry-After 를 초로 (#1309)', () => {
  it('정수 초를 읽는다', () => {
    expect(parseRetryAfterSeconds('60')).toBe(60)
    expect(parseRetryAfterSeconds('3540')).toBe(3540)
    expect(parseRetryAfterSeconds('1')).toBe(1)
  })

  it('헤더가 없으면 null 이다', () => {
    expect(parseRetryAfterSeconds(null)).toBeNull()
  })

  it('HTTP-date 형식은 읽지 않는다 — 백엔드는 정수 초만 낸다', () => {
    expect(parseRetryAfterSeconds('Wed, 21 Oct 2026 07:28:00 GMT')).toBeNull()
  })

  it('정수가 아닌 값은 읽지 않는다', () => {
    expect(parseRetryAfterSeconds('')).toBeNull()
    expect(parseRetryAfterSeconds('1.5')).toBeNull()
    expect(parseRetryAfterSeconds('-1')).toBeNull()
    expect(parseRetryAfterSeconds('60s')).toBeNull()
  })

  it('0 은 null 이다 — 백엔드 최소값은 1이라 계약 밖 값으로 보고 대체값에 맡긴다', () => {
    expect(parseRetryAfterSeconds('0')).toBeNull()
  })
})

describe('ApiError.retryAfterSeconds', () => {
  it('생략하면 null 이다 — 기존 호출부는 그대로다', () => {
    expect(new ApiError(429, 'AUTH_003', '잠시 후').retryAfterSeconds).toBeNull()
  })

  it('다섯 번째 인자로 받는다', () => {
    expect(new ApiError(429, 'AUTH_003', '잠시 후', null, 60).retryAfterSeconds).toBe(60)
  })
})
