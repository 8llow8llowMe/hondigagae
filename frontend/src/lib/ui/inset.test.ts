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

/*
  왼쪽 기준선 회귀 — 이슈 #386.

  헤더 로고(40)와 레일 첫 글자(24)가 같은 컨테이너 경계에서 16px 갈라져 있었다. 고친
  방향은 **레일의 왼쪽만 본문과 같게 두고 오른쪽만 24 로 좁히는 것**이다. `lg:px-6` 이
  다시 들어오면 그 어긋남이 조용히 돌아오므로 여기서 잡는다.
*/
describe('INSET_CLASS — 왼쪽 기준선 (#386)', () => {
  it('rail 은 main 에 오른쪽 축소만 얹은 값이다', () => {
    expect(INSET_CLASS.rail).toBe(`${INSET_CLASS.main} lg:pr-6`)
  })

  it('rail 이 lg 에서 왼쪽을 건드리지 않는다 — lg:px-6 / lg:pl-* 금지', () => {
    // lg:px-6 은 오른쪽과 함께 **왼쪽**도 24 로 내려 헤더와 16px 갈라진다
    expect(INSET_CLASS.rail).not.toContain('lg:px-')
    expect(INSET_CLASS.rail).not.toContain('lg:pl-')
  })

  it('bleed 변형도 lg 에서 오른쪽만 상쇄한다', () => {
    expect(INSET_BLEED_CLASS.rail).not.toContain('lg:-mx-')
    expect(INSET_BLEED_CLASS.rail).not.toContain('lg:-ml-')
    expect(INSET_BLEED_CLASS.rail).toContain('lg:-mr-6 lg:pr-6')
    expect(INSET_BLEED_END_CLASS.rail).toContain('lg:-mr-6 lg:pr-6')
  })

  it('main 과 rail 의 모바일·태블릿 값이 같다 — lg 미만에서는 레일이 한 블록이다', () => {
    expect(INSET_CLASS.rail.startsWith(INSET_CLASS.main)).toBe(true)
  })
})
