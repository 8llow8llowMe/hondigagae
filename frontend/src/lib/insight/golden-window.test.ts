import { describe, expect, it } from 'vitest'

import { isWithinGoldenWindow, markGoldenWindow } from '@/lib/insight/golden-window'
import type { HourlyWalkSafetyItem } from '@/types/insight'

const DAY = '2026-08-29T'

function hour(hh: string): HourlyWalkSafetyItem {
  return {
    at: `${DAY}${hh}:00:00`,
    walkSafetyLevel: { code: 'SAFE', name: '안전', description: null, score: null },
    temperature: 27,
    estimatedPavementCelsius: 33,
    precipitationProbability: 0,
  } as unknown as HourlyWalkSafetyItem
}

describe('isWithinGoldenWindow', () => {
  const start = `${DAY}17:00:00`
  const end = `${DAY}23:00:00`

  /* 문장이 `17:00 – 23:00` 이라고 적어 놓고 셀에서 양끝을 빼면 둘이 다시 어긋난다 */
  it('양끝을 포함한다', () => {
    expect(isWithinGoldenWindow(`${DAY}17:00:00`, start, end)).toBe(true)
    expect(isWithinGoldenWindow(`${DAY}23:00:00`, start, end)).toBe(true)
  })

  it('구간 안이면 참이다', () => {
    expect(isWithinGoldenWindow(`${DAY}19:00:00`, start, end)).toBe(true)
  })

  it('구간 밖이면 거짓이다', () => {
    expect(isWithinGoldenWindow(`${DAY}16:00:00`, start, end)).toBe(false)
    expect(isWithinGoldenWindow(`${DAY}23:00:01`, start, end)).toBe(false)
  })

  /** `goldenStart == goldenEnd` 인 날이 정상 응답이다 (#200) */
  it('한 시각짜리 구간은 그 한 칸만 든다', () => {
    const at = `${DAY}23:00:00`

    expect(isWithinGoldenWindow(at, at, at)).toBe(true)
    expect(isWithinGoldenWindow(`${DAY}22:00:00`, at, at)).toBe(false)
  })

  /* 추천이 없는 날에 화면이 구간을 만들어 내지 않는다 */
  it('구간이 없으면 어느 칸도 들지 않는다', () => {
    expect(isWithinGoldenWindow(`${DAY}19:00:00`, null, null)).toBe(false)
    expect(isWithinGoldenWindow(`${DAY}19:00:00`, start, null)).toBe(false)
    expect(isWithinGoldenWindow(`${DAY}19:00:00`, null, end)).toBe(false)
  })

  /* 뒤집힌 구간을 해석해서 없는 추천을 만들지 않는다 */
  it('끝이 시작보다 앞서면 어느 칸도 들지 않는다', () => {
    expect(isWithinGoldenWindow(`${DAY}19:00:00`, end, start)).toBe(false)
  })
})

describe('markGoldenWindow', () => {
  const hourly = ['15', '16', '17', '18', '19'].map(hour)

  it('구간의 양끝을 짚는다', () => {
    const marks = markGoldenWindow(hourly, `${DAY}17:00:00`, `${DAY}18:00:00`)

    expect(marks.map((m) => m.inWindow)).toEqual([false, false, true, true, false])
    expect(marks.map((m) => m.windowStart)).toEqual([false, false, true, false, false])
    expect(marks.map((m) => m.windowEnd)).toEqual([false, false, false, true, false])
  })

  it('한 칸짜리 구간은 시작이자 끝이다', () => {
    const marks = markGoldenWindow(hourly, `${DAY}17:00:00`, `${DAY}17:00:00`)

    expect(marks[2]).toEqual({ inWindow: true, windowStart: true, windowEnd: true })
  })

  /* 구간이 곡선의 첫 칸/끝 칸까지 닿아도 양끝 판정이 배열 밖으로 새지 않는다 */
  it('곡선의 첫 칸과 끝 칸에 걸쳐도 양끝을 짚는다', () => {
    const marks = markGoldenWindow(hourly, `${DAY}15:00:00`, `${DAY}19:00:00`)

    expect(marks[0]?.windowStart).toBe(true)
    expect(marks[4]?.windowEnd).toBe(true)
    expect(marks.every((m) => m.inWindow)).toBe(true)
  })

  it('구간이 없는 날은 전부 거짓이다', () => {
    const marks = markGoldenWindow(hourly, null, null)

    expect(marks.every((m) => !m.inWindow && !m.windowStart && !m.windowEnd)).toBe(true)
  })

  it('곡선이 비어 있어도 견딘다', () => {
    expect(markGoldenWindow([], `${DAY}17:00:00`, `${DAY}18:00:00`)).toEqual([])
  })
})
