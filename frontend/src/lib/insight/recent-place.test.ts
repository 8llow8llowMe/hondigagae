import { afterEach, describe, expect, it } from 'vitest'

import { ApiError, NO_RESPONSE_STATUS } from '@/lib/api/error'
import {
  clearRecentPlaceId,
  isBasisPlaceGone,
  readRecentPlaceId,
  RECENT_PLACE_STORAGE_KEY,
  writeRecentPlaceId,
} from '@/lib/insight/recent-place'

/**
 * **`environment: 'node'` 라 `localStorage` 가 없다** (`vitest.config.mts`). 모듈이
 * `globalThis.localStorage?.` 로 옵셔널하게 닿으므로 여기서 최소 구현을 꽂는다 —
 * jsdom 을 들이지 않는 것이 이 저장소의 선택이다 (`docs/testing-guide.md` §1).
 */
function useStorage(initial: Record<string, string> = {}): Map<string, string> {
  const store = new Map(Object.entries(initial))

  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => void store.set(key, value),
      removeItem: (key: string) => void store.delete(key),
    },
  })

  return store
}

/** 저장소 접근 자체가 던지는 환경 — 사파리 프라이빗 모드 */
function useThrowingStorage(): void {
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    get() {
      throw new Error('SecurityError')
    },
  })
}

afterEach(() => {
  Reflect.deleteProperty(globalThis, 'localStorage')
})

describe('clearRecentPlaceId', () => {
  it('저장된 기준 장소를 지운다', () => {
    const store = useStorage({ [RECENT_PLACE_STORAGE_KEY]: '126434' })

    clearRecentPlaceId()

    expect(store.has(RECENT_PLACE_STORAGE_KEY)).toBe(false)
    expect(readRecentPlaceId()).toBeNull()
  })

  it('저장된 것이 없어도 던지지 않는다', () => {
    useStorage()

    expect(() => clearRecentPlaceId()).not.toThrow()
  })

  /* 읽기·쓰기와 같은 처방이다 — 지우지 못해도 화면은 이미 기준 없이 그린다 */
  it('저장소가 던져도 삼킨다', () => {
    useThrowingStorage()

    expect(() => clearRecentPlaceId()).not.toThrow()
  })

  it('지운 뒤 다시 쓰면 되살아난다 — 지우기가 키를 망가뜨리지 않는다', () => {
    useStorage({ [RECENT_PLACE_STORAGE_KEY]: '126434' })

    clearRecentPlaceId()
    writeRecentPlaceId('126439')

    expect(readRecentPlaceId()).toBe('126439')
  })
})

/*
  죽은 기준 장소를 홈이 스스로 버리게 하는 판별이다 (#530). 홈은 이 값이 참일 때
  저장된 id 를 지우고 **첫 방문자와 같은 상태**로 떨어진다 — 판정 섹션 미렌더.
*/
describe('isBasisPlaceGone', () => {
  it('404 는 그 장소가 더 이상 없다는 뜻이다', () => {
    expect(isBasisPlaceGone(new ApiError(404, 'PLACE_001', '장소를 찾을 수 없습니다.'))).toBe(true)
  })

  it('조회에 성공했으면 버리지 않는다', () => {
    expect(isBasisPlaceGone(null)).toBe(false)
    expect(isBasisPlaceGone(undefined)).toBe(false)
  })

  /*
    **5xx·무응답에 버리면 다음 방문에 멀쩡한 판정을 잃는다.** 404 는 데이터 부재이고
    5xx 가 일시 장애다 (`lib/api/error.ts`) — 그 구분이 여기서도 그대로다.
  */
  it('일시 장애에는 저장된 기준을 지키게 둔다', () => {
    expect(isBasisPlaceGone(new ApiError(500, null, null))).toBe(false)
    expect(isBasisPlaceGone(new ApiError(503, null, null))).toBe(false)
    expect(isBasisPlaceGone(new ApiError(NO_RESPONSE_STATUS, null, null))).toBe(false)
  })

  /* 401 은 세션 문제지 장소 문제가 아니다 — 재발급 뒤 같은 id 로 다시 받는다 */
  it('401 · 400 에도 버리지 않는다', () => {
    expect(isBasisPlaceGone(new ApiError(401, null, null))).toBe(false)
    expect(isBasisPlaceGone(new ApiError(400, null, null))).toBe(false)
  })

  /* `ApiError` 가 아닌 실패는 전송 단계 실패다 — `toErrorStatus` 가 무응답(0)으로 본다 */
  it('전송 단계 실패는 404 가 아니다', () => {
    expect(isBasisPlaceGone(new TypeError('Failed to fetch'))).toBe(false)
  })
})
