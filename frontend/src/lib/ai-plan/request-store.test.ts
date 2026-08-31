import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import {
  clearAiPlanRequest,
  readAiPlanRequest,
  saveAiPlanRequest,
} from '@/lib/ai-plan/request-store'
import type { AiPlanRequestSnapshot } from '@/types/ai-plan'

const snapshot: AiPlanRequestSnapshot = {
  areaCode: '39',
  startDate: '2026-09-12',
  endDate: '2026-09-14',
  petId: '123456789012000001',
  petName: '몽실이',
  budget: 300_000,
  requestNote: '실내 위주로',
}

/** node 환경이라 sessionStorage 가 없다. 최소 구현을 심는다 */
function fakeStorage(overrides: Partial<Storage> = {}): Storage {
  const map = new Map<string, string>()

  return {
    get length() {
      return map.size
    },
    clear: () => map.clear(),
    getItem: (key) => map.get(key) ?? null,
    key: (index) => [...map.keys()][index] ?? null,
    removeItem: (key) => void map.delete(key),
    setItem: (key, value) => void map.set(key, value),
    ...overrides,
  }
}

function install(store: Storage | undefined): void {
  Object.defineProperty(globalThis, 'sessionStorage', {
    value: store,
    configurable: true,
    writable: true,
  })
}

beforeEach(() => {
  install(fakeStorage())
})

afterEach(() => {
  install(undefined)
})

describe('saveAiPlanRequest / readAiPlanRequest', () => {
  it('jobId 를 키로 저장하고 그대로 되돌려 준다', () => {
    expect(saveAiPlanRequest('job-1', snapshot)).toBe(true)
    expect(readAiPlanRequest('job-1')).toEqual(snapshot)
  })

  it('다른 jobId 의 조건을 섞어 주지 않는다', () => {
    saveAiPlanRequest('job-1', snapshot)
    expect(readAiPlanRequest('job-2')).toBeNull()
  })

  it('저장한 적이 없으면 null 이다 — 다른 기기에서 같은 URL 을 연 상황이다', () => {
    expect(readAiPlanRequest('job-없음')).toBeNull()
  })

  it('예산 없음(null)도 그대로 보존한다', () => {
    saveAiPlanRequest('job-1', { ...snapshot, budget: null })
    expect(readAiPlanRequest('job-1')?.budget).toBeNull()
  })
})

describe('clearAiPlanRequest', () => {
  it('담기를 마치면 조건을 지운다', () => {
    saveAiPlanRequest('job-1', snapshot)
    clearAiPlanRequest('job-1')

    expect(readAiPlanRequest('job-1')).toBeNull()
  })
})

describe('저장소가 없거나 던질 때', () => {
  it('sessionStorage 가 없으면 저장이 false 다 — 서버 렌더에서 던지지 않는다', () => {
    install(undefined)

    expect(saveAiPlanRequest('job-1', snapshot)).toBe(false)
    expect(readAiPlanRequest('job-1')).toBeNull()
    expect(() => clearAiPlanRequest('job-1')).not.toThrow()
  })

  it('setItem 이 던지면(용량 초과) false 로 알리고 흐름을 막지 않는다', () => {
    install(
      fakeStorage({
        setItem: () => {
          throw new Error('QuotaExceededError')
        },
      }),
    )

    expect(saveAiPlanRequest('job-1', snapshot)).toBe(false)
  })

  it('getItem 이 던지면(프라이버시 모드) null 이다', () => {
    install(
      fakeStorage({
        getItem: () => {
          throw new Error('SecurityError')
        },
      }),
    )

    expect(readAiPlanRequest('job-1')).toBeNull()
  })
})

describe('저장된 값의 모양이 어긋나면 버린다', () => {
  it('JSON 이 아니면 null 이다', () => {
    globalThis.sessionStorage.setItem('hondigagae.ai-plan.request.job-1', '{깨진')
    expect(readAiPlanRequest('job-1')).toBeNull()
  })

  it('petId 가 빠졌으면 null 이다 — 담기에 반드시 필요한 값이다', () => {
    const rest = { ...snapshot, petId: undefined }
    globalThis.sessionStorage.setItem(
      'hondigagae.ai-plan.request.job-1',
      JSON.stringify({ ...rest, petId: '' }),
    )

    expect(readAiPlanRequest('job-1')).toBeNull()
  })

  it('budget 이 숫자도 null 도 아니면 null 이다', () => {
    globalThis.sessionStorage.setItem(
      'hondigagae.ai-plan.request.job-1',
      JSON.stringify({ ...snapshot, budget: '30만원' }),
    )

    expect(readAiPlanRequest('job-1')).toBeNull()
  })

  it('petName·requestNote 는 없어도 빈 문자열로 채운다 — 담기를 막을 이유가 아니다', () => {
    globalThis.sessionStorage.setItem(
      'hondigagae.ai-plan.request.job-1',
      JSON.stringify({
        areaCode: '39',
        startDate: '2026-09-12',
        endDate: '2026-09-14',
        petId: '1',
        budget: null,
      }),
    )

    expect(readAiPlanRequest('job-1')).toEqual({
      areaCode: '39',
      startDate: '2026-09-12',
      endDate: '2026-09-14',
      petId: '1',
      petName: '',
      budget: null,
      requestNote: '',
    })
  })
})
