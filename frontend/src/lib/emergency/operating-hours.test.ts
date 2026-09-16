import { describe, expect, it } from 'vitest'

import {
  parseRestDays,
  parseWeeklyHours,
  summarizeTodayHours,
  todayHoursLabel,
} from '@/lib/emergency/operating-hours'
import { facility } from '@/test/fixtures/emergency'

/**
 * 운영시간 원문 요약 (#654 E-4).
 *
 * **이 파일이 지키는 것은 "틀린 시간을 말하지 않는다" 하나다.** 두 번 기각된 파싱을
 * 다시 여는 대신(`facility-row.tsx` 머리주석 · `types/emergency.ts` `operatingHours`),
 * 읽지 못하는 원문은 전부 `null` 로 떨어뜨려 호출부가 원문을 그대로 그리게 한다.
 */

/**
 * 2026-09-16 은 수요일, 2026-09-19 는 토요일이다.
 *
 * **ISO 문자열로 만들지 않는다.** `summarizeTodayHours` 는 `getDay()`·`getHours()` 로
 * **그 기기의 현지 시각**을 읽는데(사용자는 제주에 있다), 오프셋을 박은 문자열은 CI 의
 * TZ 에 따라 다른 시·요일로 읽힌다. 로컬 성분으로 만들면 어느 TZ 에서도 같은 값이다.
 */
function at(day: number, hour: number, minute = 0): Date {
  return new Date(2026, 8, day, hour, minute)
}

describe('parseWeeklyHours — 원문을 요일별 구간으로', () => {
  it('요일 범위와 단일 요일을 함께 읽는다', () => {
    const weekly = parseWeeklyHours('월~금 09:00~19:00, 토 09:00~13:00')

    expect(weekly).not.toBeNull()
    // 0=일 … 6=토 (`Date.getDay()` 색인)
    expect(weekly?.[1]).toMatchObject({ fromLabel: '09:00', toLabel: '19:00' })
    expect(weekly?.[5]).toMatchObject({ fromLabel: '09:00', toLabel: '19:00' })
    expect(weekly?.[6]).toMatchObject({ fromLabel: '09:00', toLabel: '13:00' })
    expect(weekly?.[0]).toBeUndefined()
  })

  /*
    dev 실측 문자열 — 쉼표로 끊긴 앞 조각에 시각이 없고 뒤 조각의 시각을 함께 쓴다.
    **수요일이 통째로 빠져 있다**: 이것을 못 읽고 첫 줄을 오늘로 삼으면 닫힌 병원으로
    달려가게 된다 (`FacilityHours` 머리주석이 두 번 기각한 실패다).
  */
  it('시각이 없는 앞 조각은 뒤 조각의 시각을 이어받고, 빠진 요일은 빠진 채로 둔다', () => {
    const weekly = parseWeeklyHours('월~화, 목~금,토 09:30~20:00, 일 09:30~14:00')

    expect(weekly?.[1]).toMatchObject({ fromLabel: '09:30', toLabel: '20:00' })
    expect(weekly?.[2]).toMatchObject({ fromLabel: '09:30', toLabel: '20:00' })
    expect(weekly?.[4]).toMatchObject({ fromLabel: '09:30', toLabel: '20:00' })
    expect(weekly?.[6]).toMatchObject({ fromLabel: '09:30', toLabel: '20:00' })
    expect(weekly?.[0]).toMatchObject({ fromLabel: '09:30', toLabel: '14:00' })
    // 수요일은 없다
    expect(weekly?.[3]).toBeUndefined()
  })

  /*
    `법정공휴일` 은 요일이 아니라 **날짜 성격**이다. 오늘이 공휴일인지 FE 가 알 수 없으므로
    그 조각만 버리고 나머지 요일은 살린다 — 조각 하나 때문에 원문 전체를 포기하면
    dev 에서 가장 흔한 서식이 요약을 받지 못한다.
  */
  it('법정공휴일 조각은 건너뛰고 나머지 요일을 읽는다', () => {
    const weekly = parseWeeklyHours('월~금 09:00~21:00, 토 09:00~21:00, 법정공휴일 09:00~21:00')

    expect(weekly?.[1]).toMatchObject({ toLabel: '21:00' })
    expect(weekly?.[6]).toMatchObject({ toLabel: '21:00' })
    expect(weekly?.[0]).toBeUndefined()
  })

  it('모르는 말이 하나라도 섞이면 통째로 포기한다', () => {
    expect(parseWeeklyHours('연중무휴 24시간')).toBeNull()
    expect(parseWeeklyHours('예약제')).toBeNull()
    expect(parseWeeklyHours('월~금 09시~19시')).toBeNull()
    expect(parseWeeklyHours('')).toBeNull()
  })

  it('연중무휴는 주 7일로 편다', () => {
    const weekly = parseWeeklyHours('연중무휴 09:00~18:00')

    expect(Object.keys(weekly ?? {})).toHaveLength(7)
  })

  /*
   **`격주 무휴` 는 주 7일이 아니다.** `includes('무휴')` 로 잡던 예전 코드는 이것을
   **매일 09:00~18:00** 으로 펴, 쉬는 주에 "오늘 18:00까지" 라고 말했다.
   */
  it('격주 무휴를 주 7일로 펴지 않는다', () => {
    expect(parseWeeklyHours('격주 무휴 09:00~18:00')).toBeNull()
  })

  it('같은 요일에 서로 다른 시각이 붙으면 포기한다 — 어느 쪽이 맞는지 알 수 없다', () => {
    expect(parseWeeklyHours('월 09:00~12:00, 월 14:00~18:00')).toBeNull()
  })

  it('자정을 넘기는 구간은 다음 날로 이어 읽는다', () => {
    const weekly = parseWeeklyHours('월~일 22:00~02:00')

    expect(weekly?.[1]).toMatchObject({ from: 22 * 60, to: 26 * 60, toLabel: '02:00' })
  })
})

describe('parseRestDays — 매주 반복되는 휴무만 읽는다', () => {
  it('요일 하나로 옮겨지는 문구를 읽는다', () => {
    expect(parseRestDays(null)).toEqual(new Set())
    expect(parseRestDays('연중무휴')).toEqual(new Set())
    expect(parseRestDays('일요일')).toEqual(new Set([0]))
    // `매주` 는 매주 반복이라 요일 하나로 정확히 옮겨진다
    expect(parseRestDays('매주 수요일')).toEqual(new Set([3]))
  })

  /*
    **서수·주기 수식어가 붙으면 통째로 포기한다.** 이 모듈의 단위는 요일이고
    `weekly[3]` 은 "수요일" 이지 "몇 번째 수요일" 이 아니다 — 눌러 담으면 **여는 날이
    휴무로 승격**된다. 예전에는 요일 글자만 훑어 넷 중 셋이 매주 휴무가 됐고,
    마지막 하나만 요일 글자가 없어 **우연히** 통과했다.
  */
  it.each([
    '둘째·넷째 수요일',
    '매월 셋째 토요일',
    '둘째, 넷째 일요일 휴진',
    '둘째 넷째 주 정기 휴진',
    '격주 목요일',
    '마지막 주 화요일',
  ])('달 단위·격주 주기는 null — %s', (restDate) => {
    expect(parseRestDays(restDate)).toBeNull()
  })

  /*
    **`무휴` 를 부분 문자열로 보지 않는다.** `includes('무휴')` 는 `격주 무휴` 를
    "휴무 없음" 으로 읽어 같은 계열의 거짓말을 만든다 — 주기를 모르면 "모르겠다" 가
    안전한 실패이지 "쉬는 날 없음" 이 아니다.
  */
  it('격주 무휴를 연중무휴로 읽지 않는다', () => {
    expect(parseRestDays('격주 무휴')).toBeNull()
  })
})

describe('summarizeTodayHours — 오늘 한 줄', () => {
  /** 2026-09-16(수) 11:00 */
  const wedMorning = at(16, 11)

  it('24시간으로 확인된 곳은 마감 시각을 말하지 않는다', () => {
    const summary = summarizeTodayHours(
      facility({ open24: true, openNow: true, operatingHours: '연중무휴 24시간' }),
      wedMorning,
    )

    expect(summary).toEqual({ kind: 'open24' })
  })

  it('진료중이면 오늘 마감 시각을 말한다', () => {
    const summary = summarizeTodayHours(
      facility({
        open24: false,
        openNow: true,
        restDate: null,
        operatingHours: '월~금 09:00~19:00, 토 09:00~13:00',
      }),
      wedMorning,
    )

    expect(summary).toEqual({ kind: 'openUntil', until: '19:00' })
  })

  it('오늘 아직 열기 전이면 오늘 여는 시각을 말한다', () => {
    const summary = summarizeTodayHours(
      facility({
        open24: false,
        openNow: false,
        restDate: null,
        operatingHours: '월~금 09:00~19:00',
      }),
      at(16, 7, 30),
    )

    expect(summary).toEqual({ kind: 'opensAt', dayOffset: 0, weekday: 3, at: '09:00' })
    expect(todayHoursLabel(summary!)).toBe('오늘 09:00부터')
  })

  it('오늘 문을 닫았으면 내일 여는 시각을 말한다', () => {
    const summary = summarizeTodayHours(
      facility({
        open24: false,
        openNow: false,
        restDate: null,
        operatingHours: '월~금 10:00~19:00',
      }),
      at(16, 21),
    )

    expect(summary).toEqual({ kind: 'opensAt', dayOffset: 1, weekday: 4, at: '10:00' })
    expect(todayHoursLabel(summary!)).toBe('내일 10:00부터')
  })

  /*
    **오늘이 휴무일이면 다음 영업일을 찾는다** (#654). 토요일 21시 · 일요일 휴무 ·
    원문에 일요일 항목이 없으면 다음 영업일은 이틀 뒤 월요일이다 — "내일" 이라고 쓰면
    닫힌 병원 앞에 서게 된다.
  */
  it('내일이 휴무거나 원문에 없으면 그 다음 영업일까지 건너뛴다', () => {
    const summary = summarizeTodayHours(
      facility({
        open24: false,
        openNow: false,
        restDate: '일요일',
        operatingHours: '월~금 10:00~19:00, 토 10:00~14:00',
      }),
      // 2026-09-19 는 토요일
      at(19, 21),
    )

    expect(summary).toEqual({ kind: 'opensAt', dayOffset: 2, weekday: 1, at: '10:00' })
    expect(todayHoursLabel(summary!)).toBe('월요일 10:00부터')
  })

  it('휴무일 당일에는 다음 영업일을 말한다', () => {
    const summary = summarizeTodayHours(
      facility({
        open24: false,
        openNow: false,
        restDate: '수요일',
        operatingHours: '월~일 10:00~19:00',
      }),
      wedMorning,
    )

    expect(summary).toEqual({ kind: 'opensAt', dayOffset: 1, weekday: 4, at: '10:00' })
  })

  describe('읽지 못하면 아무 말도 하지 않는다 — 호출부가 원문을 그대로 그린다', () => {
    it('운영시간이 등록되지 않았으면 null', () => {
      expect(
        summarizeTodayHours(
          facility({ operatingHoursKnown: false, operatingHours: null }),
          wedMorning,
        ),
      ).toBeNull()
    })

    /*
      **서버가 판정하지 못한 것을 FE 가 판정하지 않는다.** `openNow === null` 은 "닫힘" 이
      아니라 "판정할 수 없음" 이고(`NearbyFacilityItem` 주석), 머리 배지도 점선 "확인 필요"
      를 단다. 이 줄만 혼자 시각을 확언하면 같은 행이 두 가지를 말한다.
    */
    it('openNow 가 null 이면 null', () => {
      expect(
        summarizeTodayHours(
          facility({ open24: false, openNow: null, operatingHours: '월~금 09:00~19:00' }),
          wedMorning,
        ),
      ).toBeNull()
    })

    it('원문을 읽지 못하면 null', () => {
      expect(
        summarizeTodayHours(
          facility({ open24: false, openNow: true, operatingHours: '예약 후 방문' }),
          wedMorning,
        ),
      ).toBeNull()
    })

    /*
      **서버 `openNow` 와 어긋나면 우리 읽기를 버린다.** 이것이 파싱을 다시 여는 근거다 —
      요약은 서버가 이미 단정한 사실의 **표현**일 뿐이고, 표현이 사실과 갈리는 순간
      표현을 버린다. 수요일이 빠진 원문을 잘못 읽어 "19:00까지" 라고 쓰는 실패가 여기서 막힌다.
    */
    it('원문 판정이 서버 openNow 와 어긋나면 null', () => {
      expect(
        summarizeTodayHours(
          facility({
            open24: false,
            openNow: true,
            restDate: null,
            // 수요일 항목이 없다 — 원문대로면 닫혀 있어야 하는데 서버는 열려 있다고 한다
            operatingHours: '월~화 09:00~19:00, 목~금 09:00~19:00',
          }),
          wedMorning,
        ),
      ).toBeNull()
    })

    it('휴무 문구를 읽지 못하면 null — 다음 영업일을 약속할 수 없다', () => {
      expect(
        summarizeTodayHours(
          facility({
            open24: false,
            openNow: false,
            restDate: '둘째 넷째 주 정기 휴진',
            operatingHours: '월~금 10:00~19:00',
          }),
          at(16, 21),
        ),
      ).toBeNull()
    })

    /*
      **격주·월 단위 휴진을 매주 휴무로 승격시키지 않는다** (리뷰에서 잡힌 결함).

      2026-09-02 는 **첫째** 수요일이라 `둘째·넷째 수요일` 휴무인 곳은 **여는 날**이다.
      08:00 에 서버는 `openNow=false`(아직 안 열림)라고 하고, 요일 글자만 훑던 예전
      코드는 오늘을 휴무로 보아 **`내일 09:00부터`** 를 내놓았다 — 한 시간 뒤 여는
      병원을 하루 뒤로 민다.

      **`openNow` 가드가 이것을 못 잡는다.** 08:00 시점엔 "휴무다" 와 "아니다" 두 읽기가
      **둘 다 «지금 닫힘»** 이라 불리언이 일치한다 (머리주석 "남는 위험" 1).
    */
    it('여는 날 아침에 격주 휴진을 매주 휴무로 읽어 하루 미루지 않는다', () => {
      const summary = summarizeTodayHours(
        facility({
          open24: false,
          openNow: false,
          restDate: '둘째·넷째 수요일',
          operatingHours: '월~금 09:00~18:00',
        }),
        // 2026-09-02(수) 08:00 — 첫째 수요일이라 오늘 09:00 에 연다
        at(2, 8),
      )

      expect(summary).toBeNull()
    })

    it('24시간인데 서버가 진료중이라고 하지 않으면 null', () => {
      expect(
        summarizeTodayHours(
          facility({ open24: true, openNow: false, operatingHours: '연중무휴 24시간' }),
          wedMorning,
        ),
      ).toBeNull()
    })
  })
})

describe('todayHoursLabel — 문구', () => {
  it('네 갈래를 모두 문장으로 만든다', () => {
    expect(todayHoursLabel({ kind: 'open24' })).toBe('24시간 운영')
    expect(todayHoursLabel({ kind: 'openUntil', until: '24:00' })).toBe('오늘 24:00까지')
    expect(todayHoursLabel({ kind: 'opensAt', dayOffset: 1, weekday: 4, at: '10:00' })).toBe(
      '내일 10:00부터',
    )
    expect(todayHoursLabel({ kind: 'closedToday' })).toBe('오늘은 쉬어요')
  })
})
