import { describe, expect, it } from 'vitest'

import {
  hasBackwardTime,
  realignedStartTimes,
  startTimesLine,
  timeOrderIssues,
} from '@/lib/plan/time-order'

/**
 * 일정 항목 시각의 역행 · 겹침 — 이슈 #1424.
 *
 * 재현: 순서 편집 뒤 `10:00 → 15:00 → 12:30 → 15:00` 이 경고 없이 확정됐다.
 */
describe('timeOrderIssues — 항목마다 앞 시각과 견준다', () => {
  it('사용성 테스트 재현 — 12:30 은 역행, 마지막 15:00 은 겹침이다', () => {
    expect(timeOrderIssues(['10:00:00', '15:00:00', '12:30:00', '15:00:00'])).toEqual([
      null,
      null,
      'backward',
      'overlap',
    ])
  })

  it('순서대로 흐르면 아무것도 없다', () => {
    expect(timeOrderIssues(['10:00:00', '12:30:00', '15:00:00'])).toEqual([null, null, null])
  })

  it('시각이 없는 항목은 건너뛰고 그 앞의 시각과 견준다', () => {
    expect(timeOrderIssues(['14:00:00', null, '11:00:00'])).toEqual([null, null, 'backward'])
  })

  it('시각이 없는 항목에는 경고를 붙이지 않는다', () => {
    expect(timeOrderIssues([null, '10:00:00', null])).toEqual([null, null, null])
  })

  it('역행한 항목 다음은 **바로 앞 항목**과 견준다 — 경고가 줄줄이 번지지 않는다', () => {
    expect(timeOrderIssues(['15:00:00', '10:00:00', '11:00:00'])).toEqual([null, 'backward', null])
  })

  it('형식이 어긋난 시각은 없는 것으로 본다', () => {
    expect(timeOrderIssues(['10:00:00', '오후 3시', '09:00'])).toEqual([null, null, 'backward'])
  })
})

describe('hasBackwardTime — 순서 편집 저장 전에 묻는다', () => {
  it('역행이 하나라도 있으면 참이다', () => {
    expect(hasBackwardTime(['10:00:00', '15:00:00', '12:30:00'])).toBe(true)
  })

  it('겹침만 있으면 묻지 않는다 — 순서를 맞춰도 겹침은 풀리지 않는다', () => {
    expect(hasBackwardTime(['10:00:00', '10:00:00'])).toBe(false)
  })

  it('시각이 없으면 거짓이다', () => {
    expect(hasBackwardTime([null, null])).toBe(false)
  })
})

describe('startTimesLine — 확인 문구의 시각 줄', () => {
  it('시각이 있는 항목만 HH:mm 으로 잇는다', () => {
    expect(startTimesLine(['10:00:00', null, '15:00:00', '12:30:00'])).toBe('10:00 → 15:00 → 12:30')
  })
})

describe('realignedStartTimes — 시각도 순서에 맞게 다시 맞춘다', () => {
  it('있던 시각을 오름차순으로 다시 나눠 준다 — 새 시각을 지어내지 않는다', () => {
    expect(realignedStartTimes(['10:00:00', '15:00:00', '12:30:00', '15:00:00'])).toEqual([
      '10:00:00',
      '12:30:00',
      '15:00:00',
      '15:00:00',
    ])
  })

  it('시각이 없던 자리는 그대로 비운다', () => {
    expect(realignedStartTimes(['15:00:00', null, '10:00:00'])).toEqual([
      '10:00:00',
      null,
      '15:00:00',
    ])
  })

  it('서버 원문을 그대로 옮긴다 — 형식이 어긋난 값은 제자리에 둔다(지우지 않는다)', () => {
    expect(realignedStartTimes(['12:00', 'x', '09:30:00'])).toEqual(['09:30:00', 'x', '12:00'])
  })
})
