import { describe, expect, it } from 'vitest'

import { defaultPlanTitle, PLAN_TITLE_MAX, tripLengthLabel } from '@/lib/ai-plan/draft-title'

describe('tripLengthLabel', () => {
  it('여러 날은 N박 M일로 쓴다', () => {
    expect(tripLengthLabel(3)).toBe('2박 3일')
    expect(tripLengthLabel(2)).toBe('1박 2일')
  })

  it('하루짜리는 "0박 1일" 이 아니라 당일치기다', () => {
    expect(tripLengthLabel(1)).toBe('당일치기')
  })

  it('일수를 못 셌더라도 이상한 표기를 만들지 않는다', () => {
    expect(tripLengthLabel(0)).toBe('당일치기')
  })
})

describe('defaultPlanTitle', () => {
  it('아트보드 03 서식을 만든다', () => {
    expect(defaultPlanTitle('몽실이', 3)).toBe('몽실이와 제주 2박 3일')
  })

  it('받침이 있는 이름에는 "과" 를 붙인다', () => {
    expect(defaultPlanTitle('곰', 2)).toBe('곰과 제주 1박 2일')
  })

  it('당일치기도 같은 서식이다', () => {
    expect(defaultPlanTitle('초코', 1)).toBe('초코와 제주 당일치기')
  })

  it('이름이 없으면 이름 없이 만든다 — 담기 직전에 고칠 수 있다', () => {
    expect(defaultPlanTitle('', 3)).toBe('제주 2박 3일')
  })

  it('60자를 넘기지 않는다 — 기본값이 PLAN_104 를 유발하면 안 된다', () => {
    const title = defaultPlanTitle('가'.repeat(80), 3)
    expect(title.length).toBe(PLAN_TITLE_MAX)
  })
})
