import { describe, expect, it } from 'vitest'

import { resolveWeatherGlyph } from '@/lib/insight/weather-icon'
import type { CodeNameMetadata } from '@/types/api'

function meta(code: string, name: string): CodeNameMetadata {
  return { code, name, description: `${name} 설명` }
}

const CLEAR = meta('CLEAR', '맑음')
const OVERCAST = meta('OVERCAST', '흐림')
const MOSTLY_CLOUDY = meta('MOSTLY_CLOUDY', '구름많음')
const SKY_UNKNOWN = meta('UNKNOWN', '정보 없음')

const NO_RAIN = meta('NONE', '없음')
const RAIN = meta('RAIN', '비')
const SNOW = meta('SNOW', '눈')
const RAIN_SNOW = meta('RAIN_SNOW', '비/눈')
const PRECIP_UNKNOWN = meta('UNKNOWN', '정보 없음')

describe('resolveWeatherGlyph', () => {
  it('강수가 없으면 하늘상태를 그린다', () => {
    expect(resolveWeatherGlyph(CLEAR, NO_RAIN)).toEqual({ kind: 'sun', name: '맑음' })
    expect(resolveWeatherGlyph(MOSTLY_CLOUDY, NO_RAIN)).toEqual({
      kind: 'partly-cloudy',
      name: '구름많음',
    })
    expect(resolveWeatherGlyph(OVERCAST, NO_RAIN)).toEqual({ kind: 'cloud', name: '흐림' })
  })

  /* 비 오는 날 해를 그리지 않는다 */
  it('강수가 있으면 강수형태가 하늘상태를 이긴다', () => {
    expect(resolveWeatherGlyph(CLEAR, RAIN)).toEqual({ kind: 'rain', name: '비' })
    expect(resolveWeatherGlyph(CLEAR, SNOW)).toEqual({ kind: 'snow', name: '눈' })
  })

  /* 서버가 `비/눈` 이라고 부르는 것을 눈으로만 그리면 그림이 서버보다 덜 말한다 */
  it('비와 눈이 섞이면 진눈깨비로 그린다', () => {
    expect(resolveWeatherGlyph(CLEAR, RAIN_SNOW)?.kind).toBe('sleet')
    expect(resolveWeatherGlyph(CLEAR, meta('DRIZZLE_SNOW', '빗방울눈날림'))?.kind).toBe('sleet')
  })

  it('약한 비도 비다', () => {
    expect(resolveWeatherGlyph(CLEAR, meta('SHOWER', '소나기'))?.kind).toBe('rain')
    expect(resolveWeatherGlyph(CLEAR, meta('DRIZZLE', '빗방울'))?.kind).toBe('rain')
    expect(resolveWeatherGlyph(CLEAR, meta('SNOW_FLURRY', '눈날림'))?.kind).toBe('snow')
  })

  /* 예보를 못 받은 권역이다. 행의 `예보 없음` 배지가 이미 말한다 */
  it('둘 다 없으면 아무것도 그리지 않는다', () => {
    expect(resolveWeatherGlyph(null, null)).toBeNull()
  })

  /*
    **서버가 "정보 없음" 이라고 한 자리에 그림을 세우지 않는다.** 모르는 것을 그리면
    없는 사실을 만든다 — 이 저장소가 모르는 것과 나쁜 것을 구분하는 것과 같은 축이다.
  */
  it('UNKNOWN 은 그리지 않는다', () => {
    expect(resolveWeatherGlyph(SKY_UNKNOWN, NO_RAIN)).toBeNull()
    expect(resolveWeatherGlyph(SKY_UNKNOWN, PRECIP_UNKNOWN)).toBeNull()
  })

  /* 강수형태가 UNKNOWN 이면 강수로 치지 않는다 — 하늘상태로 떨어진다 */
  it('강수형태가 UNKNOWN 이면 하늘상태로 떨어진다', () => {
    expect(resolveWeatherGlyph(CLEAR, PRECIP_UNKNOWN)).toEqual({ kind: 'sun', name: '맑음' })
  })

  it('강수형태가 없어도 하늘상태만으로 그린다', () => {
    expect(resolveWeatherGlyph(CLEAR, null)).toEqual({ kind: 'sun', name: '맑음' })
  })

  it('하늘상태가 없어도 강수형태만으로 그린다', () => {
    expect(resolveWeatherGlyph(null, RAIN)).toEqual({ kind: 'rain', name: '비' })
  })

  /*
    **모르는 코드를 빈 자리로 두지 않는다.** 서버가 코드를 하나 더 내면 그림 대신 서버
    낱말을 그대로 적는다 — 아는 코드만 나열해 두고 나머지를 지우는 구조가 되지 않는다.
  */
  it('모르는 코드는 그림 없이 서버 낱말을 남긴다', () => {
    expect(resolveWeatherGlyph(meta('HAIL_STORM', '우박'), NO_RAIN)).toEqual({
      kind: null,
      name: '우박',
    })
    expect(resolveWeatherGlyph(CLEAR, meta('HAIL', '우박'))).toEqual({ kind: null, name: '우박' })
  })
})
