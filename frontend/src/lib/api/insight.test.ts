import { describe, expect, it } from 'vitest'

import { suitabilityPath, toInsightQuery, toPetCondition, walkSafetyPath } from '@/lib/api/insight'
import type { Pet } from '@/types/pet'

const pet: Pet = {
  petId: '1',
  name: '몽실이',
  breed: '말티즈',
  birthYm: '2022-04',
  age: 4,
  sizeType: { code: 'SMALL', name: '소형견' },
  weightKg: null,
  profileImageUrl: null,
  representative: false,
  heatSensitive: true,
  coldSensitive: false,
  noiseSensitive: false,
  activityLevel: { code: 'MEDIUM', name: '보통' },
  walkPreferred: true,
  sociality: { code: 'HIGH', name: '높음' },
}

describe('toPetCondition', () => {
  it('반려견 속성을 조건으로 옮긴다 — petId 는 보내지 않는다', () => {
    const condition = toPetCondition(pet)

    expect(condition).toEqual({
      petSizeType: 'SMALL',
      heatSensitive: true,
      coldSensitive: false,
      noiseSensitive: false,
      activityLevel: 'MEDIUM',
      breed: '말티즈',
      petSociality: 'HIGH',
    })
    expect(JSON.stringify(condition)).not.toContain('petId')
  })

  it('반려견이 없으면 null 이다 — 일반 판정으로 조회한다', () => {
    expect(toPetCondition(null)).toBeNull()
  })
})

describe('toInsightQuery', () => {
  it('boolean 3종을 명시적으로 보낸다 — 백엔드 기본값에 기대지 않는다', () => {
    const query = toInsightQuery(toPetCondition(pet))

    expect(query).toContain('heatSensitive=true')
    expect(query).toContain('coldSensitive=false')
    expect(query).toContain('noiseSensitive=false')
  })

  it('null 인 enum 파라미터를 넣지 않는다 — 빈 문자열은 400 이 된다', () => {
    const query = toInsightQuery({
      petSizeType: null,
      heatSensitive: false,
      coldSensitive: false,
      noiseSensitive: false,
      activityLevel: null,
      breed: null,
      petSociality: null,
    })

    expect(query).not.toContain('petSizeType')
    expect(query).not.toContain('activityLevel')
    expect(query).not.toContain('breed')
    expect(query).not.toContain('petSociality')
  })

  /*
    **사회성은 적합도만 읽는다** (#430 · BE #425). 혼잡 `HIGH` 인 날 `LOW` 인 아이의
    감점이 커지고 근거 문장이 함께 내려온다 — 넘기지 않으면 서버가 그 축을 못 본다.

    dev Swagger 실측(2026-09-13): `petSociality` 를 선언하는 경로는
    `/places/{placeId}/suitability` 하나뿐이고 enum 은 `LOW` · `MEDIUM` · `HIGH` 다.
    나머지 셋에도 같이 실려 가지만 Spring 이 모르는 파라미터를 무시한다 — 축마다 다른
    조립을 두지 않는 이유는 `walkTimesPath` 주석에 있다.
  */
  it('사회성을 보낸다 — 적합도가 혼잡 축에서 읽는 값이다', () => {
    expect(toInsightQuery(toPetCondition(pet))).toContain('petSociality=HIGH')
  })

  it('조건이 없으면 빈 문자열이다', () => {
    expect(toInsightQuery(null)).toBe('')
  })

  it('견종을 URL 인코딩한다', () => {
    expect(toInsightQuery(toPetCondition(pet))).toContain('breed=%EB%A7%90%ED%8B%B0%EC%A6%88')
  })
})

describe('경로 조립', () => {
  it('조건이 없으면 물음표를 붙이지 않는다', () => {
    expect(suitabilityPath('123', null)).toBe('/places/123/suitability')
    expect(walkSafetyPath('123', null)).toBe('/places/123/walk-safety')
  })

  it('조건이 있으면 쿼리를 붙인다', () => {
    expect(suitabilityPath('123', toPetCondition(pet))).toContain('/places/123/suitability?')
  })

  /* 적합도가 실제로 이 값을 달고 나가는지 — 조립 단계만 보면 경로에서 빠져도 모른다 */
  it('적합도 경로에 사회성이 실린다', () => {
    expect(suitabilityPath('123', toPetCondition(pet))).toContain('petSociality=HIGH')
  })
})
