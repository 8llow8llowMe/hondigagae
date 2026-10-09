import { describe, expect, it } from 'vitest'

import { facilityLayerStatus } from '@/features/place/facility-layer-status'
import { ApiError, NO_RESPONSE_STATUS } from '@/lib/api/error'
import { messages } from '@/lib/messages'
import { facility, facilityResult, pharmacy } from '@/test/fixtures/emergency'

/** 병원 · 약국 층의 상태 갈래 (#1286 D5) */
describe('facilityLayerStatus', () => {
  it('끄면 직전 응답이 남아 있어도 off 다 — placeholderData 가 꺼진 층을 되살리지 않는다', () => {
    expect(facilityLayerStatus({ on: false, data: facilityResult(), error: null })).toEqual({
      kind: 'off',
    })
  })

  it('켜고 받기 전에는 loading 이다', () => {
    expect(facilityLayerStatus({ on: true, data: undefined, error: null })).toEqual({
      kind: 'loading',
    })
  })

  it('받으면 지도에 서는 수(좌표 있는 곳)를 센다', () => {
    const data = facilityResult({
      facilities: [facility(), pharmacy(), facility({ facilityId: '9', lat: 0, lng: 0 })],
    })

    expect(facilityLayerStatus({ on: true, data, error: null })).toEqual({
      kind: 'shown',
      count: 2,
      truncated: false,
    })
  })

  it('size 상한에서 잘렸으면 truncated 다', () => {
    const data = facilityResult({ facilities: [facility()], totalCount: 300 })

    expect(facilityLayerStatus({ on: true, data, error: null })).toMatchObject({
      kind: 'shown',
      truncated: true,
    })
  })

  it('5xx · 무응답은 재시도를 준다', () => {
    for (const status of [500, 503, NO_RESPONSE_STATUS]) {
      expect(
        facilityLayerStatus({
          on: true,
          data: undefined,
          error: new ApiError(status, null, '서버 내부 오류'),
        }),
      ).toEqual({ kind: 'failed', retry: true, message: messages.map.facilityLoadFailed })
    }
  })

  it('4xx 는 재시도 없이 resultMessage 를 그대로 말한다', () => {
    expect(
      facilityLayerStatus({
        on: true,
        data: undefined,
        error: new ApiError(400, 'COMMON_400', '반경은 50000 이하여야 해요'),
      }),
    ).toEqual({ kind: 'failed', retry: false, message: '반경은 50000 이하여야 해요' })
  })

  it('4xx 의 resultMessage 가 문자열이 아니면 일반 문구로 떨어진다', () => {
    expect(
      facilityLayerStatus({
        on: true,
        data: undefined,
        error: new ApiError(404, null, { detail: 'x' }),
      }),
    ).toEqual({ kind: 'failed', retry: false, message: messages.map.facilityLoadFailed })
  })

  it('받은 것이 있으면 백그라운드 재조회 실패에도 그대로 그린다', () => {
    expect(
      facilityLayerStatus({
        on: true,
        data: facilityResult(),
        error: new ApiError(503, null, null),
      }),
    ).toMatchObject({ kind: 'shown' })
  })
})
