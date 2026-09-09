import { describe, expect, it } from 'vitest'

import { INSET_BLEED_CLASS, INSET_BLEED_END_CLASS, INSET_CLASS } from '@/lib/ui/inset'

describe('INSET_CLASS — panel', () => {
  it('고정 폭 패널은 뷰포트 breakpoint 없이 평평한 px-4 다', () => {
    // md:/lg: 는 뷰포트 기준이라 400px 패널 안에서도 40px(main)·24px(rail) 이 붙는다 —
    // 패널 상태(로딩·오류·빈 상태)가 실제 행(emergency-map-panel.tsx, 평평한 px-4)과
    // 다른 세로선에 서는 원인이다. panel 은 그 breakpoint 자체를 갖지 않는다.
    expect(INSET_CLASS.panel).toBe('px-4')
  })

  it('main·rail 과 달리 panel 에는 md:/lg: 접두어가 없다', () => {
    expect(INSET_CLASS.panel).not.toContain('md:')
    expect(INSET_CLASS.panel).not.toContain('lg:')
  })

  it('bleed 변형도 breakpoint 없이 평평하다', () => {
    expect(INSET_BLEED_CLASS.panel).not.toContain('md:')
    expect(INSET_BLEED_CLASS.panel).not.toContain('lg:')
    expect(INSET_BLEED_END_CLASS.panel).not.toContain('md:')
    expect(INSET_BLEED_END_CLASS.panel).not.toContain('lg:')
  })
})
