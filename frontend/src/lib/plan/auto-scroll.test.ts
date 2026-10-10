import { describe, expect, it } from 'vitest'

import { autoScrollStep, EDGE_PX } from '@/lib/plan/auto-scroll'

const VIEWPORT = 800

describe('autoScrollStep — 가장자리 밖', () => {
  /*
    짧은 목록에서 드래그해도 화면이 움직이지 않아야 한다는 회귀 조건이 이것이다 —
    가운데에서 끄는 동안에는 스크롤 요청 자체가 나가지 않는다.
  */
  it('화면 가운데에서는 0 이다', () => {
    expect(autoScrollStep(VIEWPORT / 2, VIEWPORT)).toBe(0)
  })

  it('가장자리 경계 바로 안쪽까지는 0 이다', () => {
    expect(autoScrollStep(EDGE_PX, VIEWPORT)).toBe(0)
    expect(autoScrollStep(VIEWPORT - EDGE_PX, VIEWPORT)).toBe(0)
  })
})

describe('autoScrollStep — 방향', () => {
  it('위쪽 가장자리는 음수다', () => {
    expect(autoScrollStep(10, VIEWPORT)).toBeLessThan(0)
  })

  it('아래쪽 가장자리는 양수다', () => {
    expect(autoScrollStep(VIEWPORT - 10, VIEWPORT)).toBeGreaterThan(0)
  })
})

describe('autoScrollStep — 속도', () => {
  /*
    일정 속도면 조금 걸쳤을 때 너무 빠르고 끝까지 밀었을 때 너무 느리다.
  */
  it('깊이 비례다 — 깊이 밀수록 빠르다', () => {
    const shallow = autoScrollStep(VIEWPORT - EDGE_PX + 5, VIEWPORT)
    const deep = autoScrollStep(VIEWPORT - 1, VIEWPORT)

    expect(deep).toBeGreaterThan(shallow)
  })

  /*
    포인터가 화면 밖으로 나가면 깊이가 1을 넘는다. 자르지 않으면 손을 조금 더 뺐다고
    스크롤이 몇 배로 빨라진다.
  */
  it('화면 밖으로 나가도 최대 속도를 넘지 않는다', () => {
    const atEdge = autoScrollStep(0, VIEWPORT)

    expect(autoScrollStep(-500, VIEWPORT)).toBe(atEdge)
    expect(autoScrollStep(VIEWPORT + 500, VIEWPORT)).toBe(-atEdge)
  })

  it('가장자리 안이면 최소 1px 은 움직인다 — 0 으로 반올림돼 멈추지 않는다', () => {
    expect(Math.abs(autoScrollStep(EDGE_PX - 1, VIEWPORT))).toBeGreaterThanOrEqual(1)
  })
})

describe('autoScrollStep — 짧은 뷰포트', () => {
  /*
    위아래 구역이 겹치면 화면 한가운데에서도 한쪽 판정에 걸려, 가만히 있어도 목록이 흐른다.
  */
  it('위아래 구역이 겹칠 만큼 짧으면 스크롤하지 않는다', () => {
    const tiny = EDGE_PX * 2

    expect(autoScrollStep(1, tiny)).toBe(0)
    expect(autoScrollStep(tiny - 1, tiny)).toBe(0)
  })
})
