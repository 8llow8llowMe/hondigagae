import { describe, expect, it } from 'vitest'

import {
  congestionsPath,
  recommendationsPath,
  suitabilityPath,
  toInsightQuery,
  toPetCondition,
  walkSafetyPath,
} from '@/lib/api/insight'
import { CONGESTION_DAYS } from '@/lib/insight/congestion'
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

/*
  기간 혼잡도 (#430). 계약은 dev Swagger 실측(2026-09-14)이다 —
  `fromDate` 기본 오늘 · `days` 기본 7(1~30) · 반려견 조건 파라미터 없음.
*/
describe('기간 혼잡도 경로 (#430)', () => {
  /*
    **기본값이어도 명시한다.** 백엔드 기본값이 7 에서 바뀌면 응답 기간이 조용히 달라지고,
    카드 머리의 기간 표기만 서버를 따라가 화면이 스스로 어긋난다.
  */
  it('기본 기간도 days 를 실어 보낸다', () => {
    expect(congestionsPath('123', CONGESTION_DAYS.week)).toBe('/places/123/congestions?days=7')
  })

  it('펼침은 30일이다 — 혼잡도 예측이 닿는 끝까지다', () => {
    expect(congestionsPath('123', CONGESTION_DAYS.month)).toBe('/places/123/congestions?days=30')
  })

  /*
    **`fromDate` 를 보내지 않는다.** 생략하면 서버가 오늘로 잡는다 — 권역 비교(`date`)와
    같은 판단이다. FE 가 날짜를 만들면 브라우저 타임존이 KST 가 아닌 사용자에게 어제부터의
    기간이 나간다.
  */
  it('fromDate 를 보내지 않는다 — 오늘은 서버가 정한다', () => {
    expect(congestionsPath('123', CONGESTION_DAYS.week)).not.toContain('fromDate')
  })

  /*
    **반려견 조건을 싣지 않는다.** 붐빔은 장소와 날짜의 속성이라 반려견이 바뀌어도 같은
    답이고, 실으면 조회 key 가 반려견마다 갈려 같은 응답을 여러 벌 캐시한다.
  */
  it('반려견 조건이 섞이지 않는다', () => {
    const path = congestionsPath('123', CONGESTION_DAYS.week)

    expect(path).not.toContain('petSizeType')
    expect(path).not.toContain('petSociality')
    expect(path).not.toContain('heatSensitive')
  })
})

/*
  장소 추천 (#1368 · #1380). 계약은 origin/develop 소스 실측(2026-10-11) —
  `PlaceInsightWebController#getRecommendations`: 반려견 조건 7종(적합도와 같은 이름) · `limit` 1~10(기본 3) ·
  `targetDate` 선택(기본 오늘).
*/
describe('장소 추천 경로 (#1380)', () => {
  /*
    **적합도와 같은 조립을 쓴다.** 추천 카드의 점수와 그 장소 상세의 적합도가 같은 조건에서 갈리면
    둘 중 하나가 거짓이 된다(BE §6-5) — 조건을 싣는 함수가 둘이면 그 갈림이 FE 에서 생긴다.
  */
  it('반려견 조건을 적합도와 같은 쿼리로 싣는다', () => {
    const condition = toPetCondition(pet)
    const query = new URLSearchParams(recommendationsPath(condition, 3).split('?')[1])
    const suitability = new URLSearchParams(suitabilityPath('123', condition).split('?')[1])

    query.delete('limit')
    expect(query.toString()).toBe(suitability.toString())
  })

  /* 기본값(3)이어도 명시한다 — 홈 카드 수와 서버 기본값이 갈리면 카드 수가 조용히 바뀐다 */
  it('limit 을 늘 싣는다', () => {
    expect(recommendationsPath(null, 3)).toBe('/places/recommendations?limit=3')
    expect(recommendationsPath(toPetCondition(pet), 5)).toContain('limit=5')
  })

  /* 오늘은 서버가 정한다 — 브라우저 타임존이 KST 가 아니면 어제를 묻게 된다 (권역 비교와 같은 판단) */
  it('targetDate 를 보내지 않는다', () => {
    expect(recommendationsPath(toPetCondition(pet), 3)).not.toContain('targetDate')
  })
})
