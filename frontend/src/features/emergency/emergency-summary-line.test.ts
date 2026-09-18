import { describe, expect, it } from 'vitest'

import {
  emergencyBasisLabel,
  emergencyHeadSubtitle,
} from '@/features/emergency/emergency-summary-line'
import { messages } from '@/lib/messages'
import { facility, facilityResult, pharmacy } from '@/test/fixtures/emergency'
/*
  **기준 문구를 한 곳에 모았다** (#639). 예전에는 목록이 두 갈래, 지도가 세 갈래를 각자
  인라인으로 갖고 있어 `region` 이 늘었을 때 한쪽만 고쳐질 자리였다.
*/
describe('emergencyBasisLabel — 무엇을 기준으로 잰 거리인가 (#639)', () => {
  it('네 갈래가 서로 다른 말을 한다', () => {
    expect(emergencyBasisLabel('current', null)).toBe(messages.emergency.basisCurrent)
    expect(emergencyBasisLabel('map', null)).toBe(messages.emergency.basisMap)
    expect(emergencyBasisLabel('jeju', null)).toBe(messages.emergency.basisJeju)
    expect(emergencyBasisLabel('region', 'SEOGWIPO')).toBe('서귀포 기준')
  })

  it('네 권역이 각자의 이름으로 불린다', () => {
    expect(emergencyBasisLabel('region', 'JEJU_CITY')).toBe('제주시 기준')
    expect(emergencyBasisLabel('region', 'EAST')).toBe('동부 기준')
    expect(emergencyBasisLabel('region', 'WEST')).toBe('서부 기준')
  })

  /* 만들어지지 않는 조합이지만 타입으로 못 박을 수 없다 — 거짓 라벨 대신 가장 약한 주장 */
  it('권역 기준인데 권역이 없으면 제주 중심으로 떨어진다', () => {
    expect(emergencyBasisLabel('region', null)).toBe(messages.emergency.basisJeju)
  })
})

describe('emergencyHeadSubtitle — 카드 부제 (#639 · #675)', () => {
  /*
    **네 갈래** (#675 D16-5). 기본 픽스처는 병원(`제주24시동물병원`, 진료중) · 약국
    (`한라동물약국`, 종료) 둘이다.
  */
  describe('네 갈래 — 검색어 × 권역', () => {
    it('검색어 없음 × 권역 없음 — 제주 전체를 말한다', () => {
      const line = emergencyHeadSubtitle(facilityResult(), null, null)

      expect(line).toBe('제주 2곳 · 지금 진료중 1곳')
    })

    it('검색어 없음 × 서귀포 — "제주" 가 아니라 고른 권역을 말한다', () => {
      const line = emergencyHeadSubtitle(facilityResult(), null, 'SEOGWIPO')

      expect(line).toBe('서귀포 2곳 · 지금 진료중 1곳')
      expect(line).not.toContain('제주')
    })

    it('검색 "한라" × 권역 없음 — 수가 검색 결과 수와 같다', () => {
      /* '한라' 는 약국(`한라동물약국`)만 haystack 에 있다 — 병원은 걸러진다 */
      const line = emergencyHeadSubtitle(facilityResult(), '한라', null)

      expect(line).toBe('‘한라’ 1곳 · 지금 진료중 0곳')
    })

    it('검색 "한라" × 서귀포 — 검색 중에는 지역명을 붙이지 않는다', () => {
      const line = emergencyHeadSubtitle(facilityResult(), '한라', 'SEOGWIPO')

      /* 권역 없음 갈래와 완전히 같은 문자열 — region 이 검색 중엔 조용하다 */
      expect(line).toBe('‘한라’ 1곳 · 지금 진료중 0곳')
      expect(line).not.toContain('서귀포')
    })
  })

  /* 0건 갈래 (#675 D16-6) */
  describe('0건 갈래', () => {
    it('반경 안 0건 — 줄째로 감춘다', () => {
      const empty = facilityResult({ facilities: [], totalCount: 0 })

      expect(emergencyHeadSubtitle(empty, null, null)).toBeNull()
    })

    it('검색 0건 — 줄째로 감춘다', () => {
      const result = facilityResult()

      expect(emergencyHeadSubtitle(result, '존재하지않는키워드', null)).toBeNull()
    })

    /*
      **감추지 않는다.** 검색은 1건을 찾았고, 그 곳이 지금은 닫혀 있을 뿐이다.
      "‘청사’ 1곳 · 지금 진료중 0곳" 은 0건 본문과 싸우지 않고 relief 버튼
      (`지금 진료중 끄기 1곳`)과 같은 근거를 말한다.
    */
    it('검색 1건인데 그 곳이 지금 닫혀 있으면 — 감추지 않는다', () => {
      const result = facilityResult({
        facilities: [facility({ name: '청사동물약국', openNow: false })],
      })

      expect(emergencyHeadSubtitle(result, '청사', null)).toBe('‘청사’ 1곳 · 지금 진료중 0곳')
    })

    /*
      **칩 축(유형·24시간·지금 진료중)은 세지 않는다** (D16-2). 이 결과는 전량이
      "지금 진료중" 이 아니라 — `openNowOnly` 칩을 켜면 목록이 0건이 되는 상황이다.
      그래도 부제는 전량과 진료중 0 을 그대로 말한다 — 칩 때문에 목록만 0건인
      조합에서도 줄이 남는다.
    */
    it('전량이 지금 닫혀 있어도(칩을 켜면 목록 0건) — 부제는 남는다', () => {
      const result = facilityResult({
        facilities: [facility({ openNow: false }), pharmacy({ openNow: false })],
      })

      expect(emergencyHeadSubtitle(result, null, null)).toBe('제주 2곳 · 지금 진료중 0곳')
    })
  })

  /* 현행 유지 갈래 — 새 시그니처로 호출만 고친다 */
  describe('현행 유지 갈래', () => {
    it('응답 전에는 그리지 않는다 — 숫자 없는 부제는 빈 말이다', () => {
      expect(emergencyHeadSubtitle(null, null, null)).toBeNull()
    })

    /*
      **잘린 목록에서는 침묵한다.** `totalCount` 자체는 참이지만 옆에 선 진료중 수가
      받아 온 것만 센 값이라, 한 줄로 묶이면 줄 전체가 거짓말이 된다.
    */
    it('목록이 잘렸으면 줄째로 감춘다 — 틀린 개수는 없는 개수보다 나쁘다', () => {
      const truncated = facilityResult({ totalCount: 136 })

      expect(emergencyHeadSubtitle(truncated, null, null)).toBeNull()
    })

    /* `openNow === null`(영업시간 미등록)은 진료중으로 세지 않는다 */
    it('영업 여부를 모르는 곳은 진료중에 넣지 않는다', () => {
      const result = facilityResult({ facilities: [facility({ openNow: null })] })

      expect(emergencyHeadSubtitle(result, null, null)).toBe('제주 1곳 · 지금 진료중 0곳')
    })
  })
})
