import { describe, expect, it } from 'vitest'

import { insertedStartTime, slotStartTime } from '@/lib/plan/default-start-time'

/**
 * 담기 때 채우는 항목 시각 — 이슈 #1383 · `일정상세-세부명세.md` D24.
 *
 * 시각이 없으면 산책 위험도가 `NO_START_TIME` 으로 꺼진다. 담기가 시각을 채워 판정을 켠다.
 */
describe('slotStartTime — AI 초안 담기의 순서 슬롯', () => {
  it('그날 순서대로 10:00 · 12:30 · 15:00 · 17:30 · 20:00 이다 (요청 본문 형식 HH:mm:ss)', () => {
    expect([0, 1, 2, 3, 4].map(slotStartTime)).toEqual([
      '10:00:00',
      '12:30:00',
      '15:00:00',
      '17:30:00',
      '20:00:00',
    ])
  })

  it('여섯 번째부터는 비워 둔다 — 밤늦은 시각을 지어내지 않는다', () => {
    expect(slotStartTime(5)).toBeUndefined()
    expect(slotStartTime(9)).toBeUndefined()
  })

  it('음수 · 소수 인덱스는 비워 둔다', () => {
    expect(slotStartTime(-1)).toBeUndefined()
    expect(slotStartTime(1.5)).toBeUndefined()
  })
})

describe('insertedStartTime — 장소 하나를 끼울 때', () => {
  it('앞 항목 중 마지막 시각에 2시간 30분을 더한다', () => {
    expect(insertedStartTime(['10:00:00', '12:30:00'])).toBe('15:00:00')
  })

  it('앞 항목 시각이 없으면 건너뛰고 그 앞의 시각을 본다', () => {
    expect(insertedStartTime(['11:15:00', null, null])).toBe('13:45:00')
  })

  it('초가 빠진 서버 원문(HH:mm)도 읽는다', () => {
    expect(insertedStartTime(['09:30'])).toBe('12:00:00')
  })

  it('20:00 까지는 채운다', () => {
    expect(insertedStartTime(['17:30:00'])).toBe('20:00:00')
  })

  it('20:00 을 넘으면 비워 둔다 — 자정을 넘겨 다음 날로 돌지도 않는다', () => {
    expect(insertedStartTime(['17:31:00'])).toBeUndefined()
    expect(insertedStartTime(['23:00:00'])).toBeUndefined()
  })

  it('앞에 시각이 하나도 없으면 끼울 자리의 순서 슬롯이다', () => {
    expect(insertedStartTime([])).toBe('10:00:00')
    expect(insertedStartTime([null, null])).toBe('15:00:00')
    expect(insertedStartTime([null, null, null, null, null])).toBeUndefined()
  })

  it('형식이 어긋난 시각은 없는 것으로 본다', () => {
    expect(insertedStartTime(['오전 10시'])).toBe('12:30:00')
  })
})

describe('insertedStartTime — 뒤 항목 시각도 본다 (#1424)', () => {
  it('사용성 테스트 재현 — 12:30 뒤 · 숙소 15:00 앞에 끼우면 15:00 이 아니라 가운데 13:45 다', () => {
    expect(insertedStartTime(['10:00:00', '12:30:00'], ['15:00:00'])).toBe('13:45:00')
  })

  it('앞 시각 + 2:30 이 뒤 항목보다 30분 이상 이르면 그대로 쓴다', () => {
    expect(insertedStartTime(['10:00:00'], ['15:00:00'])).toBe('12:30:00')
    expect(insertedStartTime(['10:00:00'], ['13:00:00'])).toBe('12:30:00')
  })

  it('뒤 항목과 30분이 안 남으면 가운데로 당긴다', () => {
    expect(insertedStartTime(['10:00:00'], ['12:50:00'])).toBe('11:25:00')
  })

  it('앞 · 뒤 사이가 좁아 들어갈 자리가 없으면 비운다', () => {
    expect(insertedStartTime(['14:30:00'], ['15:00:00'])).toBeUndefined()
    expect(insertedStartTime(['14:00:00'], ['14:59:00'])).toBeUndefined()
  })

  it('이미 역행한 날(뒤가 앞보다 이르다)에는 비운다', () => {
    expect(insertedStartTime(['16:00:00'], ['15:00:00'])).toBeUndefined()
  })

  it('뒤 항목 중 시각이 있는 첫 항목을 본다', () => {
    expect(insertedStartTime(['12:30:00'], [null, '15:00:00'])).toBe('13:45:00')
  })

  it('앞에 시각이 없으면 순서 슬롯이 뒤 항목보다 이를 때만 쓴다 — 뒤에서 거꾸로 지어내지 않는다', () => {
    expect(insertedStartTime([], ['15:00:00'])).toBe('10:00:00')
    expect(insertedStartTime([null, null, null], ['15:00:00'])).toBeUndefined()
  })

  it('뒤 항목에 시각이 없으면 예전 규칙 그대로다', () => {
    expect(insertedStartTime(['12:30:00'], [null])).toBe('15:00:00')
  })
})
