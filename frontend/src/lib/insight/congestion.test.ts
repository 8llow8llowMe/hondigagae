import { describe, expect, it } from 'vitest'

import { barHeightPercent, formatCongestionRange, splitDay } from '@/lib/insight/congestion'

/*
  막대 높이 — **트랙 전체가 집중률 100** 이다. 기간 안 최댓값으로 정규화하면 전부 20 대인
  한산한 주와 전부 80 대인 성수기 주가 같은 그림이 된다.
*/
describe('barHeightPercent', () => {
  it('집중률을 그대로 퍼센트로 쓴다', () => {
    expect(barHeightPercent(37.2)).toBe(37.2)
    expect(barHeightPercent(100)).toBe(100)
  })

  /*
    **0 도 실재하는 값이다** (사람이 없는 날). 높이 0 이면 막대가 사라져 `UNKNOWN`
    (막대 없음)과 화면에서 구별되지 않는다.
  */
  it('아는 값은 최소 높이를 갖는다 — UNKNOWN 과 구별돼야 한다', () => {
    expect(barHeightPercent(0)).toBe(4)
    expect(barHeightPercent(2)).toBe(4)
  })

  it('100 을 넘는 값이 트랙 밖으로 자라지 않는다', () => {
    expect(barHeightPercent(140)).toBe(100)
  })
})

/*
  기간 표기는 **응답의 `fromDate` · `toDate`** 로 만든다. `days` 로 계산하면 서버가 기간을
  자를 때 표기만 늘어난 화면이 된다.
*/
describe('formatCongestionRange', () => {
  it('시작일과 종료일을 짧게 잇는다', () => {
    expect(formatCongestionRange('2026-09-01', '2026-09-07')).toBe('9.1 – 9.7')
  })

  it('하루짜리 기간은 한 번만 쓴다', () => {
    expect(formatCongestionRange('2026-09-01', '2026-09-01')).toBe('9.1')
  })

  /* 못 읽는 날짜에 문자열을 지어내지 않는다 — 호출부가 꼬리표 자체를 내지 않는다 */
  it('날짜를 못 읽으면 null 이다', () => {
    expect(formatCongestionRange('2026-02-31', '2026-09-07')).toBeNull()
    expect(formatCongestionRange('', '')).toBeNull()
  })
})

describe('splitDay', () => {
  /* UTC 자정으로 읽는다 — 로컬로 읽으면 KST 에서 요일이 하루 밀린다 (`lib/date/day.ts`) */
  it('월·일·요일로 가른다', () => {
    expect(splitDay('2026-09-05')).toEqual({ month: '9', day: '5', weekday: '토' })
  })

  it('없는 날짜면 null 이다', () => {
    expect(splitDay('2026-02-31')).toBeNull()
  })
})
