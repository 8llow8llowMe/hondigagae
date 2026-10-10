import { describe, expect, it } from 'vitest'

import { defaultPlanTitle } from '@/lib/ai-plan/draft-title'
import { petNamesLabel } from '@/lib/ai-plan/pet-names'

describe('petNamesLabel — 이름을 이어 붙인다', () => {
  it('한 마리면 그대로다', () => {
    expect(petNamesLabel([{ name: '몽실이' }])).toBe('몽실이')
  })

  it('여러 마리는 · 로 잇는다', () => {
    expect(petNamesLabel([{ name: '몽실이' }, { name: '초코' }])).toBe('몽실이·초코')
  })

  it('빈 이름은 건너뛴다 — 구분자만 남지 않는다', () => {
    expect(petNamesLabel([{ name: '몽실이' }, { name: '' }])).toBe('몽실이')
  })

  it('전부 비면 빈 문자열이다', () => {
    expect(petNamesLabel([{ name: '' }, { name: '' }])).toBe('')
  })
})

/*
  조사 로직을 복제하지 않는다는 것을 잠근다 — withCompanionParticle 이
  **마지막 글자**의 받침을 보므로 이어붙인 문자열을 그대로 넘기면 맞는다 (명세 D5).
*/
describe('이어붙인 이름 + 제목 기본값', () => {
  it('마지막 이름에 받침이 없으면 와', () => {
    expect(defaultPlanTitle(petNamesLabel([{ name: '몽실이' }, { name: '초코' }]), 3)).toContain(
      '몽실이·초코와',
    )
  })

  it('마지막 이름에 받침이 있으면 과', () => {
    expect(defaultPlanTitle(petNamesLabel([{ name: '초코' }, { name: '곰' }]), 3)).toContain(
      '초코·곰과',
    )
  })
})
