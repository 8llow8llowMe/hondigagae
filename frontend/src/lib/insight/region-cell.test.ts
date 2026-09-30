import { describe, expect, it } from 'vitest'

import {
  regionTemperatureText,
  scoreBarPercent,
  soleRecommendedCode,
} from '@/lib/insight/region-cell'
import { messages } from '@/lib/messages'
import type { CodeNameMetadata } from '@/types/api'
import type { RegionWeatherItem } from '@/types/insight'

/** 이 파일의 함수가 보는 것은 `region.code` · `weatherScore` 뿐이다 */
function region(code: string, weatherScore: number | null): RegionWeatherItem {
  return {
    region: { code, name: `${code}권`, description: null },
    weatherScore,
  } as RegionWeatherItem
}

function meta(code: string): CodeNameMetadata {
  return { code, name: `${code}권`, description: null }
}

/*
  #1068. `최고`·`최저` 두 줄을 `24–31℃` 한 줄로 줄인다. 기온은 #1067 의 "혼자 서는 값"
  표기(`formatStandaloneCelsius`)를 따른다 — 정수면 `.0` 을 떼고 소수는 버리지 않는다.
*/
describe('regionTemperatureText (#1068)', () => {
  it('최저와 최고를 한 줄 범위로 쓴다', () => {
    expect(regionTemperatureText(24, 31)).toBe('24–31℃')
  })

  it('정수의 .0 은 떼고 의미 있는 소수는 남긴다 (#1067)', () => {
    expect(regionTemperatureText(24.0, 27.5)).toBe('24–27.5℃')
  })

  /* dev 는 두 값이 같은 날이 많다 — `31–31℃` 는 범위가 아니라 한 값이다 */
  it('두 값이 같으면 한 값만 쓴다', () => {
    expect(regionTemperatureText(31, 31)).toBe('31℃')
  })

  /*
    한쪽만 오면 범위를 만들 수 없다. 접두 없이 `31℃` 만 두면 그것이 최고인지 최저인지
    알 수 없으므로 (#206) 그 값의 이름을 붙인다.
  */
  it('최고만 있으면 최고임을 밝힌다', () => {
    expect(regionTemperatureText(null, 31)).toBe(`${messages.home.regionTempPrefix} 31℃`)
  })

  it('최저만 있으면 최저임을 밝힌다', () => {
    expect(regionTemperatureText(24, null)).toBe(`${messages.home.regionMinTempPrefix} 24℃`)
  })

  it('둘 다 없으면 줄을 내지 않는다', () => {
    expect(regionTemperatureText(null, null)).toBeNull()
  })

  /* 서버가 준 순서를 뒤집지 않는다 — 값을 고치는 것은 FE 의 일이 아니다 */
  it('영하도 부호를 지킨다', () => {
    expect(regionTemperatureText(-3, 4)).toBe('-3–4℃')
  })
})

/*
  #1068. `추천` 표시는 **서버가 추천을 낸 날의 단독 1위**에만 붙는다 — 헤드라인
  (`Recommendation`)이 `가장 나아요` 라고 말하는 날과 정확히 같다.
*/
describe('soleRecommendedCode (#1068)', () => {
  it('서버 추천 권역이 단독 1위면 그 코드다', () => {
    expect(soleRecommendedCode([region('NORTH', 72), region('SOUTH', 86)], meta('SOUTH'))).toBe(
      'SOUTH',
    )
  })

  /* 경보 날 — 서버가 막아 둔 문을 칸 표시가 다시 열지 않는다 */
  it('서버가 추천을 내지 않은 날에는 없다', () => {
    expect(soleRecommendedCode([region('NORTH', 72), region('SOUTH', 86)], null)).toBeNull()
  })

  /* 동점 날 헤드라인은 1위를 단정하지 않는다 (#638) — 칸 표시도 한 곳을 고르지 않는다 */
  it('최고점이 동점이면 없다', () => {
    expect(
      soleRecommendedCode([region('NORTH', 100), region('SOUTH', 100)], meta('SOUTH')),
    ).toBeNull()
  })

  it('예보 없는 권역은 동점 셈에 들어가지 않는다', () => {
    expect(soleRecommendedCode([region('SOUTH', 86), region('HALLA', null)], meta('SOUTH'))).toBe(
      'SOUTH',
    )
  })

  /*
    서버가 최고점이 아닌 권역을 고른 날. 헤드라인은 서버를 따르므로 칸 표시도 서버를
    따른다 — 점수가 가장 높은 칸을 FE 가 다시 고르면 문장과 표가 다른 곳을 가리킨다.
  */
  it('서버 추천이 최고점이 아니어도 서버가 고른 권역이다', () => {
    expect(soleRecommendedCode([region('NORTH', 90), region('SOUTH', 86)], meta('SOUTH'))).toBe(
      'SOUTH',
    )
  })
})

describe('scoreBarPercent (#1068)', () => {
  it('점수가 곧 막대 길이다 — 100점 만점', () => {
    expect(scoreBarPercent(86)).toBe(86)
  })

  /* 계약은 0~100 이지만 막대가 칸 밖으로 나가거나 음수 폭이 되지 않게 가둔다 */
  it('범위 밖 값은 0~100 으로 가둔다', () => {
    expect(scoreBarPercent(-5)).toBe(0)
    expect(scoreBarPercent(120)).toBe(100)
  })
})
