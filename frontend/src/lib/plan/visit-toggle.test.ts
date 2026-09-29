import { describe, expect, it } from 'vitest'

import { planPhaseOf } from '@/lib/plan/date'
import { canMarkVisited, visitToggleForm } from '@/lib/plan/visit-toggle'

/**
 * 다녀옴 토글의 시점 판정 — 이슈 #983.
 *
 * **서버 가드 `PLAN_027` 과 같은 선이다.** 서비스 기준 오늘(KST)이 시작일보다 앞이면 서버가
 * `visited: true` 를 400 으로 거절하고, 시작일 당일부터 받는다. 해제(`visited: false`)는
 * 언제나 받는다. `planPhaseOf` 는 출발 당일을 `upcoming · days 0` 에 두므로 `days >= 1` 이
 * 거절선이다 — `여행 완료하기`(#971 · `PLAN_026`)와 같은 모양이다.
 */
describe('canMarkVisited — 다녀옴으로 새로 표시할 수 있는가 (#983)', () => {
  const START = '2026-10-01'
  const END = '2026-10-03'
  /** 로컬 정오 — `planPhaseOf` 가 받는 모양이다 (`status-action.test.ts` 와 같은 관례) */
  const on = (month: number, day: number) => new Date(2026, month - 1, day, 12)

  it('출발 전날(D-1)에는 표시할 수 없다 — 서버가 PLAN_027 로 거절한다', () => {
    expect(canMarkVisited(planPhaseOf(START, END, on(9, 30)))).toBe(false)
  })

  it('더 이른 날(D-9)도 표시할 수 없다', () => {
    expect(canMarkVisited(planPhaseOf(START, END, on(9, 22)))).toBe(false)
  })

  it('출발 당일(D-DAY)부터 표시할 수 있다 — 서버가 시작일 당일부터 받는다', () => {
    const phase = planPhaseOf(START, END, on(10, 1))

    expect(phase).toEqual({ kind: 'upcoming', days: 0 })
    expect(canMarkVisited(phase)).toBe(true)
  })

  it('여행 중에는 표시할 수 있다', () => {
    expect(canMarkVisited(planPhaseOf(START, END, on(10, 2)))).toBe(true)
  })

  it('지난 일정도 표시할 수 있다 — 다녀온 뒤 기록하는 사람이 있다', () => {
    expect(canMarkVisited(planPhaseOf(START, END, on(10, 10)))).toBe(true)
  })

  it('날짜를 못 읽으면(null) 표시할 수 있다고 본다 — 최종 판정은 서버가 한다', () => {
    expect(canMarkVisited(null)).toBe(true)
  })
})

describe('visitToggleForm — 행의 토글 모양 (#983 · #732)', () => {
  it('표시할 수 없는 날의 미체크 항목에는 토글이 없다', () => {
    expect(visitToggleForm(false, { compact: true, canMark: false })).toBe('hidden')
  })

  it('표시할 수 없는 날이어도 체크된 항목은 해제 토글이 선다 — 해제는 언제나 받는다', () => {
    expect(visitToggleForm(true, { compact: true, canMark: false })).toBe('label')
  })

  it('출발 당일의 미체크 항목은 아이콘만이다 — #732 의 접기 그대로다', () => {
    expect(visitToggleForm(false, { compact: true, canMark: true })).toBe('icon')
  })

  it('출발 당일이어도 체크된 항목은 낱말을 지킨다', () => {
    expect(visitToggleForm(true, { compact: true, canMark: true })).toBe('label')
  })

  it('여행 중·지난 일정은 글자가 붙은 토글이다', () => {
    expect(visitToggleForm(false, { compact: false, canMark: true })).toBe('label')
    expect(visitToggleForm(true, { compact: false, canMark: true })).toBe('label')
  })
})
