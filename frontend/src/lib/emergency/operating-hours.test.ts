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
  /*
    **`open24` 만 `null` 이다** (#654 · 디자인 리뷰). 머리의 `[24시간]` 배지가 이미 말하고
    있어 이 줄이 더하는 정보가 0비트다 — 상태 절을 배지에 넘긴 것(D12-2) · 펼치기를
    걷은 것(D12-4)과 같은 논리의 세 번째 적용이다.

    **`summarizeTodayHours` 의 `null` 과 뜻이 다르다.** 그쪽은 "읽지 못했다"(→ 원문을
    그린다)이고 이쪽은 "읽었는데 새로 말할 것이 없다"(→ 아무것도 그리지 않는다).
  */
  it('24시간 갈래는 그릴 줄이 없다 — null', () => {
    expect(todayHoursLabel({ kind: 'open24' })).toBeNull()
  })

  it('나머지 세 갈래를 문장으로 만든다', () => {
    expect(todayHoursLabel({ kind: 'openUntil', until: '24:00' })).toBe('오늘 24:00까지')
    expect(todayHoursLabel({ kind: 'opensAt', dayOffset: 1, weekday: 4, at: '10:00' })).toBe(
      '내일 10:00부터',
    )
    expect(todayHoursLabel({ kind: 'closedToday' })).toBe('오늘은 쉬어요')
  })
})

/*
  **휴무 문구 파싱을 넓힌다** (#671 B-4-a).

  dev 실물 135곳 측정에서 폴백 33건 중 **15건이 "요일 시각은 읽혔는데 휴무 문구를 못 읽어"**
  통째로 원문으로 떨어졌다. 요일 시각을 이미 읽은 뒤라 가장 아까운 갈래다.

  **넓히되 `IRREGULAR_CYCLE` 가드는 그대로 둔다.** 그 가드가 막는 것(`격주 무휴` 를
  `연중무휴` 로 읽는 것)은 **틀린 요약을 만드는 쪽**이라, 넓히다가 그 문이 열리면
  B-4 측정이 확인한 "가드 오판 0건" 이 깨진다.
*/
describe('parseRestDays — 넓힌 서식 (#671 B-4-a)', () => {
  /* `월요일` 이 아니라 `월` 로 적는 곳이 많다 — `요일` 접미사를 요구하지 않는다 */
  it('요일 접미사 없는 단축형을 읽는다', () => {
    expect(parseRestDays('월,화 휴무')).toEqual(new Set([1, 2]))
    expect(parseRestDays('월·화 휴무')).toEqual(new Set([1, 2]))
    expect(parseRestDays('일 휴무')).toEqual(new Set([0]))
  })

  it('요일 범위를 읽는다 — 물결표와 붙임표 둘 다', () => {
    expect(parseRestDays('월~금 휴무')).toEqual(new Set([1, 2, 3, 4, 5]))
    expect(parseRestDays('토-일 휴무')).toEqual(new Set([6, 0]))
    // `요일` 접미사가 붙은 범위도 범위다 — 예전에는 양끝 두 개만 읽어 사이를 흘렸다
    expect(parseRestDays('월요일~수요일 휴진')).toEqual(new Set([1, 2, 3]))
  })

  /*
    `법정공휴일` 은 요일이 아니라 **날짜 성격**이라 요일 하나로 옮길 수 없다.
    `parseDayChunk`(주간시간)에는 있던 처리가 여기에는 없어, 요일을 읽고도 통째로
    포기하고 있었다 — 그 조각만 버리고 나머지 요일은 살린다.
  */
  it('법정공휴일 조각은 건너뛰고 나머지 요일을 읽는다', () => {
    expect(parseRestDays('일요일, 법정공휴일')).toEqual(new Set([0]))
    expect(parseRestDays('일 공휴일 휴무')).toEqual(new Set([0]))
  })

  /*
    **공휴일만 적힌 곳은 그대로 폴백이다.** 여기서 빈 집합을 돌려주면 "매주 쉬는 날이
    없다" 고 **단정**하는 것인데, 오늘이 공휴일인지 FE 는 알 수 없다. 주간시간 쪽의
    `'skip'` 은 요일을 더하지 않을 뿐이라 정보 중립이지만, 휴무 쪽의 같은 자리는
    중립이 아니다 — 모르는 것을 아는 것처럼 말하지 않는다.
  */
  it('공휴일만 적힌 문구는 여전히 null — 오늘이 공휴일인지 알 수 없다', () => {
    expect(parseRestDays('법정공휴일')).toBeNull()
    expect(parseRestDays('공휴일 휴무')).toBeNull()
  })

  /* 넓힌 뒤에도 주기 가드가 먼저다 — 넓히기가 `IRREGULAR_CYCLE` 의 문을 열지 않는다 */
  it('주기 수식어가 붙은 넓힌 서식도 null', () => {
    expect(parseRestDays('격주 월~금 휴무')).toBeNull()
    expect(parseRestDays('매월 첫째 월,화 휴무')).toBeNull()
  })

  /*
    **군더더기를 지운 자리가 없던 요일을 만들지 않는다.** `정기휴무일` 에서 `정기휴무` 만
    지우면 `일` 하나가 남아 **일요일 휴무**가 된다 — 긴 말을 먼저 지워야 한다.
  */
  it.each(['정기휴무일', '정기휴진일', '휴관일', '휴업일'])(
    '군더더기 끝의 `일` 을 일요일로 읽지 않는다 — %s',
    (restDate) => {
      expect(parseRestDays(restDate)).toBeNull()
    },
  )

  /* 넓힐 수 없는 형태는 그대로 폴백이다 — 원문을 보여주는 쪽이 맞다 */
  it('읽을 수 없는 문구는 여전히 null', () => {
    expect(parseRestDays('예약제')).toBeNull()
    expect(parseRestDays('명절 당일')).toBeNull()
    expect(parseRestDays('월과 화')).toBeNull()
  })
})

describe('parseWeeklyHours — 붙임표 범위 (#671 B-4-a)', () => {
  /* 휴무 쪽과 같은 범위 문법을 쓴다 — `월-금` 도 범위다 */
  it('붙임표로 적은 요일 범위를 읽는다', () => {
    const weekly = parseWeeklyHours('월-금 09:00~19:00')

    expect(weekly?.[1]).toMatchObject({ fromLabel: '09:00', toLabel: '19:00' })
    expect(weekly?.[5]).toMatchObject({ fromLabel: '09:00', toLabel: '19:00' })
    expect(weekly?.[6]).toBeUndefined()
  })
})

/*
  **다음 영업일 탐색이 한 바퀴를 넘지 않는다** (#671 F-3).

  예전 루프는 `offset <= 7` 이라 `offset = 7` 에서 `weekday = (today + 7) % 7 = today` —
  **오늘 요일 이름**이 다음 영업일로 나왔다. 주 하루만 여는 곳에서 그날 마감 뒤에 서면
  `월요일 09:00부터`. 다음 주가 맞지만 화면에서는 **오늘 아침**으로 되읽힌다.

  한 바퀴를 돌아 아무 날도 못 찾으면 `closedToday` 다 — 주 하루만 여는 곳에서
  "오늘은 더 열지 않는다" 는 사실 자체가 사용자가 당장 필요한 정보다.
*/
describe('summarizeTodayHours — 다음 영업일은 엿새까지만 본다 (#671 F-3)', () => {
  it('주 하루만 여는 곳에서 마감 뒤에 오늘 요일을 다음 영업일로 말하지 않는다', () => {
    const summary = summarizeTodayHours(
      facility({
        open24: false,
        openNow: false,
        restDate: null,
        operatingHours: '월 09:00~12:00',
      }),
      // 2026-09-14 는 월요일 — 12:00 마감 뒤인 15:00
      at(14, 15),
    )

    expect(summary).toEqual({ kind: 'closedToday' })
    expect(todayHoursLabel(summary!)).toBe('오늘은 쉬어요')
  })

  /* 엿새 뒤까지는 그대로 읽는다 — 줄인 것은 일곱째 날뿐이다 */
  it('엿새 뒤 영업일은 요일로 말한다', () => {
    const summary = summarizeTodayHours(
      facility({
        open24: false,
        openNow: false,
        restDate: null,
        operatingHours: '화 09:00~12:00',
      }),
      // 2026-09-16(수) 15:00 → 엿새 뒤 화요일
      at(16, 15),
    )

    expect(summary).toEqual({ kind: 'opensAt', dayOffset: 6, weekday: 2, at: '09:00' })
    expect(todayHoursLabel(summary!)).toBe('화요일 09:00부터')
  })
})
